import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { AiService } from "../ai/ai.service"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { SKILL_QUESTIONS_PROMPT, skillQuestionsSchema } from "./schemas"

/** Skills that can be verified (a curated list keeps the question banks meaningful). */
export const ASSESSABLE_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "SQL",
  "Java",
  "Go",
  "Data Analysis",
  "Excel",
  "Financial Modeling",
  "Product Design",
  "Digital Marketing",
  "Project Management",
] as const

export const QUESTIONS_PER_TEST = 10
export const PASS_PERCENT = 80
export const TEST_MINUTES = 10
const GRACE_MS = 60_000
const RETRY_DAYS = 7
const VALID_MONTHS = 12
const BANK_MIN = 15
const DAY = 86_400_000

const fail = (message: string, status: HttpStatus, code: string) =>
  new AppException(message, status, code)

function sample<T>(list: T[], n: number) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

/**
 * Timed multiple-choice skill tests. Answers are graded on the server and never sent to the client;
 * >= 80% earns a "Verified" badge for 12 months (and a ranking boost in talent search).
 */
@Injectable()
export class SkillAssessmentsService {
  private readonly logger = new Logger(SkillAssessmentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  private skillOf(raw: string) {
    const skill = ASSESSABLE_SKILLS.find((s) => s.toLowerCase() === raw.trim().toLowerCase())
    if (!skill)
      throw fail("This skill can't be tested yet", HttpStatus.BAD_REQUEST, "SKILL_NOT_ASSESSABLE")
    return skill
  }

  /** Tops the bank up with AI-written questions when it's low (free for the seeker). */
  private async ensureBank(skill: string) {
    const count = await this.prisma.skillQuestion.count({ where: { skill, active: true } })
    if (count >= BANK_MIN) return
    const { result } = await this.ai.structured<{
      questions: {
        question: string
        options: string[]
        correctIndex: number
        explanation: string
      }[]
    }>(SKILL_QUESTIONS_PROMPT, `Skill: ${skill}`, skillQuestionsSchema, "skill_questions")
    await this.prisma.skillQuestion.createMany({
      data: result.questions.map((q) => ({
        skill,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
    })
  }

  /** Badges (valid passes) plus the latest attempt per skill. */
  async overview(userId: string) {
    const attempts = await this.prisma.skillAssessment.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        skill: true,
        score: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
        validUntil: true,
      },
    })
    const now = Date.now()
    return ASSESSABLE_SKILLS.map((skill) => {
      const mine = attempts.filter((a) => a.skill === skill)
      const badge = mine.find((a) => a.passed && a.validUntil && a.validUntil.getTime() > now)
      const last = mine[0]
      const retryAt =
        last && !badge && last.submittedAt
          ? new Date(last.startedAt.getTime() + RETRY_DAYS * DAY)
          : null
      return {
        skill,
        verified: !!badge,
        validUntil: badge?.validUntil ?? null,
        lastScore: last?.score ?? null,
        retryAt: retryAt && retryAt.getTime() > now ? retryAt : null,
      }
    })
  }

  async start(userId: string, rawSkill: string) {
    const skill = this.skillOf(rawSkill)
    const last = await this.prisma.skillAssessment.findFirst({
      where: { userId, skill },
      orderBy: { startedAt: "desc" },
    })
    const now = Date.now()
    if (last?.passed && last.validUntil && last.validUntil.getTime() > now)
      throw fail("You're already verified in this skill.", HttpStatus.CONFLICT, "ALREADY_VERIFIED")
    if (last && !last.submittedAt && last.expiresAt.getTime() > now) return this.present(last) // resume the open attempt
    if (last && last.startedAt.getTime() + RETRY_DAYS * DAY > now && !last.passed)
      throw fail(
        `You can retake this test on ${new Date(last.startedAt.getTime() + RETRY_DAYS * DAY).toDateString()}.`,
        HttpStatus.CONFLICT,
        "RETRY_LATER"
      )
    await this.ensureBank(skill)
    const bank = await this.prisma.skillQuestion.findMany({
      where: { skill, active: true },
      select: { id: true },
    })
    if (bank.length < QUESTIONS_PER_TEST)
      throw fail(
        "This test isn't ready yet. Please try again later.",
        HttpStatus.SERVICE_UNAVAILABLE,
        "BANK_NOT_READY"
      )
    const attempt = await this.prisma.skillAssessment.create({
      data: {
        userId,
        skill,
        questionIds: sample(bank, QUESTIONS_PER_TEST).map((q) => q.id),
        expiresAt: new Date(now + TEST_MINUTES * 60_000),
      },
    })
    return this.present(attempt)
  }

  /** The attempt with its questions and options, never the correct answers. */
  private async present(attempt: {
    id: string
    skill: string
    questionIds: string[]
    expiresAt: Date
  }) {
    const rows = await this.prisma.skillQuestion.findMany({
      where: { id: { in: attempt.questionIds } },
      select: { id: true, question: true, options: true },
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    return {
      id: attempt.id,
      skill: attempt.skill,
      expiresAt: attempt.expiresAt,
      passPercent: PASS_PERCENT,
      questions: attempt.questionIds.map((id) => byId.get(id)).filter(Boolean),
    }
  }

  async submit(userId: string, id: string, answers: number[]) {
    const attempt = await this.prisma.skillAssessment.findUnique({ where: { id } })
    if (!attempt || attempt.userId !== userId)
      throw fail("Test not found", HttpStatus.NOT_FOUND, "ASSESSMENT_NOT_FOUND")
    if (attempt.submittedAt)
      throw fail("This test was already submitted.", HttpStatus.CONFLICT, "ALREADY_SUBMITTED")
    const late = Date.now() > attempt.expiresAt.getTime() + GRACE_MS
    const rows = await this.prisma.skillQuestion.findMany({
      where: { id: { in: attempt.questionIds } },
      select: { id: true, correctIndex: true },
    })
    const correct = new Map(rows.map((r) => [r.id, r.correctIndex]))
    // Time's up: unanswered questions count as wrong (still graded, so the attempt is recorded).
    const given = attempt.questionIds.map((_, i) =>
      late ? -1 : Number.isInteger(answers[i]) ? answers[i] : -1
    )
    const right = attempt.questionIds.filter((qid, i) => correct.get(qid) === given[i]).length
    const score = Math.round((right / attempt.questionIds.length) * 100)
    const passed = !late && score >= PASS_PERCENT
    const validUntil = passed ? new Date(Date.now() + VALID_MONTHS * 30 * DAY) : null
    await this.prisma.skillAssessment.update({
      where: { id },
      data: { answers: given, score, passed, submittedAt: new Date(), validUntil },
    })
    // Only the score: revealing the right answers would let people memorise the bank.
    return {
      id,
      skill: attempt.skill,
      score,
      correct: right,
      total: attempt.questionIds.length,
      passed,
      late,
      validUntil,
    }
  }

  /** Verified skills per user (talent search ranking and cards). */
  async verifiedSkills(userIds: string[]) {
    if (!userIds.length) return new Map<string, string[]>()
    const rows = await this.prisma.skillAssessment.findMany({
      where: { userId: { in: userIds }, passed: true, validUntil: { gt: new Date() } },
      select: { userId: true, skill: true },
    })
    const map = new Map<string, string[]>()
    for (const r of rows) map.set(r.userId, [...new Set([...(map.get(r.userId) ?? []), r.skill])])
    return map
  }
}
