import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import { ApplicationStatus, EmploymentType, JobStatus, Prisma } from "@prisma/client"
import { assertEmailVerified, requireVerifiedEmail } from "../auth/email-verification"
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
/** Statuses a recruiter may set; FLAGGED is reserved for admins (moderation). */
const RECRUITER_JOB_STATUSES: JobStatus[] = [JobStatus.ACTIVE, JobStatus.CLOSED, JobStatus.DRAFT]

/** Bounds for GET /jobs/analytics (most recent applications win when exceeded). */
const ANALYTICS_MAX_APPLICATIONS = 20_000
const ANALYTICS_MAX_EVENTS = 100_000
const ANALYTICS_MAX_JOBS = 500

/** Applications counted on recruiter job cards: SAVED bookmarks are not applicants. */
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

    let companyId = user?.companyId
    if (!companyId) {
      const company = await this.prisma.company.create({
        data: {
          name: user?.name ? `${user.name}'s Company` : "Hyrr Hiring Co",
          logo: user?.name ? user.name.charAt(0).toUpperCase() : "H",
          country: "United States",
        },
      })
      companyId = company.id
      if (user) {
        await this.prisma.user.update({
          where: { id: recruiterId },
          data: { companyId: company.id },
        })
        await this.prisma.companyMember.create({
          data: { companyId: company.id, userId: recruiterId, role: "OWNER" },
        })
      }
    } else {
      const scope = await this.access.companyScope(recruiterId)
      if (!scope.manageCompanyIds.includes(companyId)) {
        throw new AppException(
          "Your company role does not allow posting jobs",
          HttpStatus.FORBIDDEN,
          "FORBIDDEN"
        )
      }
    }

    const job = await this.prisma.job.create({
      data: {
        title: dto.title,
        location: dto.location,
        type: dto.type,
        salary: dto.salary,
        description: dto.description,
        requirements: dto.requirements ?? [],
        skills: dto.skills,
        benefits: dto.benefits ?? [],
        featured: dto.featured ?? false,
        remote: dto.remote ?? false,
        color,
        companyId,
        recruiterId,
        categoryId: dto.categoryId,
        status,
      },
      include: { company: true, category: true },
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

    const job = await this.prisma.job.update({
      where: { id: jobId },
      data,
      include: { company: true, category: true, ...APPLICANT_COUNT },
    })
    await this.cache.delByPattern("jobs:public*")
    // A draft going live is its first publication: announce it like a newly created job.
    // (Reopening a CLOSED job is not re-announced.)
    if (current.status === JobStatus.DRAFT && job.status === JobStatus.ACTIVE)
      this.alerts
        ?.onJobPublished(job.id)
        .catch((err) => this.logger.warn(`Job alert fan-out failed for ${job.id}: ${err?.message}`))
    return this.withRequirements(job)
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

    const jobs = await this.prisma.job.findMany({
      where,
      include: { company: { select: PUBLIC_COMPANY_SELECT }, category: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 50,
    })
    const results = jobs.map((job) => this.withRequirements(job))

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
