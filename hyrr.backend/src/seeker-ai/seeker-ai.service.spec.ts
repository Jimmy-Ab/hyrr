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
})
