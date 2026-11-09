import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import { ApplicationStatus, EmploymentType, JobStatus, Prisma } from "@prisma/client"
import { assertEmailVerified, requireVerifiedEmail } from "../auth/email-verification"
import { PricingService, PublishCostInput } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { CacheService } from "../cache/cache.service"
import { AccessService, Actor, companySuspended } from "../core/access/access.service"
import { EmailService } from "../core/delivery/email.service"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { formatSalaryRange } from "../core/validation/structured"
import { EmbeddingsService } from "../embeddings/embeddings.service"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { SearchService } from "../search/search.service"
import { AlertsService } from "../seeker-tools/alerts.service"
import { CreateJobDto } from "./dtos/create-job.dto"
import { UpdateJobDto } from "./dtos/update-job.dto"
import { computeFunnelAnalytics } from "./funnel-analytics"
import { evaluateJobContent, JobContent } from "./job-content-policy"
import { PUBLIC_COMPANY_SELECT } from "./public-company"
import { PUBLIC_JOB_WHERE } from "./public-job"

const JOB_COLORS = ["purple", "blue", "green", "orange"] as const
const PUBLIC_JOBS_CACHE_KEY = "jobs:public"
/** Default and maximum page size of GET /jobs/public. */
export const PUBLIC_SEARCH_LIMIT = 50
export const PUBLIC_SEARCH_MAX_LIMIT = 100
/** Job fields whose change makes the stored embedding stale. */
const EMBEDDED_FIELDS = ["title", "description", "skills", "requirements", "status"] as const

export type PublicJobsPage<T = any> = { items: T[]; total: number }
/** Statuses a recruiter may set; FLAGGED is reserved for admins (moderation). */
const RECRUITER_JOB_STATUSES: JobStatus[] = [JobStatus.ACTIVE, JobStatus.CLOSED, JobStatus.DRAFT]

/** Bounds for GET /jobs/analytics (most recent applications win when exceeded). */
const ANALYTICS_MAX_APPLICATIONS = 20_000
const ANALYTICS_MAX_EVENTS = 100_000
const ANALYTICS_MAX_JOBS = 500

/** Public listings and detail: live jobs of companies that are not suspended by an admin. */
export { PUBLIC_JOB_WHERE } from "./public-job"

/** Applications counted on recruiter job cards: SAVED bookmarks are not applicants. */
/** Feature durations a recruiter may buy (days). */
export const FEATURE_DAY_OPTIONS = [7, 14, 30] as const
const DAY_MS = 24 * 60 * 60 * 1000

const APPLICANT_COUNT = {
  _count: {
    select: {
      applications: {
        where: {
          status: {
            notIn: [ApplicationStatus.SAVED, ApplicationStatus.SOURCED] as ApplicationStatus[],
          },
        },
      },
    },
  },
} as const

/** Structured salary columns + their generated display text (all null clears the range). */
function salaryData(dto: {
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  salaryPeriod?: "YEAR" | "MONTH" | "HOUR" | null
}) {
  if (dto.salaryMin == null || dto.salaryMax == null || !dto.salaryCurrency)
    return {
      salary: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    }
  return {
    salary: formatSalaryRange(dto.salaryMin, dto.salaryMax, dto.salaryCurrency, dto.salaryPeriod),
    salaryMin: dto.salaryMin,
    salaryMax: dto.salaryMax,
    salaryCurrency: dto.salaryCurrency,
    salaryPeriod: dto.salaryPeriod ?? "YEAR",
  }
}

/** Moderation removal is final for the poster: no edits, reopening or featuring (admins may). */
function assertNotRemoved(
  job: { removedAt?: Date | null; removedReason?: string | null },
  actor: Actor
) {
  if (job.removedAt && actor.role !== "ADMIN")
    throw new AppException(
      `This job was removed by Hyrr moderation${job.removedReason ? `: ${job.removedReason}` : ""}. It can't be edited or reopened.`,
      HttpStatus.FORBIDDEN,
      "JOB_REMOVED_BY_MODERATION",
      { reason: job.removedReason ?? null }
    )
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private access: AccessService,
    private notifications: NotificationsService,
    private wallet: WalletService,
    private pricing: PricingService,
    @Optional() private email?: EmailService,
    @Optional() private messagesGateway?: MessagesGateway,
    @Optional() private alerts?: AlertsService,
    @Optional() private search?: SearchService,
    @Optional() private embeddings?: EmbeddingsService
  ) {}

  /** Search index + embedding refresh; both are queued and never fail the request. */
  private afterJobChange(jobId: string, opts: { index?: boolean; embed?: boolean }) {
    try {
      if (opts.index) this.search?.indexJobSoon(jobId)
      if (opts.embed && this.embeddings)
        void Promise.resolve(this.embeddings.embedJobSoon(jobId)).catch((err: any) =>
          this.logger.warn(`Embedding refresh failed for ${jobId}: ${err?.message}`)
        )
    } catch (err: any) {
      this.logger.warn(`Index/embedding refresh failed for ${jobId}: ${err?.message}`)
    }
  }

  /** Jobs always expose `requirements` as a string array. */
  private withRequirements<T extends { requirements?: string[] | null }>(job: T): T {
    return job ? { ...job, requirements: job.requirements ?? [] } : job
  }

  // ─── Recruiter: list the company's jobs ───────────────────────────
  async getRecruiterJobs(actor: Actor | string) {
    const scope =
      typeof actor === "string" ? { recruiterId: actor } : await this.access.jobScopeWhere(actor)
    const jobs = await this.prisma.job.findMany({
      where: scope,
      include: { company: true, category: true, ...APPLICANT_COUNT },
      orderBy: { createdAt: "desc" },
    })
    return jobs.map((job) => this.withRequirements(job))
  }

  /** 400 JOB_CONTENT_REJECTED with the matched reasons when a posting looks like a scam. */
  private assertAcceptableContent(content: JobContent) {
    const reasons = evaluateJobContent(content)
    if (reasons.length)
      throw new AppException(
        "This job posting contains content that is not allowed on Hyrr",
        HttpStatus.BAD_REQUEST,
        "JOB_CONTENT_REJECTED",
        reasons
      )
  }

  // ─── Recruiter: create a job ──────────────────────────────────────
  async createJob(recruiterId: string, dto: CreateJobDto) {
    const user = await this.prisma.user.findUnique({ where: { id: recruiterId } })
    const status = dto.status === JobStatus.DRAFT ? JobStatus.DRAFT : JobStatus.ACTIVE
    // Publishing needs a verified e-mail; drafts can be prepared before verifying.
    if (status === JobStatus.ACTIVE) requireVerifiedEmail(user ?? { emailVerifiedAt: null })
    this.assertAcceptableContent(dto)
    const count = await this.prisma.job.count({ where: { recruiterId } })
    const color = JOB_COLORS[count % JOB_COLORS.length]

    const companyId = user?.companyId ?? null
    // Companies are created at sign-up or on "Set up your company" (TeamService), never here.
    if (!companyId)
      throw new AppException(
        "Set up your company before posting jobs.",
        HttpStatus.FORBIDDEN,
        "COMPANY_REQUIRED"
      )
    {
      const scope = await this.access.companyScope(recruiterId)
      if (scope.suspendedCompanyIds?.includes(companyId)) throw companySuspended()
      if (!scope.manageCompanyIds.includes(companyId)) {
        throw new AppException(
          "Your company role does not allow posting jobs",
          HttpStatus.FORBIDDEN,
          "FORBIDDEN"
        )
      }
    }

    // Price + config are read before the transaction (cached, outside the row locks).
    const publishing = status === JobStatus.ACTIVE
    const cost = publishing
      ? await this.pricing.publishCost({
          remote: dto.remote ?? false,
          salaryMax: dto.salaryMax,
          salaryCurrency: dto.salaryCurrency,
          salaryPeriod: dto.salaryPeriod,
          categoryId: dto.categoryId,
        })
      : 0
    // One transaction: auto-created company (+ sign-up bonus), the job and its publish charge.
    // 402 INSUFFICIENT_CREDITS rolls everything back, so nothing is written.
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          title: dto.title,
          location: dto.location,
          type: dto.type,
          ...salaryData(dto),
          description: dto.description,
          requirements: dto.requirements ?? [],
          skills: dto.skills,
          benefits: dto.benefits ?? [],
          // `featured` is bought via POST /jobs/:id/feature; the DTO flag is ignored.
          featured: false,
          remote: dto.remote ?? false,
          color,
          companyId,
          recruiterId,
          categoryId: dto.categoryId,
          status,
          ...(publishing ? { publishedAt: new Date(), momentumCost: cost } : {}),
        },
        include: { company: true, category: true },
      })
      if (publishing)
        await this.wallet.debit(
          {
            companyId,
            amount: cost,
            type: "JOB_PUBLISH",
            referenceId: created.id,
            actorId: recruiterId,
            note: `Published "${created.title}"`,
          },
          tx
        )
      return created
    })

    // Invalidate cached public listings
    await this.cache.delByPattern("jobs:public*")
    this.afterJobChange(job.id, { index: job.status === JobStatus.ACTIVE, embed: true })
    if (job.status === JobStatus.ACTIVE)
      this.messagesGateway?.emitAdminMetric("job_published", { jobId: job.id })
    // Alerts never block job creation (drafts are not announced)
    if (job.status === JobStatus.ACTIVE)
      this.alerts
        ?.onJobPublished(job.id)
        .catch((err) => this.logger.warn(`Job alert fan-out failed for ${job.id}: ${err?.message}`))
    return this.withRequirements(job)
  }

  // ─── Recruiter: update / close a job ─────────────────────────────
  async updateJob(jobId: string, dto: UpdateJobDto, actor: Actor) {
    const current = await this.access.jobForManagement(actor, jobId)
    assertNotRemoved(current, actor)
    if (dto.status !== undefined && actor.role !== "ADMIN") {
      if (current.status === JobStatus.FLAGGED && dto.status !== JobStatus.FLAGGED)
        throw new AppException(
          "This job was flagged by moderation; only an admin can change its status",
          HttpStatus.FORBIDDEN,
          "JOB_FLAGGED"
        )
      if (!RECRUITER_JOB_STATUSES.includes(dto.status) && current.status !== dto.status)
        throw new AppException(
          "Status must be one of ACTIVE, CLOSED, DRAFT",
          HttpStatus.BAD_REQUEST,
          "INVALID_STATUS"
        )
    }

    const effectiveStatus =
      actor.role !== "ADMIN" && current.status === JobStatus.FLAGGED ? current.status : dto.status
    if (
      effectiveStatus === JobStatus.ACTIVE &&
      current.status !== JobStatus.ACTIVE &&
      actor.role !== "ADMIN"
    )
      await assertEmailVerified(this.prisma, actor.userId)
    if (
      actor.role !== "ADMIN" &&
      [dto.title, dto.description, dto.requirements, dto.benefits].some((v) => v !== undefined)
    )
      this.assertAcceptableContent({
        title: dto.title ?? current.title,
        description: dto.description ?? current.description,
        requirements: dto.requirements ?? current.requirements,
        benefits: dto.benefits ?? current.benefits,
      })

    const { salaryMin, salaryMax, salaryCurrency, salaryPeriod, employmentType, ...rest } = dto
    const data: Prisma.JobUncheckedUpdateInput = { ...rest }
    if (actor.role !== "ADMIN" && current.status === JobStatus.FLAGGED) delete data.status
    if (employmentType && !rest.type) data.type = employmentType
    // The DTO guarantees all four salary fields arrive together (or all null to clear).
    if (salaryMin !== undefined || salaryMax !== undefined)
      Object.assign(data, salaryData({ salaryMin, salaryMax, salaryCurrency, salaryPeriod }))

    // First publication (publishedAt still null) is charged once; reopening a published job is free.
    const firstPublish =
      data.status === JobStatus.ACTIVE &&
      current.status !== JobStatus.ACTIVE &&
      !current.publishedAt
    const isAdmin = actor.role === "ADMIN"
    const cost =
      firstPublish && !isAdmin
        ? await this.pricing.publishCost({
            remote: (data.remote as boolean | undefined) ?? current.remote,
            salary: current.salary,
            salaryMax: salaryMax !== undefined ? salaryMax : current.salaryMax,
            salaryCurrency: salaryMax !== undefined ? salaryCurrency : current.salaryCurrency,
            salaryPeriod: salaryMax !== undefined ? salaryPeriod : current.salaryPeriod,
            categoryId: (data.categoryId as string | undefined) ?? current.categoryId,
          })
        : 0

    let published = false
    const job = await this.prisma.$transaction(async (tx) => {
      if (firstPublish) {
        // Atomic claim: of two concurrent publishes only one sees publishedAt = null.
        const claimed = await tx.job.updateMany({
          where: { id: jobId, publishedAt: null },
          data: { publishedAt: new Date(), momentumCost: cost },
        })
        published = claimed.count === 1
        if (published && cost > 0)
          await this.wallet.debit(
            {
              companyId: current.companyId,
              amount: cost,
              type: "JOB_PUBLISH",
              referenceId: jobId,
              actorId: actor.userId,
              note: `Published "${(data.title as string | undefined) ?? current.title}"`,
            },
            tx
          )
      }
      const updated = await tx.job.update({
        where: { id: jobId },
        data,
        include: { company: true, category: true, ...APPLICANT_COUNT },
      })
      // Closing a job refunds seekers whose applications were never reviewed.
      if (updated.status === JobStatus.CLOSED && current.status !== JobStatus.CLOSED)
        await this.wallet.refundUnreviewedApplications(jobId, tx)
      return updated
    })
    await this.cache.delByPattern("jobs:public*")
    this.afterJobChange(job.id, {
      // Only ACTIVE jobs live in the index: (re)index when it is or was public.
      index: job.status === JobStatus.ACTIVE || current.status === JobStatus.ACTIVE,
      embed: EMBEDDED_FIELDS.some((f) => data[f] !== undefined),
    })
    if (published && job.status === JobStatus.ACTIVE)
      this.messagesGateway?.emitAdminMetric("job_published", { jobId: job.id })
    // The first publication is announced like a newly created job (reopening is not).
    if (published && job.status === JobStatus.ACTIVE)
      this.alerts
        ?.onJobPublished(job.id)
        .catch((err) => this.logger.warn(`Job alert fan-out failed for ${job.id}: ${err?.message}`))
    return this.withRequirements(job)
  }

  // ─── Recruiter: Momentum publish-cost preview ─────────────────────
  async getPublishCost(actor: Actor, input: PublishCostInput) {
    const [{ cost, base, multipliers }, balance] = await Promise.all([
      this.pricing.publishCostBreakdown(input),
      actor.companyId ? this.wallet.getBalance(actor.companyId) : Promise.resolve(0),
    ])
    return { cost, balance, breakdown: { base, multipliers } }
  }

  // ─── Recruiter: feature a job (Momentum) ──────────────────────────
  /**
   * Charges featureCost × days / featureDays (JOB_FEATURE, referenceId = job id) and extends
   * `featuredUntil` from max(now, featuredUntil). Admins feature for free.
   */
  async featureJob(jobId: string, days: number | undefined, actor: Actor) {
    const current = await this.access.jobForManagement(actor, jobId)
    assertNotRemoved(current, actor)
    if (current.status !== JobStatus.ACTIVE)
      throw new AppException(
        "Only active jobs can be featured",
        HttpStatus.CONFLICT,
        "JOB_NOT_ACTIVE"
      )
    const config = await this.pricing.getConfig()
    const span = days ?? config.featureDays
    if (!FEATURE_DAY_OPTIONS.includes(span as (typeof FEATURE_DAY_OPTIONS)[number]))
      throw new AppException(
        `days must be one of ${FEATURE_DAY_OPTIONS.join(", ")}`,
        HttpStatus.BAD_REQUEST,
        "INVALID_FEATURE_DAYS"
      )
    const cost =
      actor.role === "ADMIN"
        ? 0
        : Math.max(1, Math.round((config.featureCost * span) / config.featureDays))

    const job = await this.prisma.$transaction(async (tx) => {
      // Debit first: it locks the company's wallet row, which serialises concurrent feature
      // purchases so each extension starts from the committed featuredUntil.
      if (cost > 0)
        await this.wallet.debit(
          {
            companyId: current.companyId,
            amount: cost,
            type: "JOB_FEATURE",
            referenceId: jobId,
            actorId: actor.userId,
            note: `Featured "${current.title}" for ${span} days`,
          },
          tx
        )
      const fresh = await tx.job.findUnique({
        where: { id: jobId },
        select: { featuredUntil: true },
      })
      const now = Date.now()
      const from = Math.max(now, fresh?.featuredUntil?.getTime() ?? 0)
      return tx.job.update({
        where: { id: jobId },
        data: { featured: true, featuredUntil: new Date(from + span * DAY_MS) },
        select: { featuredUntil: true },
      })
    })
    await this.cache.delByPattern("jobs:public*")
    this.afterJobChange(jobId, { index: true })
    const balance = await this.wallet.getBalance(current.companyId)
    return { featuredUntil: job.featuredUntil, balance }
  }

  /** Clears `featured` on jobs whose window ended (run by FeaturedJobsScheduler). */
  async expireFeatured(): Promise<number> {
    const { count } = await this.prisma.job.updateMany({
      where: { featured: true, featuredUntil: { lte: new Date() } },
      data: { featured: false },
    })
    if (count) await this.cache.delByPattern("jobs:public*")
    return count
  }

  // ─── Recruiter: delete a job ──────────────────────────────────────
  async deleteJob(jobId: string, actor: Actor) {
    const current = await this.access.jobForManagement(actor, jobId)
    if (current.status === JobStatus.FLAGGED && actor.role !== "ADMIN")
      throw new AppException(
        "This job was flagged by moderation and cannot be deleted",
        HttpStatus.FORBIDDEN,
        "JOB_FLAGGED"
      )
    await this.prisma.$transaction(async (tx) => {
      await this.wallet.refundUnreviewedApplications(jobId, tx)
      await tx.job.delete({ where: { id: jobId } })
    })
    await this.cache.delByPattern("jobs:public*")
    try {
      this.search?.removeJobSoon(jobId)
    } catch (err: any) {
      this.logger.warn(`Search removal failed for ${jobId}: ${err?.message}`)
    }
    return { id: jobId, deleted: true }
  }

  // ─── Public: full-text search + filter (Redis cached) ────────────
  /** Array-returning form kept for existing callers; see `searchPublicJobsPage`. */
  async searchPublicJobs(
    query?: string,
    type?: EmploymentType,
    categorySlug?: string,
    remote?: boolean,
    page: { limit?: number; offset?: number } = {}
  ) {
    return (await this.searchPublicJobsPage(query, type, categorySlug, remote, page)).items
  }

  /**
   * Active jobs, currently featured first. With Meilisearch enabled and a non-empty query the
   * ids and their order come from Meili (relevance) and are hydrated from Postgres; otherwise
   * (or when Meili fails) Postgres `contains` matching, newest first. Cached for 2 minutes.
   */
  async searchPublicJobsPage(
    query?: string,
    type?: EmploymentType,
    categorySlug?: string,
    remote?: boolean,
    page: { limit?: number; offset?: number } = {}
  ): Promise<PublicJobsPage> {
    const limit = Math.min(
      PUBLIC_SEARCH_MAX_LIMIT,
      Math.max(1, Math.floor(page.limit ?? PUBLIC_SEARCH_LIMIT))
    )
    const offset = Math.max(0, Math.floor(page.offset ?? 0))
    const q = query?.trim() || ""
    const cacheKey = `${PUBLIC_JOBS_CACHE_KEY}:${q}:${type || ""}:${categorySlug || ""}:${remote ?? ""}:${limit}:${offset}`

    const cached = await this.cache.get<PublicJobsPage>(cacheKey)
    if (cached && Array.isArray(cached.items)) return cached

    const include = { company: { select: PUBLIC_COMPANY_SELECT }, category: true }
    let result: PublicJobsPage | null = null

    if (q && this.search?.isEnabled()) {
      const hits = await this.search.searchJobs({
        q,
        type,
        categorySlug,
        remote: !!remote,
        limit,
        offset,
      })
      if (hits) {
        const rows = hits.ids.length
          ? await this.prisma.job.findMany({
              where: { id: { in: hits.ids }, ...PUBLIC_JOB_WHERE },
              include,
            })
          : []
        const byId = new Map(rows.map((job) => [job.id, job]))
        const items = hits.ids
          .map((id) => byId.get(id))
          .filter((job): job is (typeof rows)[number] => !!job)
          .map((job) => this.withRequirements(job))
        result = { items, total: hits.total }
      }
    }

    if (!result)
      result = await this.searchPublicJobsPostgres(q, type, categorySlug, remote, limit, offset)

    await this.cache.set(cacheKey, result, 120) // 2-minute TTL
    return result
  }

  private async searchPublicJobsPostgres(
    q: string,
    type: EmploymentType | undefined,
    categorySlug: string | undefined,
    remote: boolean | undefined,
    limit: number,
    offset: number
  ): Promise<PublicJobsPage> {
    const where: Prisma.JobWhereInput = { ...PUBLIC_JOB_WHERE }
    if (type) where.type = type
    if (remote) where.remote = true
    if (categorySlug) where.category = { slug: categorySlug }

    if (q) {
      const contains = { contains: q, mode: "insensitive" as const }
      where.OR = [
        { title: contains },
        { description: contains },
        { location: contains },
        { company: { name: contains } },
        { skills: { has: q } },
      ]
    }

    // Currently featured jobs (featuredUntil > now) first, then the newest publications.
    const now = new Date()
    const include = { company: { select: PUBLIC_COMPANY_SELECT }, category: true }
    const newest: Prisma.JobOrderByWithRelationInput[] = [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ]
    const featuredWhere: Prisma.JobWhereInput = { AND: [where, { featuredUntil: { gt: now } }] }
    const otherWhere: Prisma.JobWhereInput = {
      AND: [where, { OR: [{ featuredUntil: null }, { featuredUntil: { lte: now } }] }],
    }
    const [featuredTotal, otherTotal] = await Promise.all([
      this.prisma.job.count({ where: featuredWhere }),
      this.prisma.job.count({ where: otherWhere }),
    ]).then((counts) => counts.map((n) => Number(n) || 0))
    const featuredJobs =
      offset < featuredTotal
        ? await this.prisma.job.findMany({
            where: featuredWhere,
            include,
            orderBy: newest,
            skip: offset || undefined,
            take: limit,
          })
        : []
    const otherJobs =
      featuredJobs.length < limit
        ? await this.prisma.job.findMany({
            where: otherWhere,
            include,
            orderBy: newest,
            skip: Math.max(0, offset - featuredTotal) || undefined,
            take: limit - featuredJobs.length,
          })
        : []
    const items = [...featuredJobs, ...otherJobs].map((job) => this.withRequirements(job))
    return { items, total: featuredTotal + otherTotal }
  }

  // ─── Public: get single job detail ───────────────────────────────
  async getJobById(id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, ...PUBLIC_JOB_WHERE },
      include: {
        company: { select: PUBLIC_COMPANY_SELECT },
        category: true,
        postedBy: { select: { name: true, avatar: true } },
      },
    })
    if (!job) throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    return this.withRequirements(job)
  }

  // ─── Shared: get all categories ──────────────────────────────────
  async getCategories() {
    return this.prisma.jobCategory.findMany({ orderBy: { name: "asc" } })
  }

  // ─── Recruiter: hiring funnel analytics ──────────────────────────
  async getAnalytics(actor: Actor | string, jobId?: string) {
    const companyScope =
      typeof actor === "string" ? { recruiterId: actor } : await this.access.jobScopeWhere(actor)
    if (jobId && typeof actor !== "string") await this.access.jobForView(actor, jobId)
    const jobScope: Prisma.JobWhereInput = jobId
      ? { AND: [companyScope, { id: jobId }] }
      : companyScope
    const totalJobs = await this.prisma.job.count({ where: jobScope })

    const applications = await this.prisma.application.findMany({
      where: {
        job: jobScope,
        status: { notIn: [ApplicationStatus.SAVED, ApplicationStatus.SOURCED] },
      },
      select: {
        id: true,
        jobId: true,
        source: true,
        status: true,
        appliedAt: true,
        aiScore: true,
      },
      orderBy: { appliedAt: "desc" },
      take: ANALYTICS_MAX_APPLICATIONS,
    })
    // Stage history of exactly these applications (bounded; minimal columns).
    const [events, jobs] = await Promise.all([
      applications.length
        ? this.prisma.applicationStageEvent.findMany({
            where: { applicationId: { in: applications.map((a) => a.id) } },
            select: { applicationId: true, toStatus: true, createdAt: true },
            orderBy: { createdAt: "asc" },
            take: ANALYTICS_MAX_EVENTS,
          })
        : [],
      this.prisma.job.findMany({
        where: jobScope,
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
        take: ANALYTICS_MAX_JOBS,
      }),
    ])
    const funnelAnalytics = computeFunnelAnalytics(applications, events, jobs)

    const total = applications.length
    const pipeline = {
      Applied: applications.filter((a) => a.status === ApplicationStatus.APPLIED).length,
      InProcess: applications.filter((a) => a.status === ApplicationStatus.IN_PROCESS).length,
      Interviewing: applications.filter((a) => a.status === ApplicationStatus.INTERVIEWING).length,
      Offer: applications.filter((a) => a.status === ApplicationStatus.OFFER).length,
      Archived: applications.filter((a) => a.status === ApplicationStatus.ARCHIVED).length,
      Withdrawn: applications.filter((a) => a.status === ApplicationStatus.WITHDRAWN).length,
    }

    const offerRate = total > 0 ? ((pipeline.Offer / total) * 100).toFixed(1) : "0.0"
    // Only scored applications count towards the average (aiScore null = not scored yet)
    const scored = applications.filter((a) => a.aiScore !== null && a.aiScore !== undefined)
    const avgAiScore =
      scored.length > 0
        ? Math.round(scored.reduce((acc, a) => acc + a.aiScore, 0) / scored.length)
        : 0

    // Monthly breakdown (last 7 months)
    const monthly: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = d.toLocaleString("default", { month: "short" })
      monthly[key] = 0
    }
    applications.forEach((a) => {
      const key = new Date(a.appliedAt).toLocaleString("default", { month: "short" })
      if (key in monthly) monthly[key]++
    })

    return {
      totalJobs,
      totalApplications: total,
      pipeline,
      offerConversionRate: offerRate,
      avgAiMatchScore: avgAiScore,
      monthlyApplications: Object.entries(monthly).map(([month, count]) => ({
        month,
        applications: count,
      })),
      ...funnelAnalytics,
    }
  }
}
