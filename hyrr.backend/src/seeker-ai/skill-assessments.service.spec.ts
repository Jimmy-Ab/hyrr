import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { SkillAssessmentsService } from "./skill-assessments.service"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)
const bank = Array.from({ length: 15 }, (_, i) => ({
  id: `q${i}`,
  question: `Question ${i}?`,
  options: ["a", "b", "c", "d"],
  correctIndex: i % 4,
}))

describe("SkillAssessmentsService", () => {
  let prisma: any
  let ai: { structured: jest.Mock }
  let service: SkillAssessmentsService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    ai = { structured: jest.fn() }
    service = new SkillAssessmentsService(prisma, ai as any)
    prisma.skillQuestion.count.mockResolvedValue(15)
    prisma.skillQuestion.findMany.mockImplementation(async ({ where, select }: any) =>
      bank
        .filter((q) => !where.id || where.id.in.includes(q.id))
        .map((q) => Object.fromEntries(Object.keys(select).map((k) => [k, (q as any)[k]])))
    )
    prisma.skillAssessment.create.mockImplementation(async ({ data }: any) => ({
      id: "t1",
      ...data,
    }))
  })

  it("only curated skills; never sends the correct answers", async () => {
    expect(await code(service.start("u1", "Astrology"))).toBe("SKILL_NOT_ASSESSABLE")
    prisma.skillAssessment.findFirst.mockResolvedValue(null)
    const test = await service.start("u1", "sql")
    expect(test.skill).toBe("SQL")
    expect(test.questions).toHaveLength(10)
    expect(JSON.stringify(test)).not.toContain("correctIndex")
  })

  it("tops up a thin bank with AI questions (free)", async () => {
    prisma.skillAssessment.findFirst.mockResolvedValue(null)
    prisma.skillQuestion.count.mockResolvedValue(3)
    ai.structured.mockResolvedValue({
      result: { questions: bank.map((q) => ({ ...q, explanation: "because" })) },
    })
    await service.start("u1", "Python")
    expect(prisma.skillQuestion.createMany.mock.calls[0][0].data).toHaveLength(15)
  })

  const attempt = (over: Record<string, any> = {}) => ({
    id: "t1",
    userId: "u1",
    skill: "SQL",
    questionIds: bank.slice(0, 10).map((q) => q.id),
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 600_000),
    submittedAt: null,
    passed: false,
    ...over,
  })

  it("grades on the server: 80% passes with a 12-month badge", async () => {
    prisma.skillAssessment.findUnique.mockResolvedValue(attempt())
    const answers = bank
      .slice(0, 10)
      .map((q, i) => (i < 8 ? q.correctIndex : (q.correctIndex + 1) % 4))
    const res = await service.submit("u1", "t1", answers)
    expect(res).toMatchObject({ score: 80, correct: 8, passed: true, late: false })
    expect(res.validUntil).toBeInstanceOf(Date)
  })

  it("late submissions fail; resubmitting and other people's tests are refused", async () => {
    prisma.skillAssessment.findUnique.mockResolvedValue(
      attempt({ expiresAt: new Date(Date.now() - 120_000) })
    )
    const res = await service.submit(
      "u1",
      "t1",
      bank.slice(0, 10).map((q) => q.correctIndex)
    )
    expect(res).toMatchObject({ late: true, passed: false, score: 0 })
    prisma.skillAssessment.findUnique.mockResolvedValue(attempt({ submittedAt: new Date() }))
    expect(await code(service.submit("u1", "t1", []))).toBe("ALREADY_SUBMITTED")
    prisma.skillAssessment.findUnique.mockResolvedValue(attempt({ userId: "u2" }))
    expect(await code(service.submit("u1", "t1", []))).toBe("ASSESSMENT_NOT_FOUND")
  })

  it("retake after 7 days; verified people can't retake; an open attempt resumes", async () => {
    prisma.skillAssessment.findFirst.mockResolvedValue(
      attempt({ submittedAt: new Date(), expiresAt: new Date(0) })
    )
    expect(await code(service.start("u1", "SQL"))).toBe("RETRY_LATER")
    prisma.skillAssessment.findFirst.mockResolvedValue(
      attempt({ passed: true, validUntil: new Date(Date.now() + 1e9), submittedAt: new Date() })
    )
    expect(await code(service.start("u1", "SQL"))).toBe("ALREADY_VERIFIED")
    prisma.skillAssessment.findFirst.mockResolvedValue(attempt())
    const resumed = await service.start("u1", "SQL")
    expect(resumed.id).toBe("t1")
    expect(prisma.skillAssessment.create).not.toHaveBeenCalled()
  })
})
