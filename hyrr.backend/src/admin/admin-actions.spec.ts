import { PrismaClient } from "@prisma/client"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { mockDeep } from "jest-mock-extended"
import { AppException } from "../core/exceptions/app-exception"
import { AdminCompaniesService } from "./admin-companies.service"
import { AdminModerationService } from "./admin-moderation.service"
import { AdminMoneyService } from "./admin-money.service"
import { AdminUsersService } from "./admin-users.service"
import { CreditAdjustmentDto, PlanUpdateDto, PricingDto, ReasonDto } from "./dtos/admin.dto"

const ctx = { actorId: "admin-1", ip: "9.9.9.9" }

function setup() {
  const prisma: any = mockDeep<PrismaClient>()
  prisma.$transaction.mockImplementation((fn: any) =>
    typeof fn === "function" ? fn(prisma) : Promise.all(fn)
  )
  const audit = {
    record: jest.fn().mockResolvedValue({}),
    forTarget: jest.fn().mockResolvedValue([]),
  }
  const cache = { delByPattern: jest.fn().mockResolvedValue(undefined) }
  const wallet = {
    refundUnreviewedApplications: jest.fn().mockResolvedValue(2),
    credit: jest.fn().mockResolvedValue({ balanceAfter: 150, transactionId: "t1" }),
    debit: jest.fn().mockResolvedValue({ balanceAfter: 50, transactionId: "t2" }),
  }
  const notifications = { createNotification: jest.fn().mockResolvedValue({}) }
  const search = { indexJobSoon: jest.fn(), isEnabled: jest.fn().mockReturnValue(true) }
  return { prisma, audit, cache, wallet, notifications, search }
}

const auditCall = (audit: any) => audit.record.mock.calls[0][0]

describe("AdminModerationService", () => {
  const job = {
    id: "job-1",
    title: "Dev",
    status: "FLAGGED",
    companyId: "co-1",
    recruiterId: "rec-1",
  }
  let m: ReturnType<typeof setup>
  let service: AdminModerationService
  beforeEach(() => {
    m = setup()
    service = new AdminModerationService(
      m.prisma,
      m.wallet as any,
      m.audit as any,
      m.cache as any,
      m.notifications as any,
      m.search as any
    )
    m.prisma.job.findUnique.mockResolvedValue(job)
    m.prisma.job.updateMany.mockResolvedValue({ count: 1 })
    m.prisma.jobReport.updateMany.mockResolvedValue({ count: 3 })
  })

  it("restore: FLAGGED → ACTIVE, pending reports dismissed, reindexed, poster notified, audited", async () => {
    const res = await service.restore("job-1", "False alarm", ctx)
    expect(m.prisma.job.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: "FLAGGED" },
      data: { status: "ACTIVE" },
    })
    expect(m.prisma.jobReport.updateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", status: "PENDING" },
      data: { status: "DISMISSED" },
    })
    expect(res).toEqual({ job: { id: "job-1", status: "ACTIVE" }, dismissedReports: 3 })
    expect(m.search.indexJobSoon).toHaveBeenCalledWith("job-1")
    expect(m.cache.delByPattern).toHaveBeenCalledWith("jobs:public*")
    expect(m.notifications.createNotification).toHaveBeenCalledWith(
      "rec-1",
      expect.stringContaining("visible"),
      "SYSTEM",
      undefined,
      "job-1"
    )
    expect(auditCall(m.audit)).toMatchObject({
      action: "job.restore",
      target: "job:job-1",
      reason: "False alarm",
      ip: "9.9.9.9",
    })
  })

  it("remove: CLOSED, reports resolved, unreviewed applications refunded in the same transaction", async () => {
    const res = await service.remove("job-1", "Scam posting", ctx)
    expect(m.prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "CLOSED" },
    })
    expect(m.prisma.jobReport.updateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", status: "PENDING" },
      data: { status: "RESOLVED" },
    })
    expect(m.wallet.refundUnreviewedApplications).toHaveBeenCalledWith("job-1", m.prisma)
    expect(res).toEqual({
      job: { id: "job-1", status: "CLOSED" },
      resolvedReports: 3,
      refundedApplications: 2,
    })
    expect(auditCall(m.audit)).toMatchObject({
      action: "job.remove",
      reason: "Scam posting",
      severity: "warning",
      meta: expect.objectContaining({ companyId: "co-1", refundedApplications: 2 }),
    })
    expect(m.notifications.createNotification.mock.calls[0][1]).toContain("Scam posting")
  })

  it("dismiss: only reports change, nobody is notified", async () => {
    const res = await service.dismiss("job-1", undefined, ctx)
    expect(m.prisma.job.update).not.toHaveBeenCalled()
    expect(m.prisma.job.updateMany).not.toHaveBeenCalled()
    expect(res).toEqual({ job: { id: "job-1", status: "FLAGGED" }, dismissedReports: 3 })
    expect(m.notifications.createNotification).not.toHaveBeenCalled()
    expect(auditCall(m.audit).action).toBe("job.dismiss_reports")
  })

  it("404 JOB_NOT_FOUND for an unknown job", async () => {
    m.prisma.job.findUnique.mockResolvedValue(null)
    await expect(service.remove("x", "reason", ctx)).rejects.toMatchObject({
      errorCode: "JOB_NOT_FOUND",
    })
    expect(m.audit.record).not.toHaveBeenCalled()
  })

  it("list summarises reports per job", async () => {
    m.prisma.jobReport.findMany.mockResolvedValue([{ jobId: "job-1" }])
    m.prisma.job.findMany.mockResolvedValue([{ id: "job-1", title: "Dev" }])
    m.prisma.jobReport.groupBy.mockResolvedValue([
      {
        jobId: "job-1",
        reason: "SCAM",
        status: "PENDING",
        _count: { _all: 2 },
        _max: { createdAt: new Date("2026-11-02") },
      },
      {
        jobId: "job-1",
        reason: "SCAM",
        status: "DISMISSED",
        _count: { _all: 1 },
        _max: { createdAt: new Date("2026-11-01") },
      },
      {
        jobId: "job-1",
        reason: "OTHER",
        status: "PENDING",
        _count: { _all: 1 },
        _max: { createdAt: new Date("2026-11-03") },
      },
    ])
    const page = await service.list("open")
    expect(m.prisma.job.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ status: "FLAGGED" }, { id: { in: ["job-1"] } }],
    })
    expect(page.items[0].reports).toEqual({
      total: 4,
      pending: 3,
      reasons: [
        { reason: "SCAM", count: 3 },
        { reason: "OTHER", count: 1 },
      ],
      lastAt: new Date("2026-11-03"),
    })
    expect(page.nextCursor).toBeNull()
  })
})

describe("AdminUsersService", () => {
  let m: ReturnType<typeof setup>
  let service: AdminUsersService
  const email = {
    send: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(false),
  }
  beforeEach(() => {
    m = setup()
    email.send.mockClear()
    service = new AdminUsersService(m.prisma, m.audit as any, email as any)
    m.prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "Sam",
      email: "sam@x.io",
      role: "SEEKER",
      status: "ACTIVE",
      emailVerifiedAt: null,
    })
  })

  it("an admin can't suspend themselves (400 CANNOT_SUSPEND_SELF)", async () => {
    await expect(service.suspend("admin-1", "Testing", ctx)).rejects.toMatchObject({
      status: 400,
      errorCode: "CANNOT_SUSPEND_SELF",
    })
    expect(m.prisma.user.update).not.toHaveBeenCalled()
  })

  it("suspend sets SUSPENDED and bumps tokenVersion (signs out everywhere)", async () => {
    await expect(service.suspend("u1", "Spam", ctx)).resolves.toEqual({
      id: "u1",
      status: "SUSPENDED",
    })
    expect(m.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { status: "SUSPENDED", tokenVersion: { increment: 1 } },
    })
    expect(auditCall(m.audit)).toMatchObject({
      action: "user.suspend",
      target: "user:u1",
      reason: "Spam",
      severity: "critical",
    })
  })

  it("reactivate and verify-email are audited", async () => {
    await service.reactivate("u1", ctx)
    expect(m.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { status: "ACTIVE" },
    })
    const res = await service.verifyEmail("u1", ctx)
    expect(res.emailVerified).toBe(true)
    expect(m.audit.record.mock.calls.map((c: any) => c[0].action)).toEqual([
      "user.reactivate",
      "user.verify_email",
    ])
  })

  it("reset-password issues a one-time token (hash only) and e-mails the link", async () => {
    const res = await service.resetPassword("u1", ctx)
    expect(m.prisma.authToken.updateMany).toHaveBeenCalled()
    const token = m.prisma.authToken.create.mock.calls[0][0].data
    expect(token).toMatchObject({ userId: "u1", type: "RESET_PASSWORD" })
    expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: "sam@x.io" }))
    expect(res).toEqual({ id: "u1", sent: true, emailConfigured: false })
  })

  it("404 USER_NOT_FOUND", async () => {
    m.prisma.user.findUnique.mockResolvedValue(null)
    await expect(service.reactivate("nope", ctx)).rejects.toMatchObject({
      errorCode: "USER_NOT_FOUND",
    })
  })
})

describe("AdminCompaniesService", () => {
  let m: ReturnType<typeof setup>
  let service: AdminCompaniesService
  beforeEach(() => {
    m = setup()
    service = new AdminCompaniesService(
      m.prisma,
      m.wallet as any,
      m.audit as any,
      m.cache as any,
      m.search as any
    )
    m.prisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      name: "Acme",
      status: "VERIFIED",
      verified: true,
    })
    m.prisma.job.findMany.mockResolvedValue([{ id: "j1" }])
  })

  it("suspend: SUSPENDED, public caches cleared, jobs re-synced, audited critical", async () => {
    await expect(service.suspend("co-1", "Fraud", ctx)).resolves.toEqual({
      id: "co-1",
      status: "SUSPENDED",
    })
    expect(m.prisma.company.update).toHaveBeenCalledWith({
      where: { id: "co-1" },
      data: { status: "SUSPENDED" },
    })
    expect(m.cache.delByPattern).toHaveBeenCalledWith("jobs:public*")
    expect(m.search.indexJobSoon).toHaveBeenCalledWith("j1")
    expect(auditCall(m.audit)).toMatchObject({
      action: "company.suspend",
      severity: "critical",
      reason: "Fraud",
    })
  })

  it("reactivate returns to VERIFIED when the badge is on, else PENDING", async () => {
    m.prisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      name: "A",
      status: "SUSPENDED",
      verified: true,
    })
    expect((await service.reactivate("co-1", ctx)).status).toBe("VERIFIED")
    m.prisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      name: "A",
      status: "SUSPENDED",
      verified: false,
    })
    expect((await service.reactivate("co-1", ctx)).status).toBe("PENDING")
  })

  it("verify / unverify toggle the badge and the PENDING/VERIFIED status", async () => {
    m.prisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      name: "A",
      status: "PENDING",
      verified: false,
    })
    expect(await service.verify("co-1", ctx)).toEqual({
      id: "co-1",
      verified: true,
      status: "VERIFIED",
    })
    m.prisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      name: "A",
      status: "VERIFIED",
      verified: true,
    })
    expect(await service.unverify("co-1", "Domain lapsed", ctx)).toEqual({
      id: "co-1",
      verified: false,
      status: "PENDING",
    })
    expect(m.audit.record.mock.calls[1][0]).toMatchObject({
      action: "company.unverify",
      reason: "Domain lapsed",
    })
  })

  it("credit adjustment: positive amounts credit, negative debit (ADJUSTMENT, actor, note)", async () => {
    await expect(service.adjustCredits("co-1", 50, "Goodwill", ctx)).resolves.toEqual({
      balance: 150,
    })
    expect(m.wallet.credit).toHaveBeenCalledWith(
      { companyId: "co-1", amount: 50, type: "ADJUSTMENT", actorId: "admin-1", note: "Goodwill" },
      m.prisma
    )
    await expect(service.adjustCredits("co-1", -50, "Chargeback", ctx)).resolves.toEqual({
      balance: 50,
    })
    expect(m.wallet.debit.mock.calls[0][0]).toMatchObject({ amount: 50, type: "ADJUSTMENT" })
    expect(m.audit.record.mock.calls[1][0]).toMatchObject({
      action: "company.credits",
      meta: expect.objectContaining({ amount: -50, balanceAfter: 50 }),
    })
  })

  it("a debit beyond the balance propagates 402 and writes no audit row", async () => {
    m.wallet.debit.mockRejectedValue(new AppException("Not enough", 402, "INSUFFICIENT_CREDITS"))
    await expect(service.adjustCredits("co-1", -999, "Fix", ctx)).rejects.toMatchObject({
      errorCode: "INSUFFICIENT_CREDITS",
    })
    expect(m.audit.record).not.toHaveBeenCalled()
  })
})

describe("AdminMoneyService", () => {
  let m: ReturnType<typeof setup>
  let service: AdminMoneyService
  const pricing = {
    getConfig: jest.fn().mockResolvedValue({
      publishBase: 10,
      multipliers: { remote: 0.9, highSalary: 1.5, featuredCategory: 1.2 },
      featureCost: 25,
    }),
    invalidate: jest.fn(),
  }
  const ai = { getSettings: jest.fn().mockResolvedValue({}) }
  beforeEach(() => {
    m = setup()
    pricing.invalidate.mockClear()
    service = new AdminMoneyService(m.prisma, pricing as any, m.audit as any, ai as any)
  })

  it("merges a partial pricing edit into momentumConfig, invalidates and audits", async () => {
    m.prisma.systemSetting.findUnique.mockResolvedValue({
      momentumConfig: { featureCost: 30, multipliers: { remote: 0.8 } },
    })
    await service.updatePricing({ publishBase: 12, multipliers: { highSalary: 2 } } as any, ctx)
    expect(ai.getSettings).toHaveBeenCalled()
    expect(m.prisma.systemSetting.update).toHaveBeenCalledWith({
      where: { id: "global-settings" },
      data: {
        momentumConfig: {
          featureCost: 30,
          publishBase: 12,
          multipliers: { remote: 0.8, highSalary: 2 },
        },
      },
    })
    expect(pricing.invalidate).toHaveBeenCalled()
    expect(auditCall(m.audit)).toMatchObject({ action: "pricing.update", target: "pricing" })
  })

  it("reports where each pricing field comes from", async () => {
    m.prisma.systemSetting.findUnique.mockResolvedValue({ momentumConfig: { featureCost: 30 } })
    const saved = process.env.MOMENTUM_PUBLISH_BASE
    process.env.MOMENTUM_PUBLISH_BASE = "11"
    try {
      const res = await service.getPricing()
      expect(res.source).toMatchObject({
        featureCost: "settings",
        publishBase: "env",
        multipliers: "defaults",
      })
    } finally {
      if (saved === undefined) delete process.env.MOMENTUM_PUBLISH_BASE
      else process.env.MOMENTUM_PUBLISH_BASE = saved
    }
  })

  it("package and plan edits are audited with before/after; unknown ids are 404", async () => {
    m.prisma.creditPackage.findUnique.mockResolvedValue({
      id: "p1",
      name: "Small",
      code: "S",
      credits: 10,
    })
    m.prisma.creditPackage.update.mockResolvedValue({ id: "p1", credits: 20 })
    await service.updatePackage("p1", { credits: 20 } as any, ctx)
    expect(auditCall(m.audit)).toMatchObject({
      action: "package.update",
      meta: { before: { credits: 10 }, after: { credits: 20 } },
    })
    m.prisma.plan.findUnique.mockResolvedValue(null)
    await expect(service.updatePlan("NOPE", {} as any, ctx)).rejects.toMatchObject({
      errorCode: "PLAN_NOT_FOUND",
    })
  })
})

describe("admin DTOs", () => {
  const errors = async (cls: any, body: any) =>
    (await validate(plainToInstance(cls, body) as object)).map((e) => e.property)

  it("reasons are required, 3..500 characters", async () => {
    expect(await errors(ReasonDto, {})).toEqual(["reason"])
    expect(await errors(ReasonDto, { reason: "  a " })).toEqual(["reason"])
    expect(await errors(ReasonDto, { reason: "x".repeat(501) })).toEqual(["reason"])
    expect(await errors(ReasonDto, { reason: "Spam account" })).toEqual([])
  })

  it("credit adjustments are non-zero integers within ±100000", async () => {
    expect(await errors(CreditAdjustmentDto, { amount: 0, reason: "abc" })).toEqual(["amount"])
    expect(await errors(CreditAdjustmentDto, { amount: 1.5, reason: "abc" })).toEqual(["amount"])
    expect(await errors(CreditAdjustmentDto, { amount: 100001, reason: "abc" })).toEqual(["amount"])
    expect(await errors(CreditAdjustmentDto, { amount: -100000, reason: "abc" })).toEqual([])
  })

  it("pricing bounds: costs 0..10000 integers, multipliers 0.1..5, featureDays 1..90", async () => {
    expect(await errors(PricingDto, { publishBase: 10001 })).toEqual(["publishBase"])
    expect(await errors(PricingDto, { featureDays: 0 })).toEqual(["featureDays"])
    expect(await errors(PricingDto, { multipliers: { remote: 6 } })).toEqual(["multipliers"])
    expect(await errors(PricingDto, { publishBase: 12, multipliers: { remote: 0.5 } })).toEqual([])
  })

  it("plan seatLimit accepts null (unlimited)", async () => {
    expect(await errors(PlanUpdateDto, { seatLimit: null })).toEqual([])
    expect(await errors(PlanUpdateDto, { seatLimit: 0 })).toEqual(["seatLimit"])
  })
})
