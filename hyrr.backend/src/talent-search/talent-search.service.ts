import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import {
  ApplicationSource,
  ApplicationStatus,
  JobStatus,
  NotificationAction,
  NotificationType,
  Prisma,
  UserRole,
  UserStatus,
} from "@prisma/client"
import { ApplicationsService } from "../applications/applications.service"
import { PricingService } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { AccessService, Actor } from "../core/access/access.service"
import { requireCompanyWriter } from "../core/access/company-membership"
import { AppException } from "../core/exceptions/app-exception"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { QueueService } from "../queue/queue.service"
import { SkillAssessmentsService } from "../seeker-ai/skill-assessments.service"

/** Ranking boost for people with at least one verified skill badge. */
export const VERIFIED_BOOST = 1.25

const fail = (message: string, status: HttpStatus, code: string) =>
  new AppException(message, status, code)

/** Candidate pool scanned per search (opted-in profiles only; ranked in memory). */
const POOL_LIMIT = 1000

const PROFILE_SELECT = {
  id: true,
  title: true,
  location: true,
  bio: true,
  skills: true,
  experiences: {
    select: { role: true, company: true, startDate: true, endDate: true, current: true },
    orderBy: { startDate: "desc" },
  },
  educations: { select: { school: true, degree: true, startYear: true, endYear: true } },
  user: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.SeekerProfileSelect

type ProfileRow = Prisma.SeekerProfileGetPayload<{ select: typeof PROFILE_SELECT }>

const tokens = (q?: string) => [
  ...new Set(
    (q ?? "")
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/i)
      .filter((t) => t.length >= 2)
  ),
]

/** Years of experience from the work history (overlaps counted once per month is overkill: sum). */
function yearsOf(p: ProfileRow) {
  const ms = p.experiences.reduce((sum, e) => {
    if (!e.startDate) return sum
    const end = e.current || !e.endDate ? Date.now() : e.endDate.getTime()
    return sum + Math.max(0, end - e.startDate.getTime())
  }, 0)
  return Math.round((ms / (365.25 * 86_400_000)) * 10) / 10
}

/** Relevance: title ×3, skills ×2, experience titles ×2, bio ×1 per matched term. */
export function relevance(p: ProfileRow, terms: string[]) {
  if (!terms.length) return 1
  const title = p.title.toLowerCase()
  const skills = p.skills.map((s) => s.toLowerCase())
  const exp = p.experiences.map((e) => e.role.toLowerCase()).join(" ")
  const bio = (p.bio ?? "").toLowerCase()
  let score = 0
  for (const t of terms) {
    if (title.includes(t)) score += 3
    if (skills.some((s) => s === t || s.includes(t))) score += 2
    if (exp.includes(t)) score += 2
    if (bio.includes(t)) score += 1
  }
  return score
}

/** What recruiters may see: never e-mail, phone or documents. */
function card(p: ProfileRow) {
  const latest = p.experiences[0]
  return {
    id: p.user.id,
    name: p.user.name,
    avatar: p.user.avatar,
    title: p.title,
    location: p.location,
    skills: p.skills.slice(0, 12),
    headline: latest ? `${latest.role} at ${latest.company}` : null,
    yearsExperience: yearsOf(p),
  }
}

/**
 * Talent search over seekers who opted in ("Open to recruiters"), plus paid outreach that creates a
 * SOURCED application so the existing messaging and kanban work unchanged.
 */
@Injectable()
export class TalentSearchService {
  private readonly logger = new Logger(TalentSearchService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly applications?: ApplicationsService,
    @Optional() private readonly gateway?: MessagesGateway,
    @Optional() private readonly queue?: QueueService,
    @Optional() private readonly skills?: SkillAssessmentsService
  ) {}

  private async recruiterCompany(actor: Actor) {
    if (actor.role !== UserRole.RECRUITER)
      throw fail("Talent search is for recruiters", HttpStatus.FORBIDDEN, "FORBIDDEN")
    const { companyIds } = await this.access.companyScope(actor.userId)
    const companyId =
      actor.companyId && companyIds.includes(actor.companyId) ? actor.companyId : companyIds[0]
    if (!companyId)
      throw fail("Set up your company first.", HttpStatus.FORBIDDEN, "COMPANY_REQUIRED")
    return companyId
  }

  private visibleWhere(companyId: string, extra: Prisma.SeekerProfileWhereInput = {}) {
    return {
      openToRecruiters: true,
      user: {
        status: UserStatus.ACTIVE,
        role: UserRole.SEEKER,
        companyBlocks: { none: { companyId } },
      },
      ...extra,
    } satisfies Prisma.SeekerProfileWhereInput
  }

  async search(actor: Actor, q?: string, location?: string, limit = 20) {
    const companyId = await this.recruiterCompany(actor)
    const profiles = await this.prisma.seekerProfile.findMany({
      where: this.visibleWhere(
        companyId,
        location ? { location: { contains: location, mode: "insensitive" } } : {}
      ),
      select: PROFILE_SELECT,
      orderBy: { openToRecruitersAt: "desc" },
      take: POOL_LIMIT,
    })
    const terms = tokens(q)
    const matched = profiles
      .map((p) => ({ p, score: relevance(p, terms) }))
      .filter((r) => r.score > 0)
    const verified =
      (await this.skills?.verifiedSkills(matched.map((m) => m.p.user.id))) ?? new Map()
    const ranked = matched
      .map((m) => ({
        ...m,
        verifiedSkills: (verified.get(m.p.user.id) ?? []) as string[],
        score: verified.has(m.p.user.id) ? m.score * VERIFIED_BOOST : m.score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
    const ids = ranked.map((r) => r.p.user.id)
    const contacted = ids.length
      ? await this.prisma.application.findMany({
          where: { userId: { in: ids }, job: { companyId } },
          select: { userId: true, jobId: true, status: true },
        })
      : []
    return {
      total: ranked.length,
      results: ranked.map(({ p, score, verifiedSkills }) => ({
        ...card(p),
        verifiedSkills,
        relevance: Math.round(score * 100) / 100,
        // Jobs of yours this person already applied to or was contacted about.
        existingJobIds: contacted.filter((c) => c.userId === p.user.id).map((c) => c.jobId),
      })),
    }
  }

  async profile(actor: Actor, seekerId: string) {
    const companyId = await this.recruiterCompany(actor)
    const p = await this.prisma.seekerProfile.findFirst({
      where: this.visibleWhere(companyId, { userId: seekerId }),
      select: PROFILE_SELECT,
    })
    if (!p) throw fail("This profile isn't available", HttpStatus.NOT_FOUND, "PROFILE_NOT_FOUND")
    const verified = (await this.skills?.verifiedSkills([p.user.id])) ?? new Map()
    return {
      ...card(p),
      verifiedSkills: (verified.get(p.user.id) ?? []) as string[],
      bio: p.bio,
      experiences: p.experiences,
      educations: p.educations,
    }
  }

  /** Paid outreach: debits the company wallet and creates a SOURCED application + first message. */
  async outreach(actor: Actor, seekerId: string, jobId: string, message: string) {
    const companyId = await this.recruiterCompany(actor)
    await requireCompanyWriter(this.prisma, { ...actor, companyId })
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        companyId: true,
        recruiterId: true,
        removedAt: true,
        company: { select: { name: true } },
      },
    })
    if (!job || job.companyId !== companyId)
      throw fail("Choose one of your company's jobs", HttpStatus.NOT_FOUND, "JOB_NOT_FOUND")
    if (job.status !== JobStatus.ACTIVE || job.removedAt)
      throw fail("Only open jobs can be used for outreach.", HttpStatus.CONFLICT, "JOB_NOT_ACTIVE")
    const profile = await this.prisma.seekerProfile.findFirst({
      where: this.visibleWhere(companyId, { userId: seekerId }),
      select: {
        title: true,
        location: true,
        user: { select: { id: true, name: true, email: true } },
      },
    })
    if (!profile)
      throw fail("This profile isn't available", HttpStatus.NOT_FOUND, "PROFILE_NOT_FOUND")
    const existing = await this.prisma.application.findFirst({
      where: { jobId, userId: seekerId },
      select: { status: true },
    })
    if (existing)
      throw fail(
        existing.status === ApplicationStatus.SOURCED
          ? "You already reached out to this person about this job."
          : "This person already applied to this job.",
        HttpStatus.CONFLICT,
        "ALREADY_CONTACTED"
      )
    const { outreachCost } = await this.pricing.getConfig()

    const application = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          jobId,
          userId: seekerId,
          name: profile.user.name,
          email: profile.user.email,
          title: profile.title,
          location: profile.location,
          status: ApplicationStatus.SOURCED,
          source: ApplicationSource.OUTREACH,
          tag: "Reached out",
        },
      })
      // 402 INSUFFICIENT_CREDITS rolls the application back.
      await this.wallet.debit(
        {
          companyId,
          amount: outreachCost,
          type: "OUTREACH",
          referenceId: created.id,
          actorId: actor.userId,
          note: `Outreach: ${profile.user.name} for ${job.title}`,
        },
        tx
      )
      await tx.applicationStageEvent.create({
        data: {
          applicationId: created.id,
          fromStatus: null,
          toStatus: ApplicationStatus.SOURCED,
          actorId: actor.userId,
        },
      })
      await tx.message.create({
        data: {
          applicationId: created.id,
          senderId: actor.userId,
          receiverId: seekerId,
          senderType: UserRole.RECRUITER,
          text: message,
        },
      })
      return created
    })

    const companyName = job.company?.name ?? "A company"
    await this.notifications
      .createNotification(
        seekerId,
        `👋 ${companyName} reached out about ${job.title}`,
        NotificationType.MESSAGE,
        NotificationAction.MESSAGES,
        application.id
      )
      .catch((err) => this.logger.warn(`Outreach notification failed: ${err?.message}`))
    this.gateway?.emitToUsers([seekerId], "outreach_received", {
      applicationId: application.id,
      jobId,
      jobTitle: job.title,
      companyName,
    })
    const candidate = await this.applications?.candidatePayload(application.id)
    if (candidate)
      this.gateway?.emitToCompany(companyId, "candidate_applied", {
        candidate,
        actorId: actor.userId,
      })
    return { applicationId: application.id, candidate }
  }

  /** Seeker answers an outreach: Interested → APPLIED (free; the company paid), else ARCHIVED. */
  async respond(actor: Actor, applicationId: string, interested: boolean) {
    if (actor.role !== UserRole.SEEKER)
      throw fail("Only the candidate can answer", HttpStatus.FORBIDDEN, "FORBIDDEN")
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        name: true,
        status: true,
        job: { select: { title: true, companyId: true, recruiterId: true } },
      },
    })
    if (!app || app.userId !== actor.userId)
      throw fail("Invitation not found", HttpStatus.NOT_FOUND, "NOT_FOUND")
    if (app.status !== ApplicationStatus.SOURCED)
      throw fail("You already answered this invitation.", HttpStatus.CONFLICT, "ALREADY_ANSWERED")
    const status = interested ? ApplicationStatus.APPLIED : ApplicationStatus.ARCHIVED
    const tag = interested ? "Interested" : "Not interested"
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.application.updateMany({
        where: { id: app.id, status: ApplicationStatus.SOURCED },
        data: { status, tag, ...(interested ? { appliedAt: new Date() } : {}) },
      })
      if (count !== 1)
        throw fail("You already answered this invitation.", HttpStatus.CONFLICT, "ALREADY_ANSWERED")
      await tx.applicationStageEvent.create({
        data: {
          applicationId: app.id,
          fromStatus: ApplicationStatus.SOURCED,
          toStatus: status,
          actorId: actor.userId,
        },
      })
    })
    await this.notifications
      .createNotification(
        app.job.recruiterId,
        interested
          ? `✅ ${app.name} is interested in ${app.job.title}. They're now in Applied.`
          : `${app.name} isn't interested in ${app.job.title} right now.`,
        NotificationType.APPLICATION,
        NotificationAction.APPLICATIONS,
        app.id
      )
      .catch(() => undefined)
    this.gateway?.emitApplicationUpdate(
      actor.userId,
      { applicationId: app.id, status, tag, actorId: actor.userId },
      app.job.companyId
    )
    // Now a real applicant: refresh the card (contact details unlock) and score it.
    if (interested) {
      const candidate = await this.applications?.candidatePayload(app.id)
      if (candidate)
        this.gateway?.emitToCompany(app.job.companyId, "candidate_applied", { candidate })
      if (this.queue)
        await this.queue.add(
          "ai-scoring",
          "score-application",
          { applicationId: app.id },
          { attempts: 2, jobId: `score:${app.id}` }
        )
      else this.applications?.scoreInBackground(app.id)
    }
    return { applicationId: app.id, status, tag }
  }

  /** Seeker blocks a company: hidden from its search; its pending outreach is archived. */
  async block(actor: Actor, companyId: string) {
    if (actor.role !== UserRole.SEEKER)
      throw fail("Only job seekers can block companies", HttpStatus.FORBIDDEN, "FORBIDDEN")
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    })
    if (!company) throw fail("Company not found", HttpStatus.NOT_FOUND, "COMPANY_NOT_FOUND")
    await this.prisma.$transaction(async (tx) => {
      await tx.companyBlock.upsert({
        where: { userId_companyId: { userId: actor.userId, companyId } },
        create: { userId: actor.userId, companyId },
        update: {},
      })
      await tx.application.updateMany({
        where: { userId: actor.userId, status: ApplicationStatus.SOURCED, job: { companyId } },
        data: { status: ApplicationStatus.ARCHIVED, tag: "Not interested" },
      })
    })
    return { blocked: true }
  }

  /** Block the company behind an outreach (the seeker app knows the application, not the company). */
  async blockByApplication(actor: Actor, applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { userId: true, job: { select: { companyId: true } } },
    })
    if (!app || app.userId !== actor.userId)
      throw fail("Invitation not found", HttpStatus.NOT_FOUND, "NOT_FOUND")
    return this.block(actor, app.job.companyId)
  }

  async unblock(actor: Actor, companyId: string) {
    await this.prisma.companyBlock.deleteMany({ where: { userId: actor.userId, companyId } })
    return { blocked: false }
  }

  async visibility(actor: Actor) {
    const p = await this.prisma.seekerProfile.findUnique({
      where: { userId: actor.userId },
      select: { openToRecruiters: true, openToRecruitersAt: true },
    })
    const blocks = await this.prisma.companyBlock.findMany({
      where: { userId: actor.userId },
      select: { company: { select: { id: true, name: true } } },
    })
    return {
      open: !!p?.openToRecruiters,
      since: p?.openToRecruitersAt ?? null,
      blockedCompanies: blocks.map((b) => b.company),
    }
  }

  async setVisibility(actor: Actor, open: boolean) {
    if (actor.role !== UserRole.SEEKER)
      throw fail("Only job seekers have this setting", HttpStatus.FORBIDDEN, "FORBIDDEN")
    await this.prisma.seekerProfile.update({
      where: { userId: actor.userId },
      data: { openToRecruiters: open, openToRecruitersAt: open ? new Date() : null },
    })
    return this.visibility(actor)
  }
}
