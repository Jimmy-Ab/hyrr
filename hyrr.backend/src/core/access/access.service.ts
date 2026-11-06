import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"
import { AppException } from "../exceptions/app-exception"

export type Actor = { userId: string; role: string; email?: string; companyId?: string | null }

/** Company member roles that may mutate company data (jobs, candidates, events). */
const MANAGE_ROLES = ["OWNER", "RECRUITER"]

export type CompanyScope = {
  /** Companies whose data the actor may read. */
  companyIds: string[]
  /** Companies whose data the actor may mutate (never a SUSPENDED company). */
  manageCompanyIds: string[]
  /** Companies of the actor that an admin suspended (read-only while suspended). */
  suspendedCompanyIds: string[]
}

/** 403 COMPANY_SUSPENDED: the company was suspended by an admin, members can't make changes. */
export const companySuspended = () =>
  new AppException(
    "Your company is suspended. Contact Hyrr support to restore access.",
    HttpStatus.FORBIDDEN,
    "COMPANY_SUSPENDED"
  )

/** Centralizes resource ownership rules so controllers cannot accidentally expose cross-account data. */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the companies a recruiter belongs to (CompanyMember rows, plus the legacy
   * `User.companyId` link for accounts created before memberships existed — treated as owner).
   */
  async companyScope(userId: string): Promise<CompanyScope> {
    const [memberships, user] = await Promise.all([
      this.prisma.companyMember.findMany({
        where: { userId },
        select: { companyId: true, role: true, company: { select: { status: true } } },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true, company: { select: { status: true } } },
      }),
    ])
    const companyIds = new Set<string>()
    const manageCompanyIds = new Set<string>()
    const suspendedCompanyIds = new Set<string>()
    for (const m of memberships || []) {
      companyIds.add(m.companyId)
      if (m.company?.status === "SUSPENDED") suspendedCompanyIds.add(m.companyId)
      else if (MANAGE_ROLES.includes(m.role)) manageCompanyIds.add(m.companyId)
    }
    const legacyCompanyId = user?.companyId
    if (legacyCompanyId && !companyIds.has(legacyCompanyId)) {
      companyIds.add(legacyCompanyId)
      if (user?.company?.status === "SUSPENDED") suspendedCompanyIds.add(legacyCompanyId)
      else manageCompanyIds.add(legacyCompanyId)
    }
    return {
      companyIds: [...companyIds],
      manageCompanyIds: [...manageCompanyIds],
      suspendedCompanyIds: [...suspendedCompanyIds],
    }
  }

  /** Prisma `Job` where-clause for every job the recruiter can see (ADMIN: all). */
  async jobScopeWhere(actor: Actor): Promise<Record<string, any>> {
    if (actor.role === "ADMIN") return {}
    const { companyIds } = await this.companyScope(actor.userId)
    return {
      OR: [
        { recruiterId: actor.userId },
        ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
      ],
    }
  }

  private async jobAccess(actor: Actor, job: { recruiterId: string; companyId: string }) {
    if (actor.role === "ADMIN") return { canView: true, canManage: true, suspended: false }
    if (actor.role === "SEEKER") return { canView: false, canManage: false, suspended: false }
    const scope = await this.companyScope(actor.userId)
    const isMember = scope.companyIds.includes(job.companyId)
    const membershipAllowsManage = scope.manageCompanyIds.includes(job.companyId)
    const isPoster = job.recruiterId === actor.userId
    return {
      canView: isPoster || isMember,
      // A poster demoted to VIEWER loses mutation rights; a poster outside the company keeps them.
      // Members of a SUSPENDED company keep read access but can't change anything.
      canManage: isMember ? membershipAllowsManage : isPoster,
      suspended: isMember && (scope.suspendedCompanyIds || []).includes(job.companyId),
    }
  }

  /** 403 COMPANY_SUSPENDED when the missing manage right comes from a suspension, else FORBIDDEN. */
  private manageDenied(suspended: boolean, message: string) {
    return suspended ? companySuspended() : new ForbiddenException(message)
  }

  async applicationFor(actor: Actor, applicationId: string, mode: "view" | "manage" = "view") {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    })
    if (!application) throw new NotFoundException("Application not found")
    if (actor.role === "ADMIN") return application

    if (actor.role === "SEEKER") {
      const isSeeker =
        application.userId === actor.userId ||
        (!application.userId && !!actor.email && application.email === actor.email)
      if (mode === "view" && isSeeker) return application
      throw new ForbiddenException("You do not have access to this application")
    }

    // A SAVED record is a seeker's private bookmark, not an application: invisible to recruiters.
    if (application.status === "SAVED") throw new NotFoundException("Application not found")
    const { canView, canManage, suspended } = await this.jobAccess(actor, application.job)
    if (mode === "view" ? canView : canManage) return application
    if (mode === "manage" && canView)
      throw this.manageDenied(suspended, "You do not have access to this application")
    throw new ForbiddenException("You do not have access to this application")
  }

  /** True when the actor is the seeker who owns this application. */
  isApplicationOwner(actor: Actor, application: { userId: string | null; email: string }) {
    return (
      actor.role === "SEEKER" &&
      (application.userId === actor.userId ||
        (!application.userId && !!actor.email && application.email === actor.email))
    )
  }

  async jobForView(actor: Actor, jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundException("Job not found")
    const { canView } = await this.jobAccess(actor, job)
    if (canView) return job
    throw new ForbiddenException("You do not have access to this job")
  }

  async jobForManagement(actor: Actor, jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundException("Job not found")
    const { canManage, suspended } = await this.jobAccess(actor, job)
    if (canManage) return job
    throw this.manageDenied(suspended, "You do not have access to this job")
  }

  /**
   * Delete permission for a calendar event:
   * - the creator of the event (seeker personal events, recruiter-created events);
   * - recruiters with manage access to the linked application's job.
   * Seekers can never delete events a recruiter scheduled on their application.
   */
  async calendarEventFor(actor: Actor, eventId: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { application: { include: { job: true } } },
    })
    if (!event) throw new NotFoundException("Calendar event not found")
    if (actor.role === "ADMIN" || event.userId === actor.userId) return event
    if (actor.role !== "SEEKER" && event.application) {
      await this.applicationFor(actor, event.application.id, "manage")
      return event
    }
    throw new ForbiddenException("You do not have access to this calendar event")
  }
}
