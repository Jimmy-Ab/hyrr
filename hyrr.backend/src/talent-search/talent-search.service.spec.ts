import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { TalentSearchService, relevance } from "./talent-search.service"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)

const profile = (over: Record<string, any> = {}) => ({
  id: "p1",
  title: "Backend Engineer",
  location: "Nairobi",
  bio: "I build APIs with NestJS and PostgreSQL.",
  skills: ["NestJS", "PostgreSQL", "TypeScript"],
  experiences: [
    {
      role: "Software Engineer",
      company: "Kopo",
      startDate: new Date("2021-01-01"),
      endDate: null,
      current: true,
    },
  ],
  educations: [],
  user: { id: "seek-1", name: "Amina", avatar: null },
  ...over,
})

describe("TalentSearchService", () => {
  let prisma: any
  let wallet: { debit: jest.Mock }
  let notifications: { createNotification: jest.Mock }
  let gateway: {
    emitToUsers: jest.Mock
    emitToCompany: jest.Mock
    emitApplicationUpdate: jest.Mock
  }
  let applications: { candidatePayload: jest.Mock; scoreInBackground: jest.Mock }
  let service: TalentSearchService
  const recruiter = { userId: "rec-1", role: "RECRUITER", companyId: "co-1" } as any
  const seeker = { userId: "seek-1", role: "SEEKER" } as any

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    const access = { companyScope: jest.fn().mockResolvedValue({ companyIds: ["co-1"] }) }
    wallet = { debit: jest.fn().mockResolvedValue({ balanceAfter: 10 }) }
    notifications = { createNotification: jest.fn().mockResolvedValue(undefined) }
    gateway = { emitToUsers: jest.fn(), emitToCompany: jest.fn(), emitApplicationUpdate: jest.fn() }
    applications = {
      candidatePayload: jest.fn().mockResolvedValue({ id: "app-9", email: "" }),
      scoreInBackground: jest.fn(),
    }
    service = new TalentSearchService(
      prisma,
      access as any,
      wallet as any,
      { getConfig: jest.fn().mockResolvedValue({ outreachCost: 5 }) } as any,
      notifications as any,
      applications as any,
      gateway as any
    )
    // requireCompanyWriter: an active RECRUITER member of an active company
    prisma.companyMember.findUnique.mockResolvedValue({ role: "RECRUITER" })
    prisma.company.findUnique.mockResolvedValue({ status: "VERIFIED", id: "co-1" })
  })

  it("only searches opted-in, active seekers that haven't blocked the company", async () => {
    prisma.seekerProfile.findMany.mockResolvedValue([profile()])
    prisma.application.findMany.mockResolvedValue([])
    await service.search(recruiter, "nestjs")
    expect(prisma.seekerProfile.findMany.mock.calls[0][0].where).toMatchObject({
      openToRecruiters: true,
      user: { status: "ACTIVE", role: "SEEKER", companyBlocks: { none: { companyId: "co-1" } } },
    })
  })

  it("results never contain contact details", async () => {
    prisma.seekerProfile.findMany.mockResolvedValue([profile()])
    prisma.application.findMany.mockResolvedValue([])
    const res = await service.search(recruiter, "postgresql")
    expect(res.results).toHaveLength(1)
    expect(Object.keys(res.results[0])).not.toEqual(expect.arrayContaining(["email"]))
    expect(JSON.stringify(res)).not.toMatch(/@|phone/i)
  })

  it("ranks by title, skills, experience and bio; drops non-matches", () => {
    const p = profile() as any
    expect(relevance(p, ["backend"])).toBe(3)
    expect(relevance(p, ["nestjs"])).toBe(3) // skill ×2 + bio ×1
    expect(relevance(p, ["golang"])).toBe(0)
  })

  it("seekers can't search", async () => {
    expect(await code(service.search(seeker, "x"))).toBe("FORBIDDEN")
  })

  describe("outreach", () => {
    beforeEach(() => {
      prisma.job.findUnique.mockResolvedValue({
        id: "job-1",
        title: "Backend Engineer",
        status: "ACTIVE",
        companyId: "co-1",
        recruiterId: "rec-1",
        removedAt: null,
        company: { name: "Acme" },
      })
      prisma.seekerProfile.findFirst.mockResolvedValue({
        title: "Backend Engineer",
        location: "Nairobi",
        user: { id: "seek-1", name: "Amina", email: "amina@x.io" },
      })
    })

    it("charges the outreach cost in the same transaction and starts the conversation", async () => {
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.application.create.mockResolvedValue({ id: "app-9" })
      await service.outreach(
        recruiter,
        "seek-1",
        "job-1",
        "Hi Amina, we'd love to talk about our API team."
      )
      expect(prisma.application.create.mock.calls[0][0].data).toMatchObject({
        status: "SOURCED",
        source: "OUTREACH",
        userId: "seek-1",
      })
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "co-1",
          amount: 5,
          type: "OUTREACH",
          referenceId: "app-9",
        }),
        prisma
      )
      expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({
        applicationId: "app-9",
        senderType: "RECRUITER",
        receiverId: "seek-1",
      })
      expect(gateway.emitToUsers).toHaveBeenCalledWith(
        ["seek-1"],
        "outreach_received",
        expect.any(Object)
      )
    })

    it("one outreach per person and job; only open jobs; hidden profiles are refused", async () => {
      prisma.application.findFirst.mockResolvedValue({ status: "SOURCED" })
      expect(await code(service.outreach(recruiter, "seek-1", "job-1", "x".repeat(30)))).toBe(
        "ALREADY_CONTACTED"
      )
      prisma.job.findUnique.mockResolvedValueOnce({
        id: "job-1",
        status: "CLOSED",
        companyId: "co-1",
        removedAt: null,
      })
      expect(await code(service.outreach(recruiter, "seek-1", "job-1", "x".repeat(30)))).toBe(
        "JOB_NOT_ACTIVE"
      )
      prisma.seekerProfile.findFirst.mockResolvedValue(null)
      expect(await code(service.outreach(recruiter, "seek-1", "job-1", "x".repeat(30)))).toBe(
        "PROFILE_NOT_FOUND"
      )
      expect(wallet.debit).not.toHaveBeenCalled()
    })
  })

  describe("respond", () => {
    const app = {
      id: "app-9",
      userId: "seek-1",
      name: "Amina",
      status: "SOURCED",
      job: { title: "Backend Engineer", companyId: "co-1", recruiterId: "rec-1" },
    }

    it("Interested moves to APPLIED without charging the seeker and refreshes the team card", async () => {
      prisma.application.findUnique.mockResolvedValue(app)
      prisma.application.updateMany.mockResolvedValue({ count: 1 })
      const res = await service.respond(seeker, "app-9", true)
      expect(res.status).toBe("APPLIED")
      expect(wallet.debit).not.toHaveBeenCalled()
      expect(gateway.emitToCompany).toHaveBeenCalledWith(
        "co-1",
        "candidate_applied",
        expect.any(Object)
      )
      expect(applications.scoreInBackground).toHaveBeenCalledWith("app-9")
    })

    it("Not interested archives; answering twice is refused; others can't answer", async () => {
      prisma.application.findUnique.mockResolvedValue(app)
      prisma.application.updateMany.mockResolvedValue({ count: 1 })
      expect((await service.respond(seeker, "app-9", false)).status).toBe("ARCHIVED")
      prisma.application.findUnique.mockResolvedValue({ ...app, status: "APPLIED" })
      expect(await code(service.respond(seeker, "app-9", true))).toBe("ALREADY_ANSWERED")
      expect(
        await code(service.respond({ userId: "other", role: "SEEKER" } as any, "app-9", true))
      ).toBe("NOT_FOUND")
    })
  })
})
