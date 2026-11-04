import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { AlertFrequency, ApplicationStatus, CompanyMemberRole, UserRole } from "@prisma/client"
import { createHash, randomBytes } from "crypto"
import { AccessService, Actor } from "../core/access/access.service"
import { requireCompanyWriter, resolveCompanyMembership } from "../core/access/company-membership"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class TalentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService
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

  async addScreeningQuestion(
    actor: Actor,
    jobId: string,
    data: { question: string; required?: boolean }
  ) {
    await this.requireRecruiterWriteOn(actor)
    await this.access.jobForManagement(actor, jobId)
    const count = await this.db().screeningQuestion.count({ where: { jobId } })
    return this.db().screeningQuestion.create({
      data: { jobId, question: data.question, required: !!data.required, position: count },
    })
  }

  getScreeningQuestions(jobId: string) {
    return this.db().screeningQuestion.findMany({ where: { jobId }, orderBy: { position: "asc" } })
  }

  async submitAnswer(actor: Actor, applicationId: string, questionId: string, answer: string) {
    const application = await this.access.applicationFor(actor, applicationId, "view")
    if (actor.role !== "SEEKER")
      throw new ForbiddenException("Only the applicant can answer screening questions")
    const question = await this.db().screeningQuestion.findUnique({ where: { id: questionId } })
    if (!question || question.jobId !== application.jobId)
      throw new NotFoundException("Screening question not found")
    return this.db().screeningAnswer.upsert({
      where: { applicationId_questionId: { applicationId, questionId } },
      update: { answer },
      create: { applicationId, questionId, answer },
    })
  }

  async createLabel(actor: Actor, data: { name: string; color?: string }) {
    const { companyId } = await requireCompanyWriter(this.prisma, actor)
    return this.db().candidateLabel.upsert({
      where: { companyId_name: { companyId, name: data.name } },
      update: { color: data.color || "purple" },
      create: { companyId, name: data.name, color: data.color || "purple" },
    })
  }

  async listLabels(actor: Actor) {
    return this.db().candidateLabel.findMany({
      where: { companyId: this.requireCompany(actor) },
      orderBy: { name: "asc" },
      take: 500,
    })
  }

  async attachLabel(actor: Actor, applicationId: string, labelId: string) {
    await this.requireRecruiterWriteOn(actor)
    const application = await this.access.applicationFor(actor, applicationId, "manage")
    const label = await this.db().candidateLabel.findUnique({ where: { id: labelId } })
    if (!label || label.companyId !== application.job.companyId)
      throw new ForbiddenException("Label is not available for this application")
    return this.db().applicationLabel.upsert({
      where: { applicationId_labelId: { applicationId, labelId } },
      update: {},
      create: { applicationId, labelId },
    })
  }

  async addNote(actor: Actor, applicationId: string, body: string) {
    await this.requireRecruiterWriteOn(actor)
    await this.access.applicationFor(actor, applicationId, "manage")
    return this.db().applicationNote.create({
      data: { applicationId, authorId: actor.userId, body },
    })
  }

  async listNotes(actor: Actor, applicationId: string) {
    if (actor.role !== "ADMIN" && actor.role !== "RECRUITER")
      throw new ForbiddenException("Recruiter access required")
    await this.access.applicationFor(actor, applicationId, "view")
    return this.db().applicationNote.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
    })
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
        await tx.interviewAvailability.deleteMany({ where: { companyId: previousId } })
        await tx.companyEmailTemplate.deleteMany({ where: { companyId: previousId } })
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

  async createTrackingLink(actor: Actor, applicationId: string) {
    await this.access.applicationFor(actor, applicationId, "view")
    const token = randomBytes(32).toString("base64url")
    const tokenHash = createHash("sha256").update(token).digest("hex")
    await this.db().applicationTrackingLink.create({
      data: {
        applicationId,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    return { token, expiresInDays: 30 }
  }

  async publicTrackingStatus(token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex")
    const link = await this.db().applicationTrackingLink.findUnique({
      where: { tokenHash },
      include: { application: { include: { job: { include: { company: true } } } } },
    })
    if (!link || link.expiresAt < new Date())
      throw new NotFoundException("Tracking link is invalid or expired")
    return {
      status: link.application.status,
      appliedAt: link.application.appliedAt,
      job: { title: link.application.job.title, company: link.application.job.company.name },
    }
  }

  async createAlert(actor: Actor, data: any) {
    if (actor.role !== "SEEKER") throw new ForbiddenException("Only seekers can create job alerts")
    return this.db().jobAlert.create({
      data: {
        userId: actor.userId,
        name: data.name,
        keywords: data.keywords || [],
        locations: data.locations || [],
        jobTypes: data.jobTypes || [],
        minSalary: data.minSalary,
        remoteOnly: !!data.remoteOnly,
        frequency: data.frequency || AlertFrequency.DAILY,
      },
    })
  }

  /** Produces review-only suggestions; it never mutates a seeker profile automatically. */
  async resumeSuggestions(actor: Actor, resumeText: string) {
    if (actor.role !== "SEEKER") throw new ForbiddenException("Only seekers can parse a resume")
    const lines = resumeText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const email = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
    const phone = resumeText.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]
    const urlMatches = resumeText.match(/https?:\/\/[^\s]+/g) || []
    const skills = [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "Java",
      "SQL",
      "PostgreSQL",
      "AWS",
      "Docker",
      "Figma",
      "Excel",
    ].filter((skill) => new RegExp(`\\b${skill.replace(".", "\\.")}\\b`, "i").test(resumeText))
    return {
      suggested: {
        title:
          lines.find((line) =>
            /engineer|designer|developer|manager|analyst|specialist/i.test(line)
          ) || undefined,
        email,
        phone,
        website: urlMatches.find((url) => !/github\.com|linkedin\.com/i.test(url)),
        github: urlMatches.find((url) => /github\.com/i.test(url)),
        linkedin: urlMatches.find((url) => /linkedin\.com/i.test(url)),
        skills,
      },
      requiresConfirmation: true,
    }
  }

  async listAlerts(actor: Actor) {
    return this.db().jobAlert.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  }
  async createSavedSearch(actor: Actor, data: any) {
    return this.db().savedSearch.create({
      data: { userId: actor.userId, name: data.name, query: data.query, filters: data.filters },
    })
  }
  async listSavedSearches(actor: Actor) {
    return this.db().savedSearch.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  }

  async reportJob(actor: Actor, jobId: string, data: { reason: string; details?: string }) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundException("Job not found")
    return this.db().jobReport.upsert({
      where: { jobId_reporterId: { jobId, reporterId: actor.userId } },
      update: { reason: data.reason, details: data.details, status: "PENDING" },
      create: { jobId, reporterId: actor.userId, reason: data.reason, details: data.details },
    })
  }

  async analytics(actor: Actor) {
    const companyId = this.requireCompany(actor)
    const grouped = await this.prisma.application.groupBy({
      by: ["status"],
      where: { job: { companyId }, status: { not: ApplicationStatus.SAVED } },
      _count: { _all: true },
    })
    const totals: Record<string, number> = {}
    let total = 0
    for (const row of grouped) {
      totals[row.status] = row._count._all
      total += row._count._all
    }
    const hired = totals[ApplicationStatus.OFFER] || 0
    return {
      totalApplications: total,
      stages: totals,
      offerRate: total ? Number(((hired / total) * 100).toFixed(1)) : 0,
    }
  }

  async subscription(actor: Actor) {
    const companyId = this.requireCompany(actor)
    return this.db().subscription.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    })
  }
}
