import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AiService, userSafeAiError } from "./ai.service"

const analysis = {
  score: 77,
  recommendation: "STRONG_FIT",
  summary: "Good fit.",
  matchedSkills: ["TypeScript"],
  missingSkills: [],
  strengths: ["APIs"],
  concerns: [],
  experienceFit: "Matches.",
}

const application = {
  id: "app-1",
  title: "Engineer",
  location: "Berlin",
  coverLetter: "Hi",
  resumeUrl: "http://localhost:3000/api/uploads/u_cv.pdf",
  userId: "seeker-1",
  aiScore: 60,
  aiSummary: "previous",
  job: {
    companyId: "co-1",
    recruiterId: "rec-1",
    title: "Backend Engineer",
    description: "<p>Build APIs</p>",
    requirements: [],
    skills: ["TypeScript"],
    type: "FULL_TIME",
    location: "Berlin",
    remote: false,
    category: { name: "Software" },
  },
  user: { seekerProfile: null },
  answers: [],
}

describe("AiService.scoreApplication", () => {
  let prisma: any
  let adapter: any
  let gateway: any
  let cvText: any
  let service: AiService
  const savedKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-real"
    prisma = mockDeep<PrismaClient>()
    prisma.application.findUnique.mockResolvedValue(application)
    prisma.application.update.mockResolvedValue({})
    prisma.systemSetting.findUnique.mockResolvedValue({
      id: "global-settings",
      activeModel: "gpt-4o-mini",
      temperature: 0.2,
      systemPrompt: "sys",
    })
    adapter = { analyzeCandidate: jest.fn().mockResolvedValue(analysis) }
    gateway = { emitAiScoreUpdate: jest.fn(), emitAiStatus: jest.fn() }
    cvText = { extract: jest.fn().mockResolvedValue({ text: "CV TEXT" }) }
    const cache: any = { get: jest.fn(), set: jest.fn(), delByPattern: jest.fn() }
    service = new AiService(prisma, { getAdapter: () => adapter } as any, cache, gateway, cvText)
  })

  afterEach(() => {
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = savedKey
  })

  it("persists the structured result with DONE and emits the full payload", async () => {
    const result = await service.scoreApplication("app-1")

    expect(result).toEqual({ score: 77, summary: "Good fit.", status: "DONE" })
    expect(cvText.extract).toHaveBeenCalledWith(application.resumeUrl)
    expect(adapter.analyzeCandidate.mock.calls[0][3]).toContain("CV TEXT")
    expect(prisma.application.update).toHaveBeenNthCalledWith(1, {
      where: { id: "app-1" },
      data: { aiStatus: "PENDING", aiError: null },
    })
    const { score: _s, ...rest } = analysis
    const stored = { ...rest, cvUsed: true }
    expect(prisma.application.update).toHaveBeenLastCalledWith({
      where: { id: "app-1" },
      data: {
        aiScore: 77,
        aiSummary: "Good fit.",
        aiAnalysis: stored,
        aiModel: "gpt-4o-mini",
        aiScoredAt: expect.any(Date),
        aiStatus: "DONE",
        aiError: null,
      },
    })
    expect(gateway.emitAiStatus).toHaveBeenCalledWith(
      "co-1",
      { applicationId: "app-1", aiStatus: "PENDING" },
      "rec-1"
    )
    expect(gateway.emitAiScoreUpdate).toHaveBeenCalledWith(
      "co-1",
      {
        applicationId: "app-1",
        aiScore: 77,
        aiSummary: "Good fit.",
        aiAnalysis: stored,
        aiModel: "gpt-4o-mini",
        aiScoredAt: expect.any(String),
        aiStatus: "DONE",
      },
      "rec-1"
    )
  })

  it("records cvUsed=false and the note when the CV cannot be read", async () => {
    cvText.extract.mockResolvedValue({ text: null, note: "Legacy .doc files can't be read" })
    await service.scoreApplication("app-1")
    const data = prisma.application.update.mock.calls.at(-1)[0].data
    expect(data.aiAnalysis.cvUsed).toBe(false)
    expect(data.aiAnalysis.cvNote).toBe("Legacy .doc files can't be read")
  })

  it("falls back to the seeker's latest active RESUME document", async () => {
    prisma.application.findUnique.mockResolvedValue({ ...application, resumeUrl: null })
    prisma.document.findFirst.mockResolvedValue({ url: "http://x/api/uploads/u_doc.docx" })
    await service.scoreApplication("app-1")
    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "seeker-1", type: "RESUME", active: true },
        orderBy: { createdAt: "desc" },
      })
    )
    expect(cvText.extract).toHaveBeenCalledWith("http://x/api/uploads/u_doc.docx")
  })

  it("on failure sets FAILED + aiError and keeps the previous good result", async () => {
    adapter.analyzeCandidate.mockRejectedValue(Object.assign(new Error("401"), { status: 401 }))

    const result = await service.scoreApplication("app-1")

    expect(result).toEqual({ score: null, summary: null, status: "FAILED" })
    const writes = prisma.application.update.mock.calls.map((c: any) => c[0].data)
    for (const data of writes) {
      expect(data).not.toHaveProperty("aiScore")
      expect(data).not.toHaveProperty("aiSummary")
      expect(data).not.toHaveProperty("aiAnalysis")
    }
    expect(writes.at(-1)).toEqual({
      aiStatus: "FAILED",
      aiError: "The AI provider rejected the configured API key.",
    })
    expect(gateway.emitAiStatus).toHaveBeenLastCalledWith(
      "co-1",
      {
        applicationId: "app-1",
        aiStatus: "FAILED",
        aiError: "The AI provider rejected the configured API key.",
      },
      "rec-1"
    )
    expect(gateway.emitAiScoreUpdate).not.toHaveBeenCalled()
  })

  it("sets DISABLED without calling the model when no key is configured", async () => {
    process.env.OPENAI_API_KEY = "sk-..."
    const saved = [process.env.ANTHROPIC_API_KEY, process.env.GOOGLE_AI_API_KEY]
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GOOGLE_AI_API_KEY
    try {
      await service.scoreApplication("app-1")
    } finally {
      if (saved[0] !== undefined) process.env.ANTHROPIC_API_KEY = saved[0]
      if (saved[1] !== undefined) process.env.GOOGLE_AI_API_KEY = saved[1]
    }
    expect(adapter.analyzeCandidate).not.toHaveBeenCalled()
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { aiStatus: "DISABLED", aiError: null },
    })
    expect(gateway.emitAiStatus).toHaveBeenCalledWith(
      "co-1",
      { applicationId: "app-1", aiStatus: "DISABLED" },
      "rec-1"
    )
  })

  it("never throws, even when the database fails", async () => {
    prisma.application.findUnique.mockRejectedValue(new Error("db down"))
    await expect(service.scoreApplication("app-1")).resolves.toEqual({
      score: null,
      summary: null,
      status: "FAILED",
    })
  })
})

describe("userSafeAiError", () => {
  it("maps provider errors to short messages without leaking details", () => {
    expect(userSafeAiError(Object.assign(new Error("x"), { name: "TimeoutError" }))).toMatch(
      /too long/
    )
    expect(userSafeAiError({ status: 429, message: "slow down sk-abc" })).toMatch(/rate limiting/)
    expect(userSafeAiError(new Error("socket hang up sk-secret"))).toBe(
      "AI analysis failed. Please try again."
    )
  })
})

describe("userSafeAiError", () => {
  // Imported lazily so this block stays independent of the suites above.
  const { userSafeAiError } = require("./ai.service")

  it("explains an exhausted provider balance instead of calling it a rate limit", () => {
    const err = Object.assign(
      new Error("429 You have no credits remaining. Add credits to continue using the API"),
      { status: 429 }
    )
    expect(userSafeAiError(err)).toMatch(/no credits left/)
  })

  it("still reports a real rate limit as one", () => {
    expect(
      userSafeAiError(Object.assign(new Error("Rate limit reached"), { status: 429 }))
    ).toMatch(/rate limiting/)
  })
})
