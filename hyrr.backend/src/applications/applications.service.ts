import { ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common"
import { createHash, randomBytes } from "crypto"
import { AccessService, Actor } from "../core/access/access.service"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { CreateApplicationDto } from "./dtos/create-application.dto"
import { UpdateApplicationDto } from "./dtos/update-application.dto"

@Injectable()
export class ApplicationsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private access: AccessService,
    @Optional() private messagesGateway?: MessagesGateway
  ) {}

  // ─── Seeker: apply to a job ───────────────────────────────────────
  async applyToJob(jobId: string, dto: CreateApplicationDto, userId?: string) {
    let resolvedUserId = userId || null
    if (!resolvedUserId && dto.email) {
      const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } })
      if (existingUser) resolvedUserId = existingUser.id
    }

    // Prevent duplicate applications by the same user or email
    const existing = await this.prisma.application.findFirst({
      where: {
        jobId,
        OR: [...(resolvedUserId ? [{ userId: resolvedUserId }] : []), { email: dto.email }],
      },
    })
    if (existing) return { ...existing, trackingToken: await this.createTrackingLink(existing.id) }

    const app = await this.prisma.application.create({
      data: {
        jobId,
        userId: resolvedUserId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        title: dto.title,
        location: dto.location,
        coverLetter: dto.coverLetter,
        status: "APPLIED",
      },
      include: { job: { include: { company: true } } },
    })

    if (app.job?.recruiterId) {
      await this.notificationsService.createNotification(
        app.job.recruiterId,
        `New applicant ${dto.name} applied for ${app.job.title}`
      )
    }

    return { ...app, trackingToken: await this.createTrackingLink(app.id) }
  }

  private async createTrackingLink(applicationId: string) {
    const token = randomBytes(32).toString("base64url")
    const tokenHash = createHash("sha256").update(token).digest("hex")
    await (this.prisma as any).applicationTrackingLink.create({
      data: {
        applicationId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    return token
  }

  // ─── Seeker: save a job without applying ─────────────────────────
  async saveJob(jobId: string, dto: CreateApplicationDto, userId: string) {
    const existing = await this.prisma.application.findFirst({ where: { jobId, userId } })
    if (existing) return existing

    return this.prisma.application.create({
      data: {
        jobId,
        userId,
        name: dto.name,
        email: dto.email,
        title: dto.title,
        location: dto.location,
        status: "SAVED",
        seekerBookmarked: true,
      },
      include: { job: { include: { company: true } } },
    })
  }

  // ─── Seeker: get my applications ─────────────────────────────────
  async getSeekerApplications(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return []

    // Retroactively link any applications submitted with user's email that don't have userId
    await this.prisma.application.updateMany({
      where: { email: user.email, userId: null },
      data: { userId: user.id },
    })

    const all = await this.prisma.application.findMany({
      where: {
        OR: [{ userId }, { email: user.email }],
      },
      include: {
        job: {
          include: {
            company: true,
            category: true,
            postedBy: { select: { name: true, avatar: true } },
          },
        },
        calendarEvents: { orderBy: { startTime: "asc" }, take: 1 },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { appliedAt: "desc" },
    })

    // Deduplicate by jobId: if a job has both a SAVED record and an actual applied
    // record, suppress the SAVED one — the real application takes priority.
    const byJob = new Map<string, (typeof all)[number]>()
    for (const app of all) {
      const existing = byJob.get(app.jobId)
      if (!existing) {
        byJob.set(app.jobId, app)
      } else {
        // Keep whichever is NOT SAVED; if both are SAVED keep the newer one
        const existingSaved = existing.status === "SAVED"
        const currentSaved = app.status === "SAVED"
        if (existingSaved && !currentSaved) {
          // Replace SAVED with the real application
          byJob.set(app.jobId, app)
        }
        // If existing is real and current is SAVED — keep existing (do nothing)
        // If both are real — keep the most recent (already first due to desc order)
      }
    }

    return Array.from(byJob.values())
  }

  // ─── Seeker: tracker lookup by email ─────────────────────────────
  async getApplicationsByTrackingToken(token: string) {
    if (!token) throw new NotFoundException("Tracking link is invalid or expired")
    const tokenHash = createHash("sha256").update(token).digest("hex")
    const link = await (this.prisma as any).applicationTrackingLink.findUnique({
      where: { tokenHash },
      include: { application: { include: { job: { include: { company: true } } } } },
    })
    if (!link || link.expiresAt < new Date())
      throw new NotFoundException("Tracking link is invalid or expired")
    const app = link.application
    // Public tracking never exposes messages, contact details, notes, or applicant profile data.
    return [
      {
        id: app.id,
        status: app.status,
        appliedAt: app.appliedAt,
        job: { title: app.job.title, company: { name: app.job.company.name } },
      },
    ]
  }

  // ─── Recruiter: get all candidates for a job (Kanban board) ──────
  async getCandidatesForJob(jobId: string, actor: Actor) {
    await this.access.jobForManagement(actor, jobId)
    return this.prisma.application.findMany({
      where: { jobId },
      include: {
        user: { select: { id: true, avatar: true } },
        calendarEvents: { orderBy: { startTime: "asc" }, take: 1 },
      },
      orderBy: { appliedAt: "desc" },
    })
  }

  // ─── Recruiter: get all candidates across company jobs ────────────
  async getAllCompanyCandidates(companyId?: string | null, userId?: string, search?: string) {
    const where: any = companyId
      ? { job: { companyId } }
      : userId
        ? { job: { recruiterId: userId } }
        : {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ]
    }
    return this.prisma.application.findMany({
      where,
      include: {
        job: { include: { company: true } },
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { appliedAt: "desc" },
    })
  }

  // ─── Shared: update application (move column, bookmark, offer) ────
  async updateApplication(id: string, dto: UpdateApplicationDto, actor: Actor) {
    const mode = actor.role === "SEEKER" ? "view" : "manage"
    await this.access.applicationFor(actor, id, mode)
    if (actor.role === "SEEKER") {
      const disallowed = Object.keys(dto).filter((key) => key !== "seekerBookmarked")
      if (disallowed.length)
        throw new ForbiddenException("Seekers can only update their saved state")
    }
    // Auto-set tags when moving pipeline stages
    let tag = dto.tag
    if (!tag && dto.status) {
      if (dto.status === "IN_PROCESS") tag = "In Review"
      else if (dto.status === "INTERVIEWING") tag = "Interview Stage"
      else if (dto.status === "OFFER") tag = "Offer Sent"
      else if (dto.status === "ARCHIVED") tag = "Not a fit"
      else if (dto.status === "SAVED" || dto.status === "APPLIED") tag = undefined
    }

    const previous = await this.prisma.application.findUnique({
      where: { id },
      select: { status: true },
    })
    const app = await this.prisma.application.update({
      where: { id },
      data: { ...dto, tag, status: dto.status as any },
      include: { job: { include: { company: true } } },
    })

    if (dto.status && previous?.status !== dto.status) {
      await (this.prisma as any).applicationStageEvent.create({
        data: {
          applicationId: id,
          fromStatus: previous?.status,
          toStatus: dto.status,
          actorId: actor.userId,
        },
      })
    }

    if (app.userId && dto.status) {
      const statusLabel =
        dto.status === "IN_PROCESS"
          ? "In Process"
          : dto.status === "INTERVIEWING"
            ? "Interviewing"
            : dto.status === "OFFER"
              ? "Offer Extended"
              : dto.status === "ARCHIVED"
                ? "Archived"
                : dto.status
      // DB notification
      await this.notificationsService.createNotification(
        app.userId,
        `Your application for ${app.job.title} status updated to: ${statusLabel}`
      )
      // Real-time WebSocket update so seeker's Kanban board updates live
      if (this.messagesGateway) {
        this.messagesGateway.emitApplicationUpdate(app.userId, {
          applicationId: id,
          status: dto.status,
          tag,
        })
      }
    }

    return app
  }

  // ─── Recruiter: delete candidate ─────────────────────────────────
  async deleteApplication(id: string, actor: Actor) {
    await this.access.applicationFor(actor, id, "manage")
    return this.prisma.application.delete({ where: { id } })
  }

  async getApplicationById(id: string, actor: Actor) {
    await this.access.applicationFor(actor, id, "view")
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { job: { include: { company: true } }, messages: true, calendarEvents: true },
    })
    if (!app) throw new NotFoundException("Application not found")
    return app
  }
}
