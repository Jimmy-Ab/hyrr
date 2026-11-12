import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { DEFAULT_COMPETENCIES, ScorecardsService, debrief } from "./scorecards.service"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)

const card = (interviewerId: string, recommendation: string, score = 4) => ({
  id: `sc-${interviewerId}`,
  applicationId: "app-1",
  interviewerId,
  recommendation,
  overallNotes: `Notes from ${interviewerId}`,
  submittedAt: new Date(),
  updatedAt: new Date(),
  interviewer: { id: interviewerId, name: interviewerId, avatar: null },
  ratings: DEFAULT_COMPETENCIES.map((competency) => ({
    id: `${interviewerId}-${competency}`,
    scorecardId: `sc-${interviewerId}`,
    competency,
    score,
    notes: null,
  })),
})

describe("ScorecardsService", () => {
  let prisma: any
  let gateway: { emitToCompany: jest.Mock }
  let service: ScorecardsService
  const me = { userId: "u-me", role: "RECRUITER", companyId: "co-1" } as any

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    const access = { applicationFor: jest.fn().mockResolvedValue({ id: "app-1", jobId: "job-1" }) }
    gateway = { emitToCompany: jest.fn() }
    service = new ScorecardsService(prisma, access as any, gateway as any)
    prisma.job.findUnique.mockResolvedValue({
      id: "job-1",
      companyId: "co-1",
      scorecardCompetencies: [],
      company: { status: "VERIFIED" },
    })
  })

  const asRole = (role: string) => prisma.companyMember.findUnique.mockResolvedValue({ role })

  it("blind: colleagues' scorecards and the debrief stay hidden until you submit", async () => {
    asRole("RECRUITER")
    prisma.scorecard.findMany.mockResolvedValue([card("u-a", "YES"), card("u-b", "NO")])
    const view = await service.list(me, "app-1")
    expect(view).toMatchObject({ locked: true, submittedCount: 2, others: [], debrief: null })
    expect(JSON.stringify(view)).not.toContain("Notes from")
  })

  it("after submitting, you see everyone and the debrief", async () => {
    asRole("HIRING_MANAGER")
    prisma.scorecard.findMany.mockResolvedValue([card("u-a", "YES"), card("u-me", "STRONG_YES", 5)])
    const view = await service.list(me, "app-1")
    expect(view.locked).toBe(false)
    expect(view.mine?.recommendation).toBe("STRONG_YES")
    expect(view.others.map((o) => o.interviewer.id)).toEqual(["u-a"])
    expect(view.debrief?.consensus).toBe("HIRE")
  })

  it("owners always see scorecards; viewers can't submit", async () => {
    asRole("OWNER")
    prisma.scorecard.findMany.mockResolvedValue([card("u-a", "NO")])
    expect((await service.list(me, "app-1")).locked).toBe(false)
    asRole("VIEWER")
    expect(
      await code(
        service.submit(me, "app-1", {
          recommendation: "YES",
          overallNotes: "Solid all round.",
          ratings: [],
        })
      )
    ).toBe("FORBIDDEN")
  })

  it("seekers are refused", async () => {
    expect(await code(service.list({ userId: "s", role: "SEEKER" } as any, "app-1"))).toBe(
      "FORBIDDEN"
    )
  })

  it("every criterion must be rated, and unknown ones are refused", async () => {
    asRole("RECRUITER")
    const ratings = DEFAULT_COMPETENCIES.slice(0, 3).map((competency) => ({ competency, score: 3 }))
    expect(
      await code(
        service.submit(me, "app-1", { recommendation: "YES", overallNotes: "Good.", ratings })
      )
    ).toBe("SCORECARD_INCOMPLETE")
    expect(
      await code(
        service.submit(me, "app-1", {
          recommendation: "YES",
          overallNotes: "Good.",
          ratings: [...DEFAULT_COMPETENCIES, "Charisma"].map((competency) => ({
            competency,
            score: 3,
          })),
        })
      )
    ).toBe("SCORECARD_INCOMPLETE")
  })

  it("submit upserts, replaces ratings and broadcasts without content", async () => {
    asRole("RECRUITER")
    prisma.scorecard.upsert.mockResolvedValue({ id: "sc-me" })
    prisma.scorecard.count.mockResolvedValue(1)
    prisma.scorecard.findMany.mockResolvedValue([card("u-me", "YES")])
    await service.submit(me, "app-1", {
      recommendation: "YES",
      overallNotes: "Strong problem solver, clear communicator.",
      ratings: DEFAULT_COMPETENCIES.map((competency) => ({ competency, score: 4 })),
    })
    expect(prisma.scorecardRating.deleteMany).toHaveBeenCalledWith({
      where: { scorecardId: "sc-me" },
    })
    expect(prisma.scorecardRating.createMany.mock.calls[0][0].data).toHaveLength(4)
    const [, event, payload] = gateway.emitToCompany.mock.calls[0]
    expect(event).toBe("scorecard_submitted")
    expect(Object.keys(payload).sort()).toEqual([
      "applicationId",
      "interviewerId",
      "submittedCount",
    ])
  })

  it("debrief averages and consensus", () => {
    const d = debrief([card("a", "YES", 4), card("b", "NO", 2)] as any, DEFAULT_COMPETENCIES)
    expect(d.consensus).toBe("MIXED")
    expect(d.perCompetency[0]).toEqual({ competency: "Technical skills", average: 3, count: 2 })
    expect(d.recommendations).toMatchObject({ YES: 1, NO: 1 })
    expect(
      debrief([card("a", "NO"), card("b", "STRONG_NO")] as any, DEFAULT_COMPETENCIES).consensus
    ).toBe("NO_HIRE")
  })
})
