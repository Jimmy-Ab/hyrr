import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { tailorSchema } from "./schemas"
import { SeekerAiService } from "./seeker-ai.service"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)

const RESULT = {
  matchScore: 72,
  summary: "Good backend fit; add cloud keywords.",
  strengths: ["NestJS"],
  missingKeywords: ["Kubernetes"],
  skillGaps: ["No evidence of Kubernetes"],
  bulletSuggestions: [{ original: null, improved: "Cut API latency by [X%] with caching" }],
}

describe("SeekerAiService", () => {
  let prisma: any
  let ai: { resolveModel: jest.Mock; structured: jest.Mock; seekerCvText: jest.Mock }
  let wallet: { debit: jest.Mock; credit: jest.Mock }
  let service: SeekerAiService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    ai = {
      resolveModel: jest.fn().mockResolvedValue({ model: "gpt-4o-mini" }),
      structured: jest.fn().mockResolvedValue({ result: RESULT, model: "gpt-4o-mini" }),
      seekerCvText: jest.fn().mockResolvedValue({ text: "Backend engineer, NestJS, PostgreSQL" }),
    }
    wallet = { debit: jest.fn().mockResolvedValue({}), credit: jest.fn().mockResolvedValue({}) }
    service = new SeekerAiService(
      prisma,
      ai as any,
      wallet as any,
      { getConfig: jest.fn().mockResolvedValue({ resumeTailorCost: 2 }) } as any
    )
    prisma.job.findUnique.mockResolvedValue({
      id: "job-1",
      title: "Backend Engineer",
      status: "ACTIVE",
      description: "<p>Build APIs</p>",
      requirements: ["NestJS"],
      skills: ["Kubernetes"],
      location: "Remote",
      company: { name: "Acme" },
    })
    prisma.seekerProfile.findUnique.mockResolvedValue({
      title: "Engineer",
      location: "Nairobi",
      bio: null,
      skills: ["NestJS"],
      experiences: [],
      educations: [],
    })
    prisma.resumeTailoring.upsert.mockResolvedValue({ updatedAt: new Date() })
  })

  it("charges the price, saves the result and returns it", async () => {
    prisma.resumeTailoring.findUnique.mockResolvedValue(null)
    const res = await service.tailor("u1", "job-1")
    expect(wallet.debit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amount: 2,
        type: "AI_SEEKER_TOOL",
        referenceId: "job-1",
      })
    )
    expect(res).toMatchObject({ charged: 2, cached: false, cvUsed: true, result: RESULT })
    expect(ai.structured.mock.calls[0][1]).toContain("CANDIDATE:")
  })

  it("reopening a saved tailoring is free; rerun charges again", async () => {
    prisma.resumeTailoring.findUnique.mockResolvedValue({
      result: RESULT,
      cvUsed: true,
      updatedAt: new Date(),
    })
    expect(await service.tailor("u1", "job-1")).toMatchObject({ charged: 0, cached: true })
    expect(wallet.debit).not.toHaveBeenCalled()
    await service.tailor("u1", "job-1", true)
    expect(wallet.debit).toHaveBeenCalledTimes(1)
  })

  it("no AI provider: 503 and nothing charged", async () => {
    prisma.resumeTailoring.findUnique.mockResolvedValue(null)
    ai.resolveModel.mockResolvedValue(null)
    expect(await code(service.tailor("u1", "job-1"))).toBe("AI_DISABLED")
    expect(wallet.debit).not.toHaveBeenCalled()
  })

  it("AI failure refunds the credits", async () => {
    prisma.resumeTailoring.findUnique.mockResolvedValue(null)
    ai.structured.mockRejectedValue(Object.assign(new Error("boom"), { errorCode: "AI_FAILED" }))
    expect(await code(service.tailor("u1", "job-1"))).toBe("AI_FAILED")
    expect(wallet.credit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", amount: 2, type: "REFUND", referenceId: "job-1" })
    )
    expect(prisma.resumeTailoring.upsert).not.toHaveBeenCalled()
  })

  it("nothing to tailor (no CV, empty profile): 400 before charging", async () => {
    prisma.resumeTailoring.findUnique.mockResolvedValue(null)
    ai.seekerCvText.mockResolvedValue({ text: null })
    prisma.seekerProfile.findUnique.mockResolvedValue({
      title: "",
      location: "",
      bio: null,
      skills: [],
      experiences: [],
      educations: [],
    })
    expect(await code(service.tailor("u1", "job-1"))).toBe("PROFILE_TOO_THIN")
    expect(wallet.debit).not.toHaveBeenCalled()
  })

  it("the schema rejects out-of-range scores and oversized lists", () => {
    expect(tailorSchema.safeParse(RESULT).success).toBe(true)
    expect(tailorSchema.safeParse({ ...RESULT, matchScore: 140 }).success).toBe(false)
    expect(
      tailorSchema.safeParse({ ...RESULT, missingKeywords: Array(20).fill("x") }).success
    ).toBe(false)
  })

  describe("mock interview", () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({
      question: `Question number ${i + 1} about the role?`,
      kind: i < 3 ? "technical" : "behavioral",
      tip: "Be specific",
    }))
    const grade = {
      score: 4,
      feedback: "Clear situation and action; quantify the result.",
      star: { situation: true, task: true, action: true, result: false },
      betterAnswer: "In my last role I … which cut costs by [X%].",
    }
    const mock = (over: Record<string, any> = {}) => ({
      id: "m1",
      userId: "u1",
      jobId: "job-1",
      jobTitle: "Backend Engineer",
      company: "Acme",
      questions,
      answers: [],
      summary: null,
      status: "IN_PROGRESS",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    })

    beforeEach(() => {
      ;(service as any).pricing.getConfig.mockResolvedValue({ mockInterviewCost: 3 })
      prisma.job.findUnique.mockResolvedValue({
        id: "job-1",
        title: "Backend Engineer",
        status: "ACTIVE",
        description: "<p>APIs</p>",
        requirements: ["Go"],
        skills: ["Go"],
        company: { name: "Acme" },
        screeningQuestions: [{ question: "Why us?" }],
      })
      prisma.mockInterview.update.mockImplementation(async ({ data }: any) => mock(data))
    })

    it("start charges once and stores 5 questions", async () => {
      ai.structured.mockResolvedValue({ result: { questions }, model: "m" })
      prisma.mockInterview.create.mockResolvedValue(mock())
      const res = await service.startMock("u1", "job-1")
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 3, type: "AI_SEEKER_TOOL", referenceId: "job-1" })
      )
      expect(ai.structured.mock.calls[0][1]).toContain("Why us?")
      expect(res).toMatchObject({ charged: 3, questions })
    })

    it("an answer is graded (included in the price) and saved; repeats are refused", async () => {
      prisma.mockInterview.findUnique.mockResolvedValue(mock())
      ai.structured.mockResolvedValue({ result: grade, model: "m" })
      const res = await service.answerMock(
        "u1",
        "m1",
        0,
        "I led the migration of our payment API to Go."
      )
      expect(res.answers[0]).toMatchObject({ index: 0, score: 4 })
      expect(wallet.debit).not.toHaveBeenCalled()
      prisma.mockInterview.findUnique.mockResolvedValue(mock({ answers: res.answers }))
      expect(await code(service.answerMock("u1", "m1", 0, "x".repeat(30)))).toBe(
        "MOCK_ALREADY_ANSWERED"
      )
    })

    it("the last answer writes the summary and completes the session", async () => {
      const four = [0, 1, 2, 3].map((index) => ({ index, answer: "x".repeat(30), ...grade }))
      prisma.mockInterview.findUnique.mockResolvedValue(mock({ answers: four }))
      ai.structured.mockResolvedValueOnce({ result: grade, model: "m" }).mockResolvedValueOnce({
        result: {
          overall: 4,
          readiness: "almost",
          strengths: ["Structure"],
          improvements: ["Metrics"],
        },
        model: "m",
      })
      const res = await service.answerMock("u1", "m1", 4, "Teamwork story with a clear result.")
      expect(res.status).toBe("COMPLETED")
      expect(res.summary).toMatchObject({ readiness: "almost" })
    })

    it("other people's sessions, finished sessions and failed grading", async () => {
      prisma.mockInterview.findUnique.mockResolvedValue(mock({ userId: "u2" }))
      expect(await code(service.getMock("u1", "m1"))).toBe("MOCK_NOT_FOUND")
      prisma.mockInterview.findUnique.mockResolvedValue(mock({ status: "COMPLETED" }))
      expect(await code(service.answerMock("u1", "m1", 0, "x".repeat(30)))).toBe("MOCK_COMPLETED")
      prisma.mockInterview.findUnique.mockResolvedValue(mock())
      ai.structured.mockRejectedValue(Object.assign(new Error("x"), { errorCode: "AI_FAILED" }))
      expect(await code(service.answerMock("u1", "m1", 1, "x".repeat(30)))).toBe("AI_FAILED")
      expect(prisma.mockInterview.update).not.toHaveBeenCalled()
    })
  })

  describe("negotiation advice", () => {
    const offer = (over: Record<string, any> = {}) => ({
      id: "of-1",
      jobTitle: "Backend Engineer",
      baseSalary: 90000,
      salaryCurrency: "EUR",
      salaryPeriod: "YEAR",
      bonusAmount: null,
      equityPercentage: null,
      startDate: new Date("2026-12-01"),
      benefits: [],
      status: "SENT",
      application: { userId: "u1", job: { location: "Berlin" } },
      ...over,
    })

    it("only the candidate, only open offers", async () => {
      prisma.offer.findUnique.mockResolvedValue(offer({ application: { userId: "u2", job: {} } }))
      expect(await code(service.negotiationAdvice("u1", "of-1"))).toBe("OFFER_NOT_FOUND")
      prisma.offer.findUnique.mockResolvedValue(offer({ status: "ACCEPTED" }))
      expect(await code(service.negotiationAdvice("u1", "of-1"))).toBe("OFFER_CLOSED")
    })

    it("charges, includes market data when there is enough, and returns the advice", async () => {
      ;(service as any).pricing.getConfig.mockResolvedValue({ negotiationAdviceCost: 1 })
      prisma.offer.findUnique.mockResolvedValue(offer())
      prisma.job.findMany.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({
          salaryMin: 80000 + i * 2000,
          salaryMax: 90000 + i * 2000,
          salaryPeriod: "YEAR",
        }))
      )
      prisma.externalJob.findMany.mockResolvedValue([])
      const advice = {
        assessment: "Slightly below median.",
        counterOffer: { baseSalary: 98000, rationale: "Median is ~96k" },
        talkingPoints: ["Scope"],
        emailDraft: "Hi …",
      }
      ai.structured.mockResolvedValue({ result: advice, model: "m" })
      const res = await service.negotiationAdvice("u1", "of-1")
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1, referenceId: "of-1" })
      )
      expect(ai.structured.mock.calls[0][1]).toContain("MARKET (yearly EUR, 12 postings)")
      expect(res).toMatchObject({ charged: 1, advice, benchmark: { enoughData: true } })
    })
  })
})
