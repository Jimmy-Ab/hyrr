import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { OffersService, offerSummary, presentOffer } from "./offers.service"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)
const days = (n: number) => new Date(Date.now() + n * 86_400_000)

describe("OffersService", () => {
  let prisma: any
  let access: { applicationFor: jest.Mock }
  let notifications: { createNotification: jest.Mock }
  let gateway: {
    emitToUsers: jest.Mock
    emitToCompany: jest.Mock
    emitApplicationUpdate: jest.Mock
  }
  let realtime: { adminMetric: jest.Mock }
  let service: OffersService
  const recruiter = { userId: "rec-1", role: "RECRUITER", companyId: "co-1" } as any
  const seeker = { userId: "seek-1", role: "SEEKER" } as any

  const row = (over: Record<string, any> = {}) => ({
    id: "of-1",
    applicationId: "app-1",
    createdById: "rec-1",
    jobTitle: "Data Engineer",
    baseSalary: 90000,
    salaryCurrency: "EUR",
    salaryPeriod: "YEAR",
    bonusAmount: 5000,
    equityPercentage: 0.1,
    startDate: days(30),
    expiresAt: days(7),
    benefits: ["Remote budget"],
    message: "Welcome!",
    status: "SENT",
    signatureName: null,
    signedAt: null,
    signedIp: "10.0.0.1",
    declineReason: null,
    respondedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    application: {
      id: "app-1",
      userId: "seek-1",
      name: "Sam",
      status: "INTERVIEWING",
      job: { id: "job-1", title: "Data Engineer", companyId: "co-1", company: { name: "Acme" } },
    },
    createdBy: { id: "rec-1", name: "Rita" },
    ...over,
  })

  const input = (over: Record<string, any> = {}) => ({
    applicationId: "app-1",
    baseSalary: 90000,
    salaryCurrency: "EUR",
    salaryPeriod: "YEAR" as const,
    startDate: days(30).toISOString(),
    expiresAt: days(7).toISOString(),
    benefits: ["Remote budget", "Remote budget", " "],
    ...over,
  })

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    access = {
      applicationFor: jest.fn().mockResolvedValue({
        id: "app-1",
        userId: "seek-1",
        status: "INTERVIEWING",
        job: { title: "Data Engineer" },
      }),
    }
    notifications = { createNotification: jest.fn().mockResolvedValue(undefined) }
    gateway = { emitToUsers: jest.fn(), emitToCompany: jest.fn(), emitApplicationUpdate: jest.fn() }
    realtime = { adminMetric: jest.fn() }
    service = new OffersService(
      prisma,
      access as any,
      notifications as any,
      gateway as any,
      realtime as any
    )
    prisma.companyMember.findMany.mockResolvedValue([{ userId: "owner-1" }])
  })

  it("validates the deadline, start date and account", async () => {
    expect(
      await code(
        service.create(recruiter, input({ expiresAt: new Date(Date.now() + 60_000).toISOString() }))
      )
    ).toBe("OFFER_EXPIRY_TOO_SOON")
    expect(
      await code(service.create(recruiter, input({ expiresAt: days(90).toISOString() })))
    ).toBe("OFFER_EXPIRY_TOO_FAR")
    expect(
      await code(service.create(recruiter, input({ startDate: days(-5).toISOString() })))
    ).toBe("OFFER_START_IN_PAST")
    access.applicationFor.mockResolvedValueOnce({
      id: "app-1",
      userId: null,
      status: "APPLIED",
      job: {},
    })
    expect(await code(service.create(recruiter, input()))).toBe("CANDIDATE_HAS_NO_ACCOUNT")
    expect(prisma.offer.create).not.toHaveBeenCalled()
  })

  it("sending replaces the live offer, moves to OFFER and tells the candidate live", async () => {
    prisma.offer.create.mockResolvedValue(row())
    const result = await service.create(recruiter, input())
    expect(prisma.offer.updateMany).toHaveBeenCalledWith({
      where: { applicationId: "app-1", status: "SENT" },
      data: { status: "WITHDRAWN", respondedAt: expect.any(Date) },
    })
    expect(prisma.offer.create.mock.calls[0][0].data.benefits).toEqual(["Remote budget"])
    expect(prisma.application.update.mock.calls[0][0].data).toMatchObject({
      status: "OFFER",
      tag: "Offer Sent",
      offerAmount: "€90,000 / year",
    })
    expect(gateway.emitToUsers).toHaveBeenCalledWith(["seek-1"], "offer_extended", result)
    expect(JSON.stringify(result)).not.toContain("10.0.0.1")
  })

  it("only the candidate can accept, only while open and not expired", async () => {
    prisma.offer.findUnique.mockResolvedValue(row())
    expect(
      await code(service.accept({ userId: "other", role: "SEEKER" } as any, "of-1", "X Y"))
    ).toBe("OFFER_NOT_FOUND")
    expect(await code(service.accept(recruiter, "of-1", "Rita"))).toBe("OFFER_NOT_FOUND")
    prisma.offer.findUnique.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }))
    expect(await code(service.accept(seeker, "of-1", "Sam Doe"))).toBe("OFFER_EXPIRED")
    prisma.offer.findUnique.mockResolvedValue(row({ status: "WITHDRAWN" }))
    expect(await code(service.accept(seeker, "of-1", "Sam Doe"))).toBe("OFFER_CLOSED")
  })

  it("accepting stores the typed signature + IP, audits it and notifies the team", async () => {
    prisma.offer.findUnique
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(
        row({ status: "ACCEPTED", signatureName: "Sam Doe", signedAt: new Date() })
      )
    prisma.offer.updateMany.mockResolvedValue({ count: 1 })
    const result = await service.accept(seeker, "of-1", "Sam Doe", "1.2.3.4")
    expect(prisma.offer.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "ACCEPTED",
      signatureName: "Sam Doe",
      signedIp: "1.2.3.4",
    })
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "offer.accept",
      ip: "1.2.3.4",
    })
    const notified = notifications.createNotification.mock.calls.map((c: any[]) => c[0])
    expect(notified.sort()).toEqual(["owner-1", "rec-1"])
    expect(gateway.emitToCompany).toHaveBeenCalledWith("co-1", "offer_accepted", result)
    expect(realtime.adminMetric).toHaveBeenCalledWith("placement", { companyId: "co-1" })
  })

  it("a concurrent change makes accept fail cleanly", async () => {
    prisma.offer.findUnique.mockResolvedValue(row())
    prisma.offer.updateMany.mockResolvedValue({ count: 0 })
    expect(await code(service.accept(seeker, "of-1", "Sam Doe"))).toBe("OFFER_CLOSED")
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it("SENT past its deadline reads as EXPIRED; summary format", () => {
    expect(presentOffer(row({ expiresAt: new Date(Date.now() - 1) }) as any).status).toBe("EXPIRED")
    expect(offerSummary({ baseSalary: 4500, salaryCurrency: "USD", salaryPeriod: "MONTH" })).toBe(
      "$4,500 / month"
    )
  })
})
