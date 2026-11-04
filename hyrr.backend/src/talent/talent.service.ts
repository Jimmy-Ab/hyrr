import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common"
import { CompanyMemberRole, JobStatus, NotificationType, Prisma, UserRole } from "@prisma/client"
import { CacheService } from "../cache/cache.service"
import { AccessService, Actor } from "../core/access/access.service"
import { requireCompanyWriter, resolveCompanyMembership } from "../core/access/company-membership"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { JobReportReason } from "./dtos/talent.dto"

/** Unique reporters needed before a live job is hidden pending review (JOB_REPORT_FLAG_THRESHOLD). */
export function jobReportFlagThreshold() {
  const value = Number.parseInt(process.env.JOB_REPORT_FLAG_THRESHOLD ?? "", 10)
  return Number.isFinite(value) && value >= 1 ? value : 5
}

@Injectable()
export class TalentService {
  private readonly logger = new Logger(TalentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly cache?: CacheService
  ) {}

  private db() {
    return this.prisma as any
  }
  private requireCompany(actor: Actor) {
    if (actor.role !== "RECRUITER" || !actor.companyId)
      throw new ForbiddenException("A recruiter company is required")
    return actor.companyId
  }

  private membership(actor: Actor) {
    return resolveCompanyMembership(this.prisma, actor)
  }

  /** Mutations need a RECRUITER or OWNER membership (ADMIN bypasses). */
  private async requireWriter(actor: Actor) {
    if (actor.role === "ADMIN") return null
    return requireCompanyWriter(this.prisma, actor)
  }

  private async requireOwner(actor: Actor) {
    const member = await this.membership(actor)
    if (member.role !== CompanyMemberRole.OWNER)
      throw new ForbiddenException("Only the company owner can manage the team")
    return member.companyId
  }

  /** Recruiter-side actions on an application (seekers never pass). */
  private async requireRecruiterWriteOn(actor: Actor) {
    if (actor.role !== "ADMIN" && actor.role !== "RECRUITER")
      throw new ForbiddenException("Recruiter access required")
    await this.requireWriter(actor)
  }

  private presentMember(member: any) {
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      user: member.user
        ? {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            avatar: member.user.avatar,
          }
        : null,
    }
  }

  /** C13: OWNER adds an existing recruiter (who has no company yet) by e-mail. Never grants OWNER. */
  async addTeamMember(actor: Actor, data: { email: string; role: string }) {
    const companyId = await this.requireOwner(actor)
    const role = data.role as CompanyMemberRole
    if (role === CompanyMemberRole.OWNER || !Object.values(CompanyMemberRole).includes(role))
      throw new BadRequestException("Role must be RECRUITER, HIRING_MANAGER or VIEWER")

    const target = await this.prisma.user.findFirst({
      where: { email: { equals: data.email.trim(), mode: "insensitive" } },
    })
    if (!target || target.role !== UserRole.RECRUITER)
      throw new NotFoundException("No recruiter account exists with this e-mail")
    if (target.id === actor.userId) throw new ConflictException("You are already on this team")

    // Every recruiter gets a personal company at sign-up. They may join a team only while that
    // company is still "empty": they are its only member and it has no jobs. That placeholder
    // company is removed when they join. Anyone in a real company must leave it first.
    const memberships = await this.prisma.companyMember.findMany({ where: { userId: target.id } })
    const previousCompanyIds = Array.from(
      new Set([
        ...memberships.map((m) => m.companyId),
        ...(target.companyId ? [target.companyId] : []),
      ])
    )
    if (previousCompanyIds.includes(companyId))
      throw new ConflictException("This recruiter is already on your team")
    for (const previousId of previousCompanyIds) {
      const [otherMembers, jobs] = await Promise.all([
        this.prisma.companyMember.count({
          where: { companyId: previousId, userId: { not: target.id } },
        }),
        this.prisma.job.count({ where: { companyId: previousId } }),
      ])
      if (otherMembers > 0 || jobs > 0)
        throw new ConflictException("This recruiter already belongs to a company")
    }

    const member = await this.prisma.$transaction(async (tx) => {
      for (const previousId of previousCompanyIds) {
        await tx.companyMember.deleteMany({ where: { companyId: previousId } })
        await tx.candidateLabel.deleteMany({ where: { companyId: previousId } })
        await tx.subscription.deleteMany({ where: { companyId: previousId } })
        await tx.user.updateMany({ where: { companyId: previousId }, data: { companyId: null } })
        await tx.company.deleteMany({ where: { id: previousId } })
      }
      const created = await tx.companyMember.create({
        data: { companyId, userId: target.id, role },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      })
      await tx.user.update({ where: { id: target.id }, data: { companyId } })
      return created
    })
    return this.presentMember(member)
  }

  /** C13: OWNER removes a (non-owner) member; owners cannot remove themselves. */
  async removeTeamMember(actor: Actor, memberId: string) {
    const companyId = await this.requireOwner(actor)
    const member = await this.prisma.companyMember.findUnique({ where: { id: memberId } })
    if (!member || member.companyId !== companyId)
      throw new NotFoundException("Team member not found")
    if (member.userId === actor.userId)
      throw new BadRequestException("You cannot remove yourself from the team")
    if (member.role === CompanyMemberRole.OWNER)
      throw new ForbiddenException("Owners cannot be removed")

    await this.prisma.$transaction(async (tx) => {
      await tx.companyMember.delete({ where: { id: memberId } })
      await tx.user.updateMany({
        where: { id: member.userId, companyId },
        data: { companyId: null },
      })
    })
    return { id: memberId, deleted: true }
  }

  async listTeam(actor: Actor) {
    const { companyId } = await this.membership(actor)
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: "asc" },
      take: 500,
    })
    return members.map((member) => this.presentMember(member))
  }

  async reportJob(
    actor: Actor,
    jobId: string,
    data: { reason: JobReportReason | string; details?: string }
  ) {
    if (actor.role !== UserRole.SEEKER && actor.role !== UserRole.RECRUITER)
      throw new ForbiddenException("Only job seekers and recruiters can report jobs")
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, status: true, companyId: true, recruiterId: true },
    })
    if (!job || job.status === JobStatus.DRAFT)
      throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    if (actor.role === UserRole.RECRUITER) {
      const scope = await this.access.companyScope(actor.userId)
      if (job.recruiterId === actor.userId || scope.companyIds.includes(job.companyId))
        throw new AppException(
          "You cannot report a job posted by your own company",
          HttpStatus.FORBIDDEN,
          "CANNOT_REPORT_OWN_JOB"
        )
    }

    const existing = await this.prisma.jobReport.findUnique({
      where: { jobId_reporterId: { jobId, reporterId: actor.userId } },
      select: { id: true },
    })
    if (existing) return { reported: true as const }

    const threshold = jobReportFlagThreshold()
    let flagged = false
    try {
      flagged = await this.prisma.$transaction(async (tx) => {
        await tx.jobReport.create({
          data: {
            jobId,
            reporterId: actor.userId,
            reason: data.reason,
            details: data.details?.trim() || null,
          },
        })
        if (job.status !== JobStatus.ACTIVE) return false
        const reports = await tx.jobReport.count({
          where: { jobId, status: { not: "DISMISSED" } },
        })
        if (reports < threshold) return false
        // Conditional update: concurrent reports flag (and notify) only once.
        const updated = await tx.job.updateMany({
          where: { id: jobId, status: JobStatus.ACTIVE },
          data: { status: JobStatus.FLAGGED },
        })
        return updated.count === 1
      })
    } catch (error) {
      // A concurrent duplicate report by the same user is still a successful report.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return { reported: true as const }
      throw error
    }

    if (flagged) await this.afterFlagged(job)
    return { reported: true as const }
  }

  private async afterFlagged(job: { id: string; title: string; recruiterId: string }) {
    try {
      await this.cache?.delByPattern("jobs:public*")
      await this.cache?.delByPattern("ai:featured-jobs:*")
      await this.notifications?.createNotification(
        job.recruiterId,
        `Your job "${job.title}" is under review after several reports and is hidden from job seekers`,
        NotificationType.SYSTEM,
        undefined,
        job.id
      )
    } catch (error) {
      this.logger.warn(
        `Post-flag side effects failed for job ${job.id}: ${(error as Error)?.message}`
      )
    }
  }
}
