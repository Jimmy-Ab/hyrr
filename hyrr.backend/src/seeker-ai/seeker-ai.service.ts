import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { JobStatus } from "@prisma/client"
import { AiService } from "../ai/ai.service"
import { PricingService, type MomentumConfig } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { roleTerms, summarise, yearlyMid } from "./salary-benchmark"
import {
  MOCK_GRADE_PROMPT,
  MOCK_QUESTIONS_PROMPT,
  MOCK_SUMMARY_PROMPT,
  mockGradeSchema,
  mockQuestionsSchema,
  mockSummarySchema,
  NEGOTIATION_PROMPT,
  negotiationSchema,
  TAILOR_SYSTEM_PROMPT,
  tailorSchema,
  type TailorResult,
} from "./schemas"

type MockQuestion = { question: string; kind: "technical" | "behavioral"; tip: string }
type MockAnswer = {
  index: number
  answer: string
  score: number
  feedback: string
  star: { situation: boolean; task: boolean; action: boolean; result: boolean }
  betterAnswer: string
}
const ANSWER_MIN = 20
const ANSWER_MAX = 4000

type CostKey = "resumeTailorCost" | "mockInterviewCost" | "negotiationAdviceCost"
const CV_MAX = 12_000

/** Seeker AI tools (CV tailoring, practice interviews, negotiation advice), paid in credits. */
@Injectable()
export class SeekerAiService {
  private readonly logger = new Logger(SeekerAiService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService
  ) {}

  /**
   * Charges the tool's price, runs it, and refunds automatically when the AI fails.
   * Without an AI provider nothing is charged (503 AI_DISABLED).
   */
  async chargedRun<T>(
    userId: string,
    costKey: CostKey,
    referenceId: string,
    note: string,
    run: () => Promise<T>
  ) {
    if (!(await this.ai.resolveModel()))
      throw new AppException(
        "AI isn't available right now, so nothing was charged. Please try again later.",
        HttpStatus.SERVICE_UNAVAILABLE,
        "AI_DISABLED"
      )
    const cost = (await this.pricing.getConfig())[costKey as keyof MomentumConfig] as number
    if (cost > 0)
      await this.wallet.debit({
        userId,
        amount: cost,
        type: "AI_SEEKER_TOOL",
        referenceId,
        actorId: userId,
        note,
      })
    try {
      return { value: await run(), charged: cost }
    } catch (err) {
      if (cost > 0)
        await this.wallet
          .credit({
            userId,
            amount: cost,
            type: "REFUND",
            referenceId,
            actorId: userId,
            note: `Refund: ${note} (AI failed)`,
          })
          .catch((e) =>
            this.logger.error(`Refund failed for ${userId}/${referenceId}: ${e?.message}`)
          )
      throw err
    }
  }

  /** Candidate text for prompts: active CV (if readable) plus the structured profile. */
  async candidateText(userId: string) {
    const [profile, cv] = await Promise.all([
      this.prisma.seekerProfile.findUnique({
        where: { userId },
        select: {
          title: true,
          location: true,
          bio: true,
          skills: true,
          experiences: { select: { role: true, company: true, duration: true, desc: true } },
          educations: { select: { degree: true, school: true } },
        },
      }),
      this.ai.seekerCvText(userId).catch(() => ({ text: null })),
    ])
    const lines = profile
      ? [
          `Title: ${profile.title || "-"}`,
          `Location: ${profile.location || "-"}`,
          `Skills: ${profile.skills.join(", ") || "-"}`,
          profile.bio ? `About: ${profile.bio}` : "",
          ...profile.experiences.map(
            (e) =>
              `Experience: ${e.role} at ${e.company} (${e.duration})${e.desc ? ` — ${e.desc}` : ""}`
          ),
          ...profile.educations.map((e) => `Education: ${e.degree}, ${e.school}`),
        ].filter(Boolean)
      : []
    const cvText = (cv as { text: string | null }).text?.slice(0, CV_MAX) ?? null
    const thin =
      !cvText && (!profile || (profile.skills.length === 0 && profile.experiences.length === 0))
    return {
      text: [cvText ? `CV:\n${cvText}` : "", lines.length ? `Profile:\n${lines.join("\n")}` : ""]
        .filter(Boolean)
        .join("\n\n"),
      cvUsed: !!cvText,
      thin,
    }
  }

  async getTailoring(userId: string, jobId: string) {
    const row = await this.prisma.resumeTailoring.findUnique({
      where: { userId_jobId: { userId, jobId } },
    })
    return row
      ? { jobId, result: row.result as TailorResult, cvUsed: row.cvUsed, createdAt: row.updatedAt }
      : null
  }

  /** Compares the CV/profile with a Hyrr job. Saved per job: reopening is free, `rerun` charges again. */
  async tailor(userId: string, jobId: string, rerun = false) {
    if (!rerun) {
      const saved = await this.getTailoring(userId, jobId)
      if (saved) return { ...saved, charged: 0, cached: true }
    }
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        description: true,
        requirements: true,
        skills: true,
        location: true,
        company: { select: { name: true } },
      },
    })
    if (!job || job.status === JobStatus.DRAFT)
      throw new AppException("Job not found", HttpStatus.NOT_FOUND, "JOB_NOT_FOUND")
    const candidate = await this.candidateText(userId)
    if (candidate.thin)
      throw new AppException(
        "Upload your CV in Documents or add skills and experience to your profile first, so there's something to tailor.",
        HttpStatus.BAD_REQUEST,
        "PROFILE_TOO_THIN"
      )
    const prompt = [
      `JOB: ${job.title} at ${job.company?.name ?? "the company"} (${job.location})`,
      `Requirements: ${job.requirements.join("; ") || "-"}`,
      `Skills: ${job.skills.join(", ") || "-"}`,
      `Description:\n${job.description.replace(/<[^>]+>/g, " ").slice(0, 6000)}`,
      "",
      `CANDIDATE:\n${candidate.text}`,
    ].join("\n")
    const { value, charged } = await this.chargedRun(
      userId,
      "resumeTailorCost",
      job.id,
      `CV tailoring: ${job.title}`,
      () =>
        this.ai.structured<TailorResult>(TAILOR_SYSTEM_PROMPT, prompt, tailorSchema, "cv_tailoring")
    )
    const saved = await this.prisma.resumeTailoring.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: {
        userId,
        jobId,
        result: value.result as any,
        model: value.model,
        cvUsed: candidate.cvUsed,
      },
      update: { result: value.result as any, model: value.model, cvUsed: candidate.cvUsed },
    })
    return {
      jobId,
      result: value.result,
      cvUsed: candidate.cvUsed,
      createdAt: saved.updatedAt,
      charged,
      cached: false,
    }
  }

  // ─── Mock interview ────────────────────────────────────────────────────────

  private presentMock(m: any) {
    return {
      id: m.id,
      jobId: m.jobId,
      jobTitle: m.jobTitle,
      company: m.company,
      status: m.status,
      questions: m.questions as MockQuestion[],
      answers: m.answers as MockAnswer[],
      summary: m.summary,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }
  }

  /** Starts a practice interview for a Hyrr job: 5 tailored questions (charges mockInterviewCost). */
  async startMock(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        description: true,
        requirements: true,
        skills: true,
        company: { select: { name: true } },
        screeningQuestions: { select: { question: true } },
      },
    })
    if (!job || job.status === JobStatus.DRAFT)
      throw new AppException("Job not found", HttpStatus.NOT_FOUND, "JOB_NOT_FOUND")
    const prompt = [
      `JOB: ${job.title} at ${job.company?.name ?? "the company"}`,
      `Requirements: ${job.requirements.join("; ") || "-"}`,
      `Skills: ${job.skills.join(", ") || "-"}`,
      job.screeningQuestions.length
        ? `The company's screening questions: ${job.screeningQuestions.map((q) => q.question).join(" | ")}`
        : "",
      `Description:\n${job.description.replace(/<[^>]+>/g, " ").slice(0, 5000)}`,
    ]
      .filter(Boolean)
      .join("\n")
    const { value, charged } = await this.chargedRun(
      userId,
      "mockInterviewCost",
      job.id,
      `Practice interview: ${job.title}`,
      () =>
        this.ai.structured<{ questions: MockQuestion[] }>(
          MOCK_QUESTIONS_PROMPT,
          prompt,
          mockQuestionsSchema,
          "mock_questions"
        )
    )
    const mock = await this.prisma.mockInterview.create({
      data: {
        userId,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company?.name ?? null,
        questions: value.result.questions as any,
      },
    })
    return { ...this.presentMock(mock), charged }
  }

  async listMocks(userId: string) {
    const rows = await this.prisma.mockInterview.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    })
    return rows.map((r) => this.presentMock(r))
  }

  private async ownMock(userId: string, id: string) {
    const mock = await this.prisma.mockInterview.findUnique({ where: { id } })
    if (!mock || mock.userId !== userId)
      throw new AppException("Practice interview not found", HttpStatus.NOT_FOUND, "MOCK_NOT_FOUND")
    return mock
  }

  async getMock(userId: string, id: string) {
    return this.presentMock(await this.ownMock(userId, id))
  }

  /**
   * Grades one answer (STAR feedback; included in the session price). After the last answer a
   * summary is written and the session completes. A failed grading isn't saved, so it can be retried.
   */
  async answerMock(userId: string, id: string, index: number, answer: string) {
    const mock = await this.ownMock(userId, id)
    if (mock.status === "COMPLETED")
      throw new AppException(
        "This practice interview is finished.",
        HttpStatus.CONFLICT,
        "MOCK_COMPLETED"
      )
    const questions = mock.questions as MockQuestion[]
    const answers = mock.answers as MockAnswer[]
    const text = answer.trim()
    if (!questions[index])
      throw new AppException("Unknown question", HttpStatus.BAD_REQUEST, "MOCK_QUESTION_NOT_FOUND")
    if (answers.some((a) => a.index === index))
      throw new AppException(
        "You already answered this question.",
        HttpStatus.CONFLICT,
        "MOCK_ALREADY_ANSWERED"
      )
    if (text.length < ANSWER_MIN || text.length > ANSWER_MAX)
      throw new AppException(
        `Write between ${ANSWER_MIN} and ${ANSWER_MAX} characters.`,
        HttpStatus.BAD_REQUEST,
        "VALIDATION_FAILED"
      )
    const q = questions[index]
    const graded = await this.ai.structured<Omit<MockAnswer, "index" | "answer">>(
      MOCK_GRADE_PROMPT,
      `JOB: ${mock.jobTitle}\nQUESTION (${q.kind}): ${q.question}\nANSWER:\n${text}`,
      mockGradeSchema,
      "mock_grade"
    )
    const next: MockAnswer[] = [...answers, { index, answer: text, ...graded.result }].sort(
      (a, b) => a.index - b.index
    )
    let summary: unknown = null
    if (next.length === questions.length) {
      const transcript = next
        .map(
          (a) =>
            `Q${a.index + 1}: ${questions[a.index].question}\nScore ${a.score}/5. ${a.feedback}`
        )
        .join("\n\n")
      summary = await this.ai
        .structured(
          MOCK_SUMMARY_PROMPT,
          `JOB: ${mock.jobTitle}\n\n${transcript}`,
          mockSummarySchema,
          "mock_summary"
        )
        .then((r) => r.result)
        .catch(() => {
          // The answers are kept; the summary falls back to the average.
          const avg = Math.round(next.reduce((s, a) => s + a.score, 0) / next.length)
          return {
            overall: avg,
            readiness: avg >= 4 ? "ready" : avg >= 3 ? "almost" : "needs_practice",
            strengths: [],
            improvements: [],
          }
        })
    }
    const saved = await this.prisma.mockInterview.update({
      where: { id },
      data: {
        answers: next as any,
        ...(summary ? { summary: summary as any, status: "COMPLETED" as const } : {}),
      },
    })
    return this.presentMock(saved)
  }

  // ─── Salary benchmark (free) and negotiation advice (paid) ─────────────────

  /**
   * Yearly salary percentiles for a role from real postings (Hyrr jobs + jobs from the web) in one
   * currency. No currency conversion: only postings in `currency` count. Fewer than 10 → no figures.
   */
  async salaryBenchmark(title: string, currency: string, location?: string) {
    const terms = roleTerms(title)
    if (!terms.length) return { title, currency, terms, ...summarise([]) }
    const titleWhere = {
      AND: terms.map((t) => ({ title: { contains: t, mode: "insensitive" as const } })),
    }
    const locWhere = location?.trim()
      ? { location: { contains: location.trim(), mode: "insensitive" as const } }
      : {}
    const [hyrr, web] = await Promise.all([
      this.prisma.job.findMany({
        where: {
          ...titleWhere,
          ...locWhere,
          salaryCurrency: currency,
          status: { not: JobStatus.DRAFT },
        },
        select: { salaryMin: true, salaryMax: true, salaryPeriod: true },
        take: 2000,
      }),
      this.prisma.externalJob.findMany({
        where: { ...titleWhere, ...locWhere, salaryCurrency: currency },
        select: { salaryMin: true, salaryMax: true },
        take: 2000,
      }),
    ])
    const values = [...hyrr, ...web.map((w) => ({ ...w, salaryPeriod: "YEAR" }))]
      .map(yearlyMid)
      .filter((v): v is number => v !== null && v > 0)
    return {
      title,
      currency,
      terms,
      location: location?.trim() || null,
      period: "YEAR",
      ...summarise(values),
    }
  }

  /** AI advice on a received offer: assessment, counter-offer, talking points, e-mail draft. */
  async negotiationAdvice(userId: string, offerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { application: { select: { userId: true, job: { select: { location: true } } } } },
    })
    if (!offer || offer.application.userId !== userId)
      throw new AppException("Offer not found", HttpStatus.NOT_FOUND, "OFFER_NOT_FOUND")
    if (offer.status !== "SENT")
      throw new AppException(
        "Advice is for offers you haven't answered yet.",
        HttpStatus.CONFLICT,
        "OFFER_CLOSED"
      )
    const [benchmark, candidate] = await Promise.all([
      this.salaryBenchmark(offer.jobTitle, offer.salaryCurrency, undefined),
      this.candidateText(userId),
    ])
    const yearly = yearlyMid({
      salaryMin: offer.baseSalary,
      salaryMax: offer.baseSalary,
      salaryPeriod: offer.salaryPeriod,
    })
    const prompt = [
      `OFFER: ${offer.jobTitle}; base ${offer.baseSalary} ${offer.salaryCurrency} per ${offer.salaryPeriod.toLowerCase()} (≈${yearly} per year)` +
        `${offer.bonusAmount ? `; bonus ${offer.bonusAmount}` : ""}${offer.equityPercentage ? `; equity ${offer.equityPercentage}%` : ""}` +
        `; start ${offer.startDate.toISOString().slice(0, 10)}; benefits: ${offer.benefits.join(", ") || "-"}`,
      benchmark.enoughData
        ? `MARKET (yearly ${offer.salaryCurrency}, ${benchmark.samples} postings): p25 ${benchmark.p25}, median ${benchmark.p50}, p75 ${benchmark.p75}`
        : `MARKET: not enough postings in ${offer.salaryCurrency} for this role (${benchmark.samples}); rely on the offer and background.`,
      `CANDIDATE:\n${candidate.text || "No profile details."}`,
    ].join("\n\n")
    const { value, charged } = await this.chargedRun(
      userId,
      "negotiationAdviceCost",
      offer.id,
      `Negotiation advice: ${offer.jobTitle}`,
      () =>
        this.ai.structured<any>(NEGOTIATION_PROMPT, prompt, negotiationSchema, "negotiation_advice")
    )
    return { offerId, benchmark, advice: value.result, charged }
  }
}
