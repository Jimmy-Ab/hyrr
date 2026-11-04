import { BadRequestException, HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import { ApplicationStatus, NotificationAction, NotificationType, Prisma } from "@prisma/client"
import { AiService } from "../ai/ai.service"
import { assertEmailVerified } from "../auth/email-verification"
import { AccessService, Actor } from "../core/access/access.service"
import { EmailService } from "../core/delivery/email.service"
import { applicationStatus } from "../core/delivery/templates"
import {
  AppException,
  ForbiddenAppException,
  NotFoundAppException,
} from "../core/exceptions/app-exception"
import { CaptchaService } from "../core/security/captcha.service"
import { PUBLIC_COMPANY_SELECT } from "../jobs/public-company"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { UploadsService } from "../uploads/uploads.service"
import { CreateApplicationDto } from "./dtos/create-application.dto"
import { CreateCandidateDto, RECRUITER_STATUSES } from "./dtos/create-candidate.dto"
import { UpdateApplicationDto } from "./dtos/update-application.dto"

export const DEFAULT_PAGE_SIZE = 200
export const MAX_PAGE_SIZE = 500

export type Page = { take?: number; skip?: number }

/**
 * Seeker-facing application fields: never notes, recruiterBookmarked or any ai* field
 * (aiScore, aiSummary, aiAnalysis, aiStatus, aiModel, aiScoredAt, aiError).
 */
export const SEEKER_APPLICATION_FIELDS = {
  id: true,
  jobId: true,
  userId: true,
  name: true,
  email: true,
  phone: true,
  title: true,
  location: true,
  coverLetter: true,
  resumeUrl: true,
  status: true,
  tag: true,
  seekerBookmarked: true,
  appliedAt: true,
  updatedAt: true,
  offerAmount: true,
} satisfies Prisma.ApplicationSelect

const SEEKER_JOB_INCLUDE = {
  include: {
    company: { select: PUBLIC_COMPANY_SELECT },
    category: true,
    postedBy: { select: { name: true, avatar: true } },
  },
} satisfies Prisma.JobDefaultArgs

/**
 * Shape of one element of GET /applications/candidates (recruiter view). `include` keeps every
 * scalar column, so all ai* fields (aiScore … aiError) are part of recruiter payloads.
 */
const RECRUITER_CANDIDATE_INCLUDE = {
  job: { include: { company: true } },
  user: { select: { id: true, name: true, avatar: true } },
  calendarEvents: { orderBy: { startTime: "asc" }, take: 1 },
} satisfies Prisma.ApplicationInclude

const STATUS_TAGS: Partial<Record<ApplicationStatus, string>> = {
  [ApplicationStatus.IN_PROCESS]: "In Review",
  [ApplicationStatus.INTERVIEWING]: "Interview Stage",
  [ApplicationStatus.OFFER]: "Offer Sent",
  [ApplicationStatus.ARCHIVED]: "Not a fit",
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  IN_PROCESS: "In Process",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer Extended",
  ARCHIVED: "Archived",
  WITHDRAWN: "Withdrawn",
}

/** A PENDING analysis older than this is considered stale and may be restarted. */
export const AI_PENDING_STALE_MS = 2 * 60 * 1000

const alreadyApplied = () =>
  new AppException(
    "An application for this job already exists",
    HttpStatus.CONFLICT,
    "ALREADY_APPLIED"
  )

const withdrawnConflict = () =>
  new AppException(
    "This application was withdrawn by the candidate and can no longer be changed",
    HttpStatus.CONFLICT,
    "APPLICATION_WITHDRAWN"
  )

export function normalizePage(page: Page = {}) {
  const rawTake = Number(page.take)
  const rawSkip = Number(page.skip)
  const take =
    Number.isFinite(rawTake) && rawTake > 0
      ? Math.min(Math.floor(rawTake), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.floor(rawSkip) : 0
  return { take, skip }
}

const isRecruiterRole = (role?: string) => role === "RECRUITER" || role === "ADMIN"

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name)

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private access: AccessService,
    @Optional() private aiService?: AiService,
    @Optional() private messagesGateway?: MessagesGateway,
    @Optional() private uploads?: UploadsService,
    @Optional() private email?: EmailService,
    @Optional() private captcha?: CaptchaService
  ) {}

  /**
   * Resumes are persisted as permanent token-less upload URLs. `ownerId` (when given) must be
   * the uploader, so nobody can attach someone else's file.
   */
  private normalizeResumeUrl(
    value: string | undefined,
    ownerId: string | null
  ): string | undefined {
    if (!value || !this.uploads) return value
    const parsed = this.uploads.parseUploadUrl(value)
    if (!parsed || (ownerId && parsed.ownerId !== ownerId)) {
      throw new BadRequestException("resumeUrl must be a file you uploaded through /api/uploads")
    }
    return this.uploads.canonicalFileUrl(parsed.filename)
  }

  /** Adds a fresh download token to resumeUrl so the client can actually open the file. */
  private signResume<T>(app: T): T {
    if (!app || !this.uploads || typeof app !== "object") return app
    const a = app as any
    return a.resumeUrl ? ({ ...a, resumeUrl: this.uploads.signStoredUrl(a.resumeUrl) } as T) : app
  }

  // ─── Seeker / guest: apply to a job (C1) ──────────────────────────
  async applyToJob(jobId: string, dto: CreateApplicationDto, actor?: Actor | null, ip?: string) {
    if (actor && isRecruiterRole(actor.role)) {
      throw new ForbiddenAppException(
        "Recruiters add candidates via POST /applications/jobs/:jobId/candidates",
        "FORBIDDEN"
      )
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, title: true, recruiterId: true },
    })
    if (!job || job.status !== "ACTIVE")
      throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    // Guests prove they are human (when captcha is configured); accounts prove their e-mail.
    if (actor) await assertEmailVerified(this.prisma, actor.userId)
    else await this.captcha?.verify(dto.captchaToken, ip)
    const { captchaToken: _captcha, ...fields } = dto
    dto = { ...fields, resumeUrl: this.normalizeResumeUrl(dto.resumeUrl, actor?.userId ?? null) }

    // Guest: never link to an existing account and never reveal an existing record.
    if (!actor) {
      const duplicate = await this.prisma.application.findFirst({
        where: { jobId, email: { equals: dto.email, mode: "insensitive" } },
        select: { id: true },
      })
      if (duplicate) throw alreadyApplied()

      const app = await this.prisma.application.create({
        data: {
          ...this.applicantData(dto),
          jobId,
          userId: null,
          status: ApplicationStatus.APPLIED,
        },
        select: { id: true, status: true },
      })
      await this.afterSubmitted(app.id, job, dto.name, null)
      // Guests get status updates by e-mail; nothing else is returned to an anonymous caller.
      return { id: app.id, status: app.status }
    }

    // Authenticated seeker
    const existing = await this.prisma.application.findFirst({
      where: {
        jobId,
        OR: [
          { userId: actor.userId },
          ...(actor.email ? [{ userId: null, email: actor.email }] : []),
        ],
      },
      orderBy: { appliedAt: "desc" },
      select: { id: true, status: true },
    })
    if (existing && existing.status !== ApplicationStatus.SAVED) throw alreadyApplied()

    let applicationId: string
    if (existing) {
      // SAVED → APPLIED upgrade
      await this.prisma.$transaction([
        this.prisma.application.update({
          where: { id: existing.id },
          data: {
            ...this.applicantData(dto),
            userId: actor.userId,
            status: ApplicationStatus.APPLIED,
            appliedAt: new Date(),
          },
        }),
        this.prisma.applicationStageEvent.create({
          data: {
            applicationId: existing.id,
            fromStatus: ApplicationStatus.SAVED,
            toStatus: ApplicationStatus.APPLIED,
            actorId: actor.userId,
          },
        }),
      ])
      applicationId = existing.id
    } else {
      const created = await this.prisma.application.create({
        data: {
          ...this.applicantData(dto),
          jobId,
          userId: actor.userId,
          status: ApplicationStatus.APPLIED,
        },
        select: { id: true },
      })
      applicationId = created.id
    }

    // The SAVED→APPLIED upgrade already wrote its stage event inside the transaction.
    await this.afterSubmitted(applicationId, job, dto.name, actor.userId, { isNew: !existing })
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { ...SEEKER_APPLICATION_FIELDS, job: SEEKER_JOB_INCLUDE },
    })
    return this.signResume(application)
  }

  private applicantData(dto: CreateApplicationDto) {
    return {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      title: dto.title,
      location: dto.location,
      coverLetter: dto.coverLetter,
      resumeUrl: dto.resumeUrl,
    }
  }

  /** Stage event for fresh applications, recruiter notification and background AI scoring. */
  private async afterSubmitted(
    applicationId: string,
    job: { title: string; recruiterId: string },
    applicantName: string,
    actorId: string | null,
    { isNew = true } = {}
  ) {
    try {
      if (isNew) {
        await this.prisma.applicationStageEvent.create({
          data: { applicationId, fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId },
        })
      }
      await this.notificationsService.createNotification(
        job.recruiterId,
        `New applicant ${applicantName} applied for ${job.title}`,
        NotificationType.APPLICATION,
        NotificationAction.APPLICATIONS
      )
    } catch (err) {
      // The application itself is committed; side effects must not fail the request.
      this.logger.warn(`Post-apply side effects failed for ${applicationId}: ${err?.message}`)
    }
    this.scoreInBackground(applicationId)
  }

  /**
   * Fire-and-forget AI analysis. AiService persists the result/status and pushes
   * `candidate_ai_status` / `candidate_ai_scored` to the job's company recruiters.
   */
  scoreInBackground(applicationId: string) {
    if (!this.aiService) return
    this.aiService
      .scoreApplication(applicationId)
      .catch((err) => this.logger.warn(`AI scoring failed for ${applicationId}: ${err?.message}`))
  }

  // ─── Recruiter: (re-)run AI analysis (A1) ────────────────────────
  async analyzeApplication(id: string, actor: Actor) {
    await this.access.applicationFor(actor, id, "manage")
    const resolved = this.aiService ? await this.aiService.resolveModel() : null
    if (!resolved) {
      await this.prisma.application
        .update({ where: { id }, data: { aiStatus: "DISABLED" } })
        .catch(() => undefined)
      throw new AppException(
        "AI analysis is disabled: no AI provider API key is configured",
        HttpStatus.SERVICE_UNAVAILABLE,
        "AI_DISABLED"
      )
    }
    // Atomic claim so two clicks cannot start two runs.
    const cutoff = new Date(Date.now() - AI_PENDING_STALE_MS)
    const claimed = await this.prisma.application.updateMany({
      where: {
        id,
        OR: [{ aiStatus: null }, { aiStatus: { not: "PENDING" } }, { updatedAt: { lt: cutoff } }],
      },
      data: { aiStatus: "PENDING", aiError: null },
    })
    if (claimed.count === 0) {
      throw new AppException(
        "An AI analysis for this candidate is already running",
        HttpStatus.CONFLICT,
        "AI_ALREADY_RUNNING"
      )
    }
    this.scoreInBackground(id)
    return { applicationId: id, aiStatus: "PENDING" as const }
  }

  // ─── Recruiter: add a candidate manually (C2) ─────────────────────
  async createCandidate(jobId: string, dto: CreateCandidateDto, actor: Actor) {
    await this.access.jobForManagement(actor, jobId)
    const duplicate = await this.prisma.application.findFirst({
      where: { jobId, email: { equals: dto.email, mode: "insensitive" } },
      select: { id: true },
    })
    if (duplicate) throw alreadyApplied()
    const resumeUrl = this.normalizeResumeUrl(dto.resumeUrl, actor.userId)

    const status = dto.status ?? ApplicationStatus.APPLIED
    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          jobId,
          userId: null,
          name: dto.candidateName,
          email: dto.email,
          phone: dto.phone,
          title: dto.title ?? "",
          location: dto.location ?? "",
          resumeUrl,
          status,
          tag: STATUS_TAGS[status] ?? null,
        },
        include: RECRUITER_CANDIDATE_INCLUDE,
      })
      await tx.applicationStageEvent.create({
        data: {
          applicationId: created.id,
          fromStatus: null,
          toStatus: status,
          actorId: actor.userId,
        },
      })
      return created
    })
    this.scoreInBackground(app.id)
    return this.signResume(app)
  }

  // ─── Seeker: save a job without applying ─────────────────────────
  async saveJob(jobId: string, dto: CreateApplicationDto, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    })
    // Drafts and moderated (FLAGGED) jobs are not public; closed jobs stay bookmarkable.
    if (!job || job.status === "DRAFT" || job.status === "FLAGGED")
      throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    const select = { ...SEEKER_APPLICATION_FIELDS, job: SEEKER_JOB_INCLUDE }
    const existing = await this.prisma.application.findFirst({ where: { jobId, userId }, select })
    if (existing) return existing

    return this.prisma.application.create({
      data: {
        jobId,
        userId,
        name: dto.name,
        email: dto.email,
        title: dto.title,
        location: dto.location,
        status: ApplicationStatus.SAVED,
        seekerBookmarked: true,
      },
      select,
    })
  }

  // ─── Seeker: get my applications (C6) ────────────────────────────
  async getSeekerApplications(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return []

    // Retroactively link any applications submitted with user's email that don't have userId
    await this.prisma.application.updateMany({
      where: { email: user.email, userId: null },
      data: { userId: user.id },
    })

    const all = await this.prisma.application.findMany({
      where: { userId },
      select: {
        ...SEEKER_APPLICATION_FIELDS,
        job: SEEKER_JOB_INCLUDE,
        calendarEvents: { orderBy: { startTime: "asc" }, take: 1 },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        conversationStates: { where: { userId }, select: { clearedAt: true } },
      },
      orderBy: { appliedAt: "desc" },
    })

    // Deduplicate by jobId (legacy data may hold both a SAVED and a real application):
    // the real application wins over the SAVED bookmark.
    const byJob = new Map<string, (typeof all)[number]>()
    for (const app of all) {
      const existing = byJob.get(app.jobId)
      if (!existing) byJob.set(app.jobId, app)
      else if (
        existing.status === ApplicationStatus.SAVED &&
        app.status !== ApplicationStatus.SAVED
      )
        byJob.set(app.jobId, app)
    }
    // Hide the latest message when this seeker cleared the thread after it was sent.
    return Array.from(byJob.values()).map(({ conversationStates, ...a }) => {
      const clearedAt = conversationStates?.[0]?.clearedAt
      const messages = clearedAt
        ? (a.messages || []).filter((m) => m.createdAt > clearedAt)
        : a.messages
      return this.signResume({ ...a, messages })
    })
  }

  // ─── Recruiter: candidates for one job (Kanban board) ────────────
  async getCandidatesForJob(jobId: string, actor: Actor, page?: Page) {
    await this.access.jobForView(actor, jobId)
    const apps = await this.prisma.application.findMany({
      where: { jobId, status: { not: ApplicationStatus.SAVED } },
      include: RECRUITER_CANDIDATE_INCLUDE,
      orderBy: { appliedAt: "desc" },
      ...normalizePage(page),
    })
    return apps.map((a) => this.signResume(a))
  }

  // ─── Recruiter: candidates across the company's jobs ─────────────
  async getAllCompanyCandidates(actor: Actor, search?: string, page?: Page) {
    const and: Prisma.ApplicationWhereInput[] = [
      { status: { not: ApplicationStatus.SAVED } },
      { job: await this.access.jobScopeWhere(actor) },
    ]
    if (search?.trim()) {
      const q = search.trim()
      and.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
        ],
      })
    }
    const apps = await this.prisma.application.findMany({
      where: { AND: and },
      include: RECRUITER_CANDIDATE_INCLUDE,
      orderBy: { appliedAt: "desc" },
      ...normalizePage(page),
    })
    return apps.map((a) => this.signResume(a))
  }

  // ─── Shared: update application (C5) ─────────────────────────────
  async updateApplication(id: string, dto: UpdateApplicationDto, actor: Actor) {
    if (actor.role === "SEEKER") {
      const current = await this.access.applicationFor(actor, id, "view")
      const disallowed = Object.keys(dto).filter(
        (key) => key !== "seekerBookmarked" && dto[key] !== undefined
      )
      if (disallowed.length)
        throw new ForbiddenAppException("Seekers can only update their saved state")
      return this.prisma.application.update({
        where: { id: current.id },
        data: { seekerBookmarked: dto.seekerBookmarked },
        select: { ...SEEKER_APPLICATION_FIELDS, job: SEEKER_JOB_INCLUDE },
      })
    }

    const current = await this.access.applicationFor(actor, id, "manage")
    const { seekerBookmarked: _ignored, status, ...rest } = dto
    if (status !== undefined && !(RECRUITER_STATUSES as readonly string[]).includes(status)) {
      throw new AppException(
        "Status must be one of APPLIED, IN_PROCESS, INTERVIEWING, OFFER, ARCHIVED",
        HttpStatus.BAD_REQUEST,
        "INVALID_STATUS"
      )
    }
    if (
      current.status === ApplicationStatus.WITHDRAWN &&
      (status !== undefined || rest.offerAmount !== undefined)
    )
      throw withdrawnConflict()

    const statusChanged = status !== undefined && status !== current.status
    const data: Prisma.ApplicationUpdateInput = { ...rest }
    if (statusChanged) {
      data.status = status
      // Server-computed tag unless the recruiter supplied one explicitly
      if (rest.tag === undefined) data.tag = STATUS_TAGS[status] ?? null
    }

    const app = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id },
        data,
        include: RECRUITER_CANDIDATE_INCLUDE,
      })
      if (statusChanged) {
        await tx.applicationStageEvent.create({
          data: {
            applicationId: id,
            fromStatus: current.status,
            toStatus: status,
            actorId: actor.userId,
          },
        })
      }
      return updated
    })

    if (statusChanged && app.userId) {
      // After commit: NotificationsService also pushes the socket event and the e-mail.
      await this.notificationsService
        .createNotification(
          app.userId,
          `Your application for ${app.job.title} status updated to: ${STATUS_LABELS[status]}`,
          status === ApplicationStatus.OFFER
            ? NotificationType.OFFER
            : NotificationType.APPLICATION,
          NotificationAction.APPLICATIONS
        )
        .catch((err) => this.logger.warn(`Status notification failed: ${err?.message}`))
      this.messagesGateway?.emitApplicationUpdate(app.userId, {
        applicationId: id,
        status,
        tag: app.tag,
      })
    } else if (statusChanged && app.email && this.email) {
      // Guest applicant (no account): the status change is delivered by e-mail only.
      const content = applicationStatus({
        name: app.name,
        jobTitle: app.job.title,
        companyName: app.job.company?.name || "the hiring team",
        statusLabel: STATUS_LABELS[status],
      })
      this.email.send({ to: app.email, ...content }).catch(() => undefined)
    }
    return this.signResume(app)
  }

  // ─── Delete / unsave / withdraw (C3) ─────────────────────────────
  async deleteApplication(id: string, actor: Actor) {
    if (actor.role !== "SEEKER") {
      await this.access.applicationFor(actor, id, "manage")
      await this.prisma.application.delete({ where: { id } })
      return { id, deleted: true }
    }

    const app = await this.access.applicationFor(actor, id, "view")
    if (app.status === ApplicationStatus.SAVED) {
      await this.prisma.application.delete({ where: { id } })
      return { id, deleted: true }
    }
    if (app.status === ApplicationStatus.WITHDRAWN) {
      throw new AppException(
        "This application has already been withdrawn",
        HttpStatus.CONFLICT,
        "APPLICATION_WITHDRAWN"
      )
    }

    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id },
        data: { status: ApplicationStatus.WITHDRAWN, tag: "Withdrawn" },
      }),
      this.prisma.applicationStageEvent.create({
        data: {
          applicationId: id,
          fromStatus: app.status,
          toStatus: ApplicationStatus.WITHDRAWN,
          actorId: actor.userId,
        },
      }),
    ])
    await this.notificationsService
      .createNotification(
        app.job.recruiterId,
        `${app.name} withdrew their application for ${app.job.title}`,
        NotificationType.APPLICATION,
        NotificationAction.APPLICATIONS
      )
      .catch((err) => this.logger.warn(`Withdraw notification failed: ${err?.message}`))
    return { id, status: ApplicationStatus.WITHDRAWN }
  }

  // ─── Single application ──────────────────────────────────────────
  async getApplicationById(id: string, actor: Actor) {
    await this.access.applicationFor(actor, id, "view")
    // Messages the actor cleared ("delete for me") stay hidden.
    const state = await this.prisma.conversationState.findUnique({
      where: { applicationId_userId: { applicationId: id, userId: actor.userId } },
      select: { clearedAt: true },
    })
    const messages = {
      ...(state?.clearedAt ? { where: { createdAt: { gt: state.clearedAt } } } : {}),
      orderBy: { createdAt: "asc" as const },
    }
    if (actor.role === "SEEKER") {
      const app = await this.prisma.application.findUnique({
        where: { id },
        select: {
          ...SEEKER_APPLICATION_FIELDS,
          job: SEEKER_JOB_INCLUDE,
          messages,
          calendarEvents: { orderBy: { startTime: "asc" } },
        },
      })
      if (!app) throw new NotFoundAppException("Application not found")
      return this.signResume(app)
    }
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        ...RECRUITER_CANDIDATE_INCLUDE,
        messages,
        calendarEvents: { orderBy: { startTime: "asc" } },
      },
    })
    if (!app) throw new NotFoundAppException("Application not found")
    return this.signResume(app)
  }
}
