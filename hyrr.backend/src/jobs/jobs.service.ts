import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import { ApplicationStatus, EmploymentType, JobStatus, Prisma } from "@prisma/client"
import { assertEmailVerified, requireVerifiedEmail } from "../auth/email-verification"
import { PricingService, PublishCostInput } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { CacheService } from "../cache/cache.service"
import { AccessService, Actor } from "../core/access/access.service"
import { EmailService } from "../core/delivery/email.service"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { AlertsService } from "../seeker-tools/alerts.service"
import { CreateJobDto } from "./dtos/create-job.dto"
import { UpdateJobDto } from "./dtos/update-job.dto"
import { computeFunnelAnalytics } from "./funnel-analytics"
import { evaluateJobContent, JobContent } from "./job-content-policy"
import { PUBLIC_COMPANY_SELECT } from "./public-company"

const JOB_COLORS = ["purple", "blue", "green", "orange"] as const
const PUBLIC_JOBS_CACHE_KEY = "jobs:public"
const PUBLIC_SEARCH_LIMIT = 50
/** Statuses a recruiter may set; FLAGGED is reserved for admins (moderation). */
const RECRUITER_JOB_STATUSES: JobStatus[] = [JobStatus.ACTIVE, JobStatus.CLOSED, JobStatus.DRAFT]

/** Bounds for GET /jobs/analytics (most recent applications win when exceeded). */
const ANALYTICS_MAX_APPLICATIONS = 20_000
const ANALYTICS_MAX_EVENTS = 100_000
const ANALYTICS_MAX_JOBS = 500

/** Applications counted on recruiter job cards: SAVED bookmarks are not applicants. */
/** Feature durations a recruiter may buy (days). */
export const FEATURE_DAY_OPTIONS = [7, 14, 30] as const
const DAY_MS = 24 * 60 * 60 * 1000

const APPLICANT_COUNT = {
  _count: { select: { applications: { where: { status: { not: ApplicationStatus.SAVED } } } } },
} as const

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
    @Optional() private alerts?: AlertsService
  ) {}

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

    let companyId = user?.companyId ?? null
    if (companyId) {
      const scope = await this.access.companyScope(recruiterId)
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
          salary: dto.salary,
          categoryId: dto.categoryId,
        })
      : 0
    const signupBonus = companyId ? 0 : (await this.pricing.getConfig()).signupBonus

    // One transaction: auto-created company (+ sign-up bonus), the job and its publish charge.
    // 402 INSUFFICIENT_CREDITS rolls everything back, so nothing is written.
    const job = await this.prisma.$transaction(async (tx) => {
      if (!companyId) companyId = await this.createCompanyFor(tx, recruiterId, user, signupBonus)
      const created = await tx.job.create({
        data: {
          title: dto.title,
          location: dto.location,
          type: dto.type,
          salary: dto.salary,
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
    // Alerts never block job creation (drafts are not announced)
    if (job.status === JobStatus.ACTIVE)
      this.alerts
        ?.onJobPublished(job.id)
        .catch((err) => this.logger.warn(`Job alert fan-out failed for ${job.id}: ${err?.message}`))
    return this.withRequirements(job)
  }

  /** Company + OWNER membership for a recruiter without one, plus its wallet and sign-up bonus. */
  private async createCompanyFor(
    tx: Prisma.TransactionClient,
    recruiterId: string,
    user: { name?: string | null } | null,
    signupBonus: number
  ): Promise<string> {
    const company = await tx.company.create({
      data: {
        name: user?.name ? `${user.name}'s Company` : "Hyrr Hiring Co",
        logo: user?.name ? user.name.charAt(0).toUpperCase() : "H",
        country: "United States",
      },
    })
    if (user) {
      await tx.user.update({ where: { id: recruiterId }, data: { companyId: company.id } })
      await tx.companyMember.create({
        data: { companyId: company.id, userId: recruiterId, role: "OWNER" },
      })
    }
    await this.wallet.ensureWallet(company.id, tx)
    if (signupBonus > 0)
      await this.wallet.credit(
        {
          companyId: company.id,
          amount: signupBonus,
          type: "SIGNUP_BONUS",
          referenceId: company.id,
          actorId: user ? recruiterId : null,
          note: "Welcome bonus",
        },
        tx
      )
    return company.id
  }

  // ─── Recruiter: update / close a job ─────────────────────────────
  async updateJob(jobId: string, dto: UpdateJobDto, actor: Actor) {
    const current = await this.access.jobForManagement(actor, jobId)
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

    const { salaryMin, salaryMax, employmentType, ...rest } = dto
    const data: Prisma.JobUncheckedUpdateInput = { ...rest }
    if (actor.role !== "ADMIN" && current.status === JobStatus.FLAGGED) delete data.status
    if (employmentType && !rest.type) data.type = employmentType
    if (rest.salary === undefined && (salaryMin !== undefined || salaryMax !== undefined)) {
      const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`
      data.salary =
        salaryMin !== undefined && salaryMax !== undefined
          ? `${fmt(salaryMin)} – ${fmt(salaryMax)}`
          : salaryMin !== undefined
            ? `From ${fmt(salaryMin)}`
            : `Up to ${fmt(salaryMax)}`
    }

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
            salary: (data.salary as string | undefined) ?? current.salary,
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
      return tx.job.update({
        where: { id: jobId },
        data,
        include: { company: true, category: true, ...APPLICANT_COUNT },
      })
    })
    await this.cache.delByPattern("jobs:public*")
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
    await this.prisma.job.delete({ where: { id: jobId } })
    await this.cache.delByPattern("jobs:public*")
    return { id: jobId, deleted: true }
  }

  // ─── Public: full-text search + filter (Redis cached) ────────────
  async searchPublicJobs(
    query?: string,
    type?: EmploymentType,
    categorySlug?: string,
    remote?: boolean
  ) {
    const cacheKey = `${PUBLIC_JOBS_CACHE_KEY}:${query || ""}:${type || ""}:${categorySlug || ""}:${remote ?? ""}`

    const cached = await this.cache.get<any[]>(cacheKey)
    if (cached) return cached

    const where: Prisma.JobWhereInput = { status: JobStatus.ACTIVE }
    if (type) where.type = type
    if (remote) where.remote = true
    if (categorySlug) where.category = { slug: categorySlug }

    const q = query?.trim()
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
    const featuredJobs = await this.prisma.job.findMany({
      where: { AND: [where, { featuredUntil: { gt: now } }] },
      include,
      orderBy: newest,
      take: PUBLIC_SEARCH_LIMIT,
    })
    const otherJobs =
      featuredJobs.length < PUBLIC_SEARCH_LIMIT
        ? await this.prisma.job.findMany({
            where: {
              AND: [where, { OR: [{ featuredUntil: null }, { featuredUntil: { lte: now } }] }],
            },
            include,
            orderBy: newest,
            take: PUBLIC_SEARCH_LIMIT - featuredJobs.length,
          })
        : []
    const results = [...featuredJobs, ...otherJobs].map((job) => this.withRequirements(job))

    await this.cache.set(cacheKey, results, 120) // 2-minute TTL
    return results
  }

  // ─── Public: get single job detail ───────────────────────────────
  async getJobById(id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, status: JobStatus.ACTIVE },
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
      where: { job: jobScope, status: { not: ApplicationStatus.SAVED } },
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
