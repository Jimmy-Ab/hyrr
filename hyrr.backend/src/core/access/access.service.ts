import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"

export type Actor = { userId: string; role: string; email?: string; companyId?: string | null }

/** Centralizes resource ownership rules so controllers cannot accidentally expose cross-account data. */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async applicationFor(actor: Actor, applicationId: string, mode: "view" | "manage" = "view") {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    })
    if (!application) throw new NotFoundException("Application not found")
    if (actor.role === "ADMIN") return application

    const isSeeker =
      application.userId === actor.userId ||
      (!application.userId && application.email === actor.email)
    const membership = await this.companyRole(actor.userId, application.job.companyId)
    const isRecruiter =
      application.job.recruiterId === actor.userId ||
      (!!actor.companyId && application.job.companyId === actor.companyId) ||
      !!membership

    const canManage = isRecruiter && membership?.role !== "VIEWER"
    if (mode === "view" ? isSeeker || isRecruiter : canManage) return application
    throw new ForbiddenException("You do not have access to this application")
  }

  async jobForManagement(actor: Actor, jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundException("Job not found")
    const membership = await this.companyRole(actor.userId, job.companyId)
    if (
      actor.role === "ADMIN" ||
      job.recruiterId === actor.userId ||
      (!!actor.companyId && job.companyId === actor.companyId) ||
      (membership && membership.role !== "VIEWER")
    )
      return job
    throw new ForbiddenException("You do not have access to this job")
  }

  async calendarEventFor(actor: Actor, eventId: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { application: { include: { job: true } } },
    })
    if (!event) throw new NotFoundException("Calendar event not found")
    if (actor.role === "ADMIN" || event.userId === actor.userId) return event
    if (event.application) {
      await this.applicationFor(actor, event.application.id, "view")
      return event
    }
    throw new ForbiddenException("You do not have access to this calendar event")
  }

  private async companyRole(userId: string, companyId: string) {
    return (this.prisma as any).companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    })
  }
}
