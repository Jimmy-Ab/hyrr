import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { SkillLevel } from "@prisma/client"
import { AiService } from "../ai/ai.service"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import {
  SKILL_ELIGIBILITY_PROMPT,
  SKILL_QUESTIONS_PROMPT,
  skillEligibilitySchema,
  skillQuestionsSchema,
} from "./schemas"
import {
  LEVEL_LABEL,
  levelForProfile,
  NON_TESTABLE_SKILLS,
  NOT_TESTABLE_REASON,
  skillKey,
} from "./skill-eligibility"

/** Always-testable skills (curated banks); any other testable profile skill also works. */
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
/** Reports that take a question out of the bank. */
export const REPORTS_TO_DISABLE = 3
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

  /**
   * Testable or not, without spending AI (curated list, soft-skill list, cache). `null` = unknown
   * until the first test start classifies it.
   */
  private async knownEligibility(
    raw: string
  ): Promise<{ label: string; testable: boolean; reason: string | null } | null> {
    const key = skillKey(raw)
    if (!key) return { label: raw, testable: false, reason: "Add a skill name first." }
    const curated = ASSESSABLE_SKILLS.find((s) => s.toLowerCase() === key)
    if (curated) return { label: curated, testable: true, reason: null }
    if (NON_TESTABLE_SKILLS.has(key))
      return { label: raw.trim(), testable: false, reason: NOT_TESTABLE_REASON }
    const cached = await this.prisma.skillEligibility.findUnique({ where: { skill: key } })
    return cached ? { label: cached.label, testable: cached.testable, reason: cached.reason } : null
  }

  /** Eligibility for a test start: classifies unknown skills once with AI and caches the answer. */
  private async eligibility(raw: string) {
    const known = await this.knownEligibility(raw)
    if (known) return known
    const key = skillKey(raw)
    let verdict: { testable: boolean; label: string; reason: string }
    try {
      ;({ result: verdict } = await this.ai.structured<{
        testable: boolean
        label: string
        reason: string
      }>(
        SKILL_ELIGIBILITY_PROMPT,
        `Skill: ${raw.trim().slice(0, 80)}`,
        skillEligibilitySchema,
        "skill_eligibility"
      ))
    } catch (err: any) {
      this.logger.warn(`Skill eligibility check failed for "${key}": ${err?.message ?? err}`)
      throw fail(
        "We can't check this skill right now. Please try again later.",
        HttpStatus.SERVICE_UNAVAILABLE,
        "SKILL_CHECK_UNAVAILABLE"
      )
    }
    const row = await this.prisma.skillEligibility.upsert({
      where: { skill: key },
      create: {
        skill: key,
        label: verdict.label.trim() || raw.trim(),
        testable: verdict.testable,
        reason: verdict.testable ? null : verdict.reason || NOT_TESTABLE_REASON,
      },
      update: {},
    })
    return { label: row.label, testable: row.testable, reason: row.reason }
  }

  /** Tops the bank up with AI-written questions when it's low (free for the seeker). */
  /** Tops the shared bank for a skill + level up with AI-written questions when it's low (free). */
  private async ensureBank(skill: string, level: SkillLevel) {
    const count = await this.prisma.skillQuestion.count({
      where: { skill, difficulty: level, active: true },
    })
    if (count >= BANK_MIN) return
    try {
      const { result } = await this.ai.structured<{
        questions: {
          question: string
          options: string[]
          correctIndex: number
          explanation: string
        }[]
      }>(
        SKILL_QUESTIONS_PROMPT,
        `Skill: ${skill}\nLevel: ${LEVEL_LABEL[level]}`,
        skillQuestionsSchema,
        "skill_questions"
      )
      await this.prisma.skillQuestion.createMany({
        data: result.questions.map((q) => ({
          skill,
          difficulty: level,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      })
    } catch (err: any) {
      // No AI right now: the attempt falls back to the skill's other levels when possible.
      this.logger.warn(`Skill bank top-up failed for ${skill}/${level}: ${err?.message ?? err}`)
    }
  }

  /** Badges (valid passes) plus the latest attempt per skill. */
  /**
   * The seeker's profile skills first (testable or with the reason they aren't), then the curated
   * skills; each with badge, last score and retry date. Never calls AI.
   */
  async overview(userId: string) {
    const [attempts, profile] = await Promise.all([
      this.prisma.skillAssessment.findMany({
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
      }),
      this.prisma.seekerProfile.findUnique({
        where: { userId },
        select: { skills: true, yearsOfExperience: true, experiences: { select: { role: true } } },
      }),
    ])
    const level = levelForProfile(profile)
    const rows: {
      skill: string
      onProfile: boolean
      testable: boolean | null
      reason: string | null
    }[] = []
    const seen = new Set<string>()
    for (const raw of profile?.skills ?? []) {
      const known = await this.knownEligibility(raw)
      const label = known?.label ?? raw.trim()
      if (!label || seen.has(skillKey(label))) continue
      seen.add(skillKey(label))
      rows.push({
        skill: label,
        onProfile: true,
        testable: known ? known.testable : null,
        reason: known?.reason ?? null,
      })
    }
    for (const skill of ASSESSABLE_SKILLS) {
      if (seen.has(skillKey(skill))) continue
      rows.push({ skill, onProfile: false, testable: true, reason: null })
    }
    const now = Date.now()
    return rows.map((row) => {
      const mine = attempts.filter((a) => skillKey(a.skill) === skillKey(row.skill))
      const badge = mine.find((a) => a.passed && a.validUntil && a.validUntil.getTime() > now)
      const last = mine[0]
      const retryAt =
        last && !badge && last.submittedAt
          ? new Date(last.startedAt.getTime() + RETRY_DAYS * DAY)
          : null
      return {
        ...row,
        level,
        verified: !!badge,
        validUntil: badge?.validUntil ?? null,
        lastScore: last?.score ?? null,
        retryAt: retryAt && retryAt.getTime() > now ? retryAt : null,
      }
    })
  }

  async start(userId: string, rawSkill: string) {
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      select: { skills: true, yearsOfExperience: true, experiences: { select: { role: true } } },
    })
    const curated = ASSESSABLE_SKILLS.some((s) => s.toLowerCase() === skillKey(rawSkill))
    const onProfile = (profile?.skills ?? []).some((s) => skillKey(s) === skillKey(rawSkill))
    if (!curated && !onProfile)
      throw fail(
        "Add this skill to your profile to take its test.",
        HttpStatus.BAD_REQUEST,
        "SKILL_NOT_ON_PROFILE"
      )
    const verdict = await this.eligibility(rawSkill)
    if (!verdict.testable)
      throw fail(
        verdict.reason ?? NOT_TESTABLE_REASON,
        HttpStatus.BAD_REQUEST,
        "SKILL_NOT_ASSESSABLE"
      )
    const skill = verdict.label
    const level = levelForProfile(profile)
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
    await this.ensureBank(skill, level)
    // Questions at the seeker's level; when that bank is still too small, the skill's whole active
    // bank (reported/disabled questions are never sampled).
    let bank = await this.prisma.skillQuestion.findMany({
      where: { skill, difficulty: level, active: true },
      select: { id: true },
    })
    if (bank.length < QUESTIONS_PER_TEST)
      bank = await this.prisma.skillQuestion.findMany({
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
        difficulty: level,
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

  /**
   * "Report this question": only for questions of the seeker's own attempts, once per seeker.
   * The third report deactivates the question for everyone (never sampled again).
   */
  async reportQuestion(userId: string, questionId: string, reason?: string) {
    const mine = await this.prisma.skillAssessment.findFirst({
      where: { userId, questionIds: { has: questionId } },
      select: { id: true },
    })
    if (!mine) throw fail("Question not found", HttpStatus.NOT_FOUND, "QUESTION_NOT_FOUND")
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.skillQuestionReport.findUnique({
        where: { questionId_userId: { questionId, userId } },
      })
      if (existing) return { reported: true, alreadyReported: true }
      await tx.skillQuestionReport.create({
        data: { questionId, userId, reason: reason?.trim().slice(0, 300) || null },
      })
      const q = await tx.skillQuestion.update({
        where: { id: questionId },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true },
      })
      if (q.reportCount >= REPORTS_TO_DISABLE)
        await tx.skillQuestion.update({ where: { id: questionId }, data: { active: false } })
      return { reported: true, alreadyReported: false }
    })
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
