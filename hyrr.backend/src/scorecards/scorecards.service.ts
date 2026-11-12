import { HttpStatus, Injectable, Optional } from "@nestjs/common"
import { CompanyStatus, Prisma } from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { AppException } from "../core/exceptions/app-exception"
import { MessagesGateway } from "../messages/messages.gateway"
import { PrismaService } from "../prisma/prisma.service"
import type { Recommendation } from "./dtos/scorecard.dto"

export const DEFAULT_COMPETENCIES = [
  "Technical skills",
  "Problem solving",
  "Communication",
  "Culture add",
]

const RECOMMENDATION_VALUE: Record<Recommendation, number> = {
  STRONG_YES: 2,
  YES: 1,
  NEUTRAL: 0,
  NO: -1,
  STRONG_NO: -2,
}

const SCORECARD_INCLUDE = {
  ratings: { orderBy: { competency: "asc" } },
  interviewer: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.ScorecardInclude

type ScorecardRow = Prisma.ScorecardGetPayload<{ include: typeof SCORECARD_INCLUDE }>

const fail = (message: string, status: HttpStatus, code: string) =>
  new AppException(message, status, code)

/** Average per competency, recommendation counts and a consensus label (team debrief). */
export function debrief(cards: ScorecardRow[], competencies: string[]) {
  const perCompetency = competencies.map((competency) => {
    const scores = cards.flatMap((c) =>
      c.ratings.filter((r) => r.competency === competency).map((r) => r.score)
    )
    return {
      competency,
      average: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null,
      count: scores.length,
    }
  })
  const recommendations = Object.fromEntries(
    Object.keys(RECOMMENDATION_VALUE).map((k) => [
      k,
      cards.filter((c) => c.recommendation === k).length,
    ])
  ) as Record<Recommendation, number>
  const values = cards.map((c) => RECOMMENDATION_VALUE[c.recommendation as Recommendation])
  const consensus = !values.length
    ? null
    : values.every((v) => v > 0)
      ? "HIRE"
      : values.every((v) => v < 0)
        ? "NO_HIRE"
        : "MIXED"
  const all = cards.flatMap((c) => c.ratings.map((r) => r.score))
  return {
    perCompetency,
    recommendations,
    consensus,
    overallAverage: all.length
      ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10
      : null,
  }
}

const present = (c: ScorecardRow) => ({
  id: c.id,
  interviewer: c.interviewer,
  recommendation: c.recommendation,
  overallNotes: c.overallNotes,
  submittedAt: c.submittedAt,
  updatedAt: c.updatedAt,
  ratings: c.ratings.map((r) => ({ competency: r.competency, score: r.score, notes: r.notes })),
})

/**
 * Structured interview scorecards. Blind: colleagues' scorecards (and the debrief) are hidden
 * until you submit your own; company OWNERs always see them. Never exposed to seekers.
 */
@Injectable()
export class ScorecardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Optional() private readonly gateway?: MessagesGateway
  ) {}

  /** Recruiter-side access + the caller's company role for the application's company. */
  private async context(actor: Actor, applicationId: string) {
    if (actor.role !== "RECRUITER" && actor.role !== "ADMIN")
      throw fail("Scorecards are for the hiring team", HttpStatus.FORBIDDEN, "FORBIDDEN")
    const application = await this.access.applicationFor(actor, applicationId, "view")
    const job = await this.prisma.job.findUnique({
      where: { id: application.jobId },
      select: {
        id: true,
        companyId: true,
        scorecardCompetencies: true,
        company: { select: { status: true } },
      },
    })
    if (!job) throw fail("Job not found", HttpStatus.NOT_FOUND, "JOB_NOT_FOUND")
    let role: string | null = actor.role === "ADMIN" ? "ADMIN" : null
    if (!role) {
      const member = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: job.companyId, userId: actor.userId } },
        select: { role: true },
      })
      // Legacy single-recruiter companies without member rows act as owner.
      role =
        member?.role ??
        ((await this.prisma.companyMember.count({ where: { companyId: job.companyId } })) === 0
          ? "OWNER"
          : "RECRUITER")
    }
    const competencies = job.scorecardCompetencies?.length
      ? job.scorecardCompetencies
      : DEFAULT_COMPETENCIES
    return { application, job, role, competencies }
  }

  async list(actor: Actor, applicationId: string) {
    const { role, competencies } = await this.context(actor, applicationId)
    const cards = await this.prisma.scorecard.findMany({
      where: { applicationId },
      include: SCORECARD_INCLUDE,
      orderBy: { submittedAt: "asc" },
    })
    const mine = cards.find((c) => c.interviewerId === actor.userId) ?? null
    const unlocked = !!mine || role === "OWNER" || role === "ADMIN"
    return {
      competencies,
      canSubmit: role === "OWNER" || role === "RECRUITER" || role === "HIRING_MANAGER",
      mine: mine ? present(mine) : null,
      submittedCount: cards.length,
      // Blind until you submit: no colleague content, not even the debrief.
      locked: !unlocked,
      others: unlocked ? cards.filter((c) => c !== mine).map(present) : [],
      debrief: unlocked ? debrief(cards, competencies) : null,
    }
  }

  async submit(
    actor: Actor,
    applicationId: string,
    data: {
      recommendation: Recommendation
      overallNotes: string
      ratings: { competency: string; score: number; notes?: string }[]
    }
  ) {
    const { job, role, competencies } = await this.context(actor, applicationId)
    if (!(role === "OWNER" || role === "RECRUITER" || role === "HIRING_MANAGER"))
      throw fail("Your team role can't submit scorecards", HttpStatus.FORBIDDEN, "FORBIDDEN")
    if (job.company?.status === CompanyStatus.SUSPENDED)
      throw fail(
        "Your company is suspended. Contact support to restore access.",
        HttpStatus.FORBIDDEN,
        "COMPANY_SUSPENDED"
      )
    const rated = new Map(data.ratings.map((r) => [r.competency, r]))
    const missing = competencies.filter((c) => !rated.has(c))
    const unknown = [...rated.keys()].filter((c) => !competencies.includes(c))
    if (missing.length || unknown.length)
      throw fail(
        missing.length
          ? `Rate every criterion (missing: ${missing.join(", ")})`
          : `Unknown criteria: ${unknown.join(", ")}`,
        HttpStatus.BAD_REQUEST,
        "SCORECARD_INCOMPLETE"
      )

    const card = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.scorecard.upsert({
        where: { applicationId_interviewerId: { applicationId, interviewerId: actor.userId } },
        create: {
          applicationId,
          interviewerId: actor.userId,
          recommendation: data.recommendation,
          overallNotes: data.overallNotes,
        },
        update: { recommendation: data.recommendation, overallNotes: data.overallNotes },
      })
      await tx.scorecardRating.deleteMany({ where: { scorecardId: saved.id } })
      await tx.scorecardRating.createMany({
        data: competencies.map((competency) => ({
          scorecardId: saved.id,
          competency,
          score: rated.get(competency)!.score,
          notes: rated.get(competency)!.notes || null,
        })),
      })
      return saved
    })
    const submittedCount = await this.prisma.scorecard.count({ where: { applicationId } })
    // No scorecard content on the wire: colleagues refetch (and stay blind until they submit).
    this.gateway?.emitToCompany(job.companyId, "scorecard_submitted", {
      applicationId,
      interviewerId: actor.userId,
      submittedCount,
    })
    return { id: card.id, ...(await this.list(actor, applicationId)) }
  }

  async setCompetencies(actor: Actor, jobId: string, competencies: string[]) {
    await this.access.jobForManagement(actor, jobId)
    const clean = [...new Set(competencies.map((c) => c.trim()).filter(Boolean))]
    if (!clean.length)
      throw fail("Keep at least one criterion", HttpStatus.BAD_REQUEST, "VALIDATION_FAILED")
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: { scorecardCompetencies: clean },
      select: { id: true, scorecardCompetencies: true },
    })
    return { jobId: job.id, competencies: job.scorecardCompetencies }
  }
}
