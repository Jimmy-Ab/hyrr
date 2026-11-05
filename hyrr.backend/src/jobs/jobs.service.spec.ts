import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { PricingService } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { CacheService } from "../cache/cache.service"
import { AccessService } from "../core/access/access.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { FeaturedJobsScheduler } from "./featured-jobs.scheduler"
import { JobsService } from "./jobs.service"

const insufficient = () =>
  Object.assign(new Error("Not enough Momentum credits"), {
    status: 402,
    errorCode: "INSUFFICIENT_CREDITS",
  })

describe("JobsService", () => {
  let service: JobsService
  let prismaMock: any
  let access: any
  let wallet: any
  let pricing: any
  let cache: any

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    // Interactive transactions run against the same mock client.
    prismaMock.$transaction.mockImplementation((fn: any) => fn(prismaMock))
    wallet = {
      debit: jest.fn().mockResolvedValue({ balanceAfter: 10, transactionId: "t1" }),
      credit: jest.fn().mockResolvedValue({ balanceAfter: 20, transactionId: "t2" }),
      ensureWallet: jest.fn().mockResolvedValue({ balance: 0 }),
      getBalance: jest.fn().mockResolvedValue(10),
    }
    pricing = {
      publishCost: jest.fn().mockResolvedValue(10),
      publishCostBreakdown: jest
        .fn()
        .mockResolvedValue({ cost: 9, base: 10, multipliers: [{ name: "remote", factor: 0.9 }] }),
      getConfig: jest.fn().mockResolvedValue({ featureCost: 25, featureDays: 14, signupBonus: 20 }),
    }
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CacheService, useValue: cache },
        { provide: WalletService, useValue: wallet },
        { provide: PricingService, useValue: pricing },
        {
          provide: AccessService,
          useValue: {
            jobForManagement: jest.fn(),
            applicationFor: jest.fn(),
            jobScopeWhere: jest.fn().mockResolvedValue({ OR: [{ companyId: { in: ["co-1"] } }] }),
            companyScope: jest.fn(),
          },
        },
        { provide: NotificationsService, useValue: { createNotification: jest.fn() } },
      ],
    }).compile()

    service = module.get<JobsService>(JobsService)
    access = module.get(AccessService)
  })

  it("should list jobs for recruiter", async () => {
    prismaMock.job.findMany.mockResolvedValue([
      { id: "job-1", title: "Senior React Developer" },
    ] as any)

    const result = await service.getRecruiterJobs("recruiter-123")
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe("Senior React Developer")
  })

  it("should search public active jobs", async () => {
    // no featured jobs (the featured page query is skipped), then the regular one
    prismaMock.job.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    prismaMock.job.findMany.mockResolvedValueOnce([
      { id: "job-2", title: "Product Designer", status: "ACTIVE" },
    ] as any)

    const result = await service.searchPublicJobs("Design")
    expect(result).toHaveLength(1)
    expect(prismaMock.job.findMany).toHaveBeenCalled()
  })

  it("searches with case-insensitive contains instead of a raw tsquery", async () => {
    prismaMock.job.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    prismaMock.job.findMany.mockResolvedValueOnce([{ id: "job-2", requirements: null }])
    const result: any[] = await service.searchPublicJobs("acme")
    const where = prismaMock.job.findMany.mock.calls[0][0].where.AND[0]
    expect(JSON.stringify(where)).not.toContain("search")
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { title: { contains: "acme", mode: "insensitive" } },
        { company: { name: { contains: "acme", mode: "insensitive" } } },
      ])
    )
    expect(result[0].requirements).toEqual([])
  })

  it("public job detail is 404 for non-ACTIVE jobs", async () => {
    prismaMock.job.findFirst.mockResolvedValue(null)
    await expect(service.getJobById("job-x")).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.job.findFirst.mock.calls[0][0].where).toEqual({
      id: "job-x",
      status: "ACTIVE",
    })
  })

  it("lists company jobs via the access scope", async () => {
    prismaMock.job.findMany.mockResolvedValue([])
    await service.getRecruiterJobs({ userId: "rec-1", role: "RECRUITER" })
    expect(prismaMock.job.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ companyId: { in: ["co-1"] } }],
    })
  })

  it("recruiters cannot move a job out of or into FLAGGED", async () => {
    const recruiter = { userId: "rec-1", role: "RECRUITER" }
    access.jobForManagement.mockResolvedValue({ id: "job-1", status: "FLAGGED" })
    await expect(service.updateJob("job-1", { status: "ACTIVE" }, recruiter)).rejects.toMatchObject(
      {
        status: 403,
      }
    )
    access.jobForManagement.mockResolvedValue({ id: "job-1", status: "ACTIVE" })
    await expect(
      service.updateJob("job-1", { status: "FLAGGED" }, recruiter)
    ).rejects.toMatchObject({
      status: 400,
    })
    expect(prismaMock.job.update).not.toHaveBeenCalled()
  })

  describe("publishing safety", () => {
    const dto: any = {
      title: "Frontend Engineer",
      location: "Addis Ababa",
      type: "FULL_TIME",
      description: "Build our web app. We offer a competitive salary and pay relocation.",
      requirements: ["3+ years React"],
      skills: ["React"],
      categoryId: "cat-1",
    }
    const recruiter = { userId: "rec-1", role: "RECRUITER" }

    beforeEach(() => {
      access.companyScope.mockResolvedValue({ companyIds: ["co-1"], manageCompanyIds: ["co-1"] })
      prismaMock.job.count.mockResolvedValue(0)
      prismaMock.job.create.mockImplementation(async ({ data }: any) => ({
        id: "job-new",
        ...data,
      }))
      prismaMock.jobAlert.findMany.mockResolvedValue([])
    })

    const asUser = (emailVerifiedAt: Date | null) =>
      prismaMock.user.findUnique.mockResolvedValue({
        id: "rec-1",
        name: "Rec",
        companyId: "co-1",
        emailVerifiedAt,
      })

    it("publishing requires a verified e-mail (403 EMAIL_NOT_VERIFIED)", async () => {
      asUser(null)
      await expect(service.createJob("rec-1", dto)).rejects.toMatchObject({
        status: 403,
        errorCode: "EMAIL_NOT_VERIFIED",
      })
      await expect(service.createJob("rec-1", { ...dto, status: "ACTIVE" })).rejects.toMatchObject({
        errorCode: "EMAIL_NOT_VERIFIED",
      })
      expect(prismaMock.job.create).not.toHaveBeenCalled()
    })

    it("drafts can be created without a verified e-mail and trigger no alerts", async () => {
      asUser(null)
      const job: any = await service.createJob("rec-1", { ...dto, status: "DRAFT" })
      expect(job.status).toBe("DRAFT")
      expect(prismaMock.job.create.mock.calls[0][0].data.status).toBe("DRAFT")
      expect(prismaMock.jobAlert.findMany).not.toHaveBeenCalled()
    })

    it("verified recruiters publish as ACTIVE by default", async () => {
      asUser(new Date())
      const job: any = await service.createJob("rec-1", dto)
      expect(job.status).toBe("ACTIVE")
    })

    it("rejects scam content with 400 JOB_CONTENT_REJECTED and reasons", async () => {
      asUser(new Date())
      const error: any = await service
        .createJob("rec-1", {
          ...dto,
          description: "Applicants must pay a $50 registration fee via Western Union.",
        })
        .catch((e) => e)
      expect(error.status).toBe(400)
      expect(error.errorCode).toBe("JOB_CONTENT_REJECTED")
      expect(error.getResponse().details.length).toBeGreaterThanOrEqual(2)
      expect(prismaMock.job.create).not.toHaveBeenCalled()
    })

    it("scam check also applies to drafts", async () => {
      asUser(null)
      await expect(
        service.createJob("rec-1", {
          ...dto,
          status: "DRAFT",
          requirements: ["Send your bank account details before the interview"],
        })
      ).rejects.toMatchObject({ errorCode: "JOB_CONTENT_REJECTED" })
    })

    it("moving a draft to ACTIVE requires a verified e-mail; saving a draft does not", async () => {
      access.jobForManagement.mockResolvedValue({
        id: "job-1",
        status: "DRAFT",
        title: "T",
        description: "D",
        requirements: [],
        benefits: [],
      })
      prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: null })
      await expect(
        service.updateJob("job-1", { status: "ACTIVE" }, recruiter)
      ).rejects.toMatchObject({ status: 403, errorCode: "EMAIL_NOT_VERIFIED" })
      expect(prismaMock.job.update).not.toHaveBeenCalled()

      prismaMock.job.update.mockResolvedValue({ id: "job-1", status: "DRAFT" })
      await service.updateJob("job-1", { title: "Better title" }, recruiter)
      expect(prismaMock.job.update).toHaveBeenCalled()
    })

    it("editing an ACTIVE job does not re-check verification", async () => {
      access.jobForManagement.mockResolvedValue({
        id: "job-1",
        status: "ACTIVE",
        title: "T",
        description: "D",
        requirements: [],
        benefits: [],
      })
      prismaMock.job.update.mockResolvedValue({ id: "job-1", status: "ACTIVE" })
      await service.updateJob("job-1", { status: "ACTIVE", salary: "$100k" }, recruiter)
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it("updates are screened against the merged content", async () => {
      access.jobForManagement.mockResolvedValue({
        id: "job-1",
        status: "ACTIVE",
        title: "Data entry",
        description: "Remote work.",
        requirements: [],
        benefits: [],
      })
      await expect(
        service.updateJob("job-1", { requirements: ["Contact us on WhatsApp only"] }, recruiter)
      ).rejects.toMatchObject({ errorCode: "JOB_CONTENT_REJECTED" })
      expect(prismaMock.job.update).not.toHaveBeenCalled()
    })
  })

  describe("Momentum publish charge", () => {
    const dto: any = {
      title: "Frontend Engineer",
      location: "Addis Ababa",
      type: "FULL_TIME",
      description: "Build our web app.",
      requirements: [],
      skills: ["React"],
      categoryId: "cat-1",
      remote: true,
      salary: "$130k",
    }
    const recruiter = { userId: "rec-1", role: "RECRUITER" }
    const admin = { userId: "adm-1", role: "ADMIN" }
    const draft = {
      id: "job-1",
      status: "DRAFT",
      companyId: "co-1",
      title: "T",
      description: "D",
      requirements: [],
      benefits: [],
      remote: false,
      salary: null,
      categoryId: "cat-1",
      publishedAt: null,
    }

    beforeEach(() => {
      access.companyScope.mockResolvedValue({ companyIds: ["co-1"], manageCompanyIds: ["co-1"] })
      prismaMock.job.count.mockResolvedValue(0)
      prismaMock.job.create.mockImplementation(async ({ data }: any) => ({
        id: "job-new",
        ...data,
      }))
      prismaMock.job.update.mockImplementation(async ({ data }: any) => ({ id: "job-1", ...data }))
      prismaMock.user.findUnique.mockResolvedValue({
        id: "rec-1",
        name: "Rec",
        companyId: "co-1",
        emailVerifiedAt: new Date(),
      })
    })

    it("publishing on create charges publishCost once and records publishedAt + momentumCost", async () => {
      const job: any = await service.createJob("rec-1", dto)
      expect(pricing.publishCost).toHaveBeenCalledWith({
        remote: true,
        salary: "$130k",
        categoryId: "cat-1",
      })
      const data = prismaMock.job.create.mock.calls[0][0].data
      expect(data.publishedAt).toBeInstanceOf(Date)
      expect(data.momentumCost).toBe(10)
      expect(wallet.debit).toHaveBeenCalledTimes(1)
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "co-1",
          amount: 10,
          type: "JOB_PUBLISH",
          referenceId: "job-new",
        }),
        prismaMock
      )
      expect(job.status).toBe("ACTIVE")
    })

    it("ignores the legacy featured flag on create", async () => {
      await service.createJob("rec-1", { ...dto, featured: true })
      expect(prismaMock.job.create.mock.calls[0][0].data.featured).toBe(false)
    })

    it("drafts are free and have no publishedAt", async () => {
      await service.createJob("rec-1", { ...dto, status: "DRAFT" })
      expect(wallet.debit).not.toHaveBeenCalled()
      expect(prismaMock.job.create.mock.calls[0][0].data.publishedAt).toBeUndefined()
    })

    it("402 INSUFFICIENT_CREDITS propagates and the transaction writes nothing", async () => {
      // A real $transaction rolls back on throw: emulate by recording writes only on success.
      const committed: any[] = []
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const writes: any[] = []
        prismaMock.job.create.mockImplementation(async ({ data }: any) => {
          writes.push(data)
          return { id: "job-new", ...data }
        })
        const result = await fn(prismaMock)
        committed.push(...writes)
        return result
      })
      wallet.debit.mockRejectedValue(insufficient())
      await expect(service.createJob("rec-1", dto)).rejects.toMatchObject({
        status: 402,
        errorCode: "INSUFFICIENT_CREDITS",
      })
      expect(committed).toHaveLength(0)
      expect(cache.delByPattern).not.toHaveBeenCalled()
    })

    it("auto-created company gets wallet + sign-up bonus in the same transaction", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "rec-1",
        name: "Rec",
        companyId: null,
        emailVerifiedAt: new Date(),
      })
      prismaMock.company.create.mockResolvedValue({ id: "co-new" })
      await service.createJob("rec-1", dto)
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
      expect(wallet.credit).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "co-new",
          amount: 20,
          type: "SIGNUP_BONUS",
          referenceId: "co-new",
        }),
        prismaMock
      )
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: "co-new", type: "JOB_PUBLISH" }),
        prismaMock
      )
      // bonus is credited before the publish charge
      expect(wallet.credit.mock.invocationCallOrder[0]).toBeLessThan(
        wallet.debit.mock.invocationCallOrder[0]
      )
    })

    it("DRAFT → ACTIVE charges once (atomic claim on publishedAt = null)", async () => {
      access.jobForManagement.mockResolvedValue(draft)
      prismaMock.job.updateMany.mockResolvedValue({ count: 1 })
      await service.updateJob("job-1", { status: "ACTIVE", remote: true } as any, recruiter)
      expect(prismaMock.job.updateMany).toHaveBeenCalledWith({
        where: { id: "job-1", publishedAt: null },
        data: { publishedAt: expect.any(Date), momentumCost: 10 },
      })
      expect(pricing.publishCost).toHaveBeenCalledWith({
        remote: true,
        salary: null,
        categoryId: "cat-1",
      })
      expect(wallet.debit).toHaveBeenCalledTimes(1)
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: "co-1", type: "JOB_PUBLISH", referenceId: "job-1" }),
        prismaMock
      )

      // A concurrent publish that lost the claim is not charged again.
      wallet.debit.mockClear()
      prismaMock.job.updateMany.mockResolvedValue({ count: 0 })
      await service.updateJob("job-1", { status: "ACTIVE" }, recruiter)
      expect(wallet.debit).not.toHaveBeenCalled()
    })

    it("DRAFT → ACTIVE with insufficient credits: 402 and no update", async () => {
      access.jobForManagement.mockResolvedValue(draft)
      prismaMock.job.updateMany.mockResolvedValue({ count: 1 })
      wallet.debit.mockRejectedValue(insufficient())
      await expect(
        service.updateJob("job-1", { status: "ACTIVE" }, recruiter)
      ).rejects.toMatchObject({ status: 402 })
      expect(prismaMock.job.update).not.toHaveBeenCalled()
    })

    it("CLOSED → ACTIVE (reopen) of a published job is free", async () => {
      access.jobForManagement.mockResolvedValue({
        ...draft,
        status: "CLOSED",
        publishedAt: new Date("2026-10-01"),
      })
      await service.updateJob("job-1", { status: "ACTIVE" }, recruiter)
      expect(prismaMock.job.updateMany).not.toHaveBeenCalled()
      expect(wallet.debit).not.toHaveBeenCalled()
      expect(prismaMock.job.update).toHaveBeenCalled()
    })

    it("editing an ACTIVE job is free", async () => {
      access.jobForManagement.mockResolvedValue({
        ...draft,
        status: "ACTIVE",
        publishedAt: new Date(),
      })
      await service.updateJob("job-1", { status: "ACTIVE", title: "New" }, recruiter)
      expect(wallet.debit).not.toHaveBeenCalled()
    })

    it("admins publish for free (publishedAt still recorded)", async () => {
      access.jobForManagement.mockResolvedValue(draft)
      prismaMock.job.updateMany.mockResolvedValue({ count: 1 })
      await service.updateJob("job-1", { status: "ACTIVE" }, admin)
      expect(prismaMock.job.updateMany).toHaveBeenCalledWith({
        where: { id: "job-1", publishedAt: null },
        data: { publishedAt: expect.any(Date), momentumCost: 0 },
      })
      expect(pricing.publishCost).not.toHaveBeenCalled()
      expect(wallet.debit).not.toHaveBeenCalled()
    })

    it("GET /jobs/publish-cost returns cost, balance and breakdown", async () => {
      const result = await service.getPublishCost(
        { userId: "rec-1", role: "RECRUITER", companyId: "co-1" },
        { remote: true }
      )
      expect(result).toEqual({
        cost: 9,
        balance: 10,
        breakdown: { base: 10, multipliers: [{ name: "remote", factor: 0.9 }] },
      })
      expect(wallet.getBalance).toHaveBeenCalledWith("co-1")
    })
  })

  describe("Momentum featuring", () => {
    const recruiter = { userId: "rec-1", role: "RECRUITER" }
    const activeJob = { id: "job-1", status: "ACTIVE", companyId: "co-1", title: "T" }
    const DAY = 24 * 60 * 60 * 1000

    beforeEach(() => {
      access.jobForManagement.mockResolvedValue(activeJob)
      prismaMock.job.update.mockImplementation(async ({ data }: any) => ({
        featuredUntil: data.featuredUntil,
      }))
    })

    it("charges featureCost for the default window and starts from now", async () => {
      prismaMock.job.findUnique.mockResolvedValue({ featuredUntil: null })
      const before = Date.now()
      const result: any = await service.featureJob("job-1", undefined, recruiter)
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "co-1",
          amount: 25,
          type: "JOB_FEATURE",
          referenceId: "job-1",
        }),
        prismaMock
      )
      expect(prismaMock.job.update.mock.calls[0][0].data.featured).toBe(true)
      const until = result.featuredUntil.getTime()
      expect(until).toBeGreaterThanOrEqual(before + 14 * DAY)
      expect(until).toBeLessThanOrEqual(Date.now() + 14 * DAY)
      expect(result.balance).toBe(10)
    })

    it("extends an active window and charges proportionally (7 days = 13 credits)", async () => {
      const current = new Date(Date.now() + 5 * DAY)
      prismaMock.job.findUnique.mockResolvedValue({ featuredUntil: current })
      const result: any = await service.featureJob("job-1", 7, recruiter)
      expect(wallet.debit.mock.calls[0][0].amount).toBe(13) // round(25 × 7 / 14)
      expect(result.featuredUntil.getTime()).toBe(current.getTime() + 7 * DAY)

      wallet.debit.mockClear()
      await service.featureJob("job-1", 30, recruiter)
      expect(wallet.debit.mock.calls[0][0].amount).toBe(54) // round(25 × 30 / 14)
    })

    it("an expired window restarts from now", async () => {
      prismaMock.job.findUnique.mockResolvedValue({ featuredUntil: new Date(Date.now() - DAY) })
      const result: any = await service.featureJob("job-1", 7, recruiter)
      expect(result.featuredUntil.getTime()).toBeGreaterThan(Date.now() + 7 * DAY - 1000)
    })

    it("402 leaves the job untouched; non-ACTIVE jobs are 409 JOB_NOT_ACTIVE", async () => {
      wallet.debit.mockRejectedValue(insufficient())
      await expect(service.featureJob("job-1", 7, recruiter)).rejects.toMatchObject({
        status: 402,
      })
      expect(prismaMock.job.update).not.toHaveBeenCalled()

      access.jobForManagement.mockResolvedValue({ ...activeJob, status: "DRAFT" })
      await expect(service.featureJob("job-1", 7, recruiter)).rejects.toMatchObject({
        status: 409,
        errorCode: "JOB_NOT_ACTIVE",
      })
    })

    it("admins feature for free", async () => {
      prismaMock.job.findUnique.mockResolvedValue({ featuredUntil: null })
      await service.featureJob("job-1", 7, { userId: "a", role: "ADMIN" })
      expect(wallet.debit).not.toHaveBeenCalled()
      expect(prismaMock.job.update).toHaveBeenCalled()
    })

    it("expiry cron clears featured where featuredUntil <= now and busts the cache", async () => {
      prismaMock.job.updateMany.mockResolvedValue({ count: 2 })
      const scheduler = new FeaturedJobsScheduler(service)
      await scheduler.expire()
      const call = prismaMock.job.updateMany.mock.calls[0][0]
      expect(call.where).toEqual({ featured: true, featuredUntil: { lte: expect.any(Date) } })
      expect(call.data).toEqual({ featured: false })
      expect(cache.delByPattern).toHaveBeenCalledWith("jobs:public*")
    })

    it("public search lists currently featured jobs first", async () => {
      cache.get.mockResolvedValue(null)
      prismaMock.job.count.mockResolvedValueOnce(1).mockResolvedValueOnce(5)
      prismaMock.job.findMany
        .mockResolvedValueOnce([{ id: "featured", requirements: [] }])
        .mockResolvedValueOnce([{ id: "regular", requirements: [] }])
      const result: any[] = await service.searchPublicJobs()
      expect(result.map((j) => j.id)).toEqual(["featured", "regular"])
      const [first, second] = prismaMock.job.findMany.mock.calls.map((c: any) => c[0])
      expect(first.where.AND[1]).toEqual({ featuredUntil: { gt: expect.any(Date) } })
      expect(second.where.AND[1].OR).toEqual([
        { featuredUntil: null },
        { featuredUntil: { lte: expect.any(Date) } },
      ])
      expect(second.take).toBe(49)
    })
  })

  describe("search index + embeddings hooks", () => {
    let search: any
    let embeddings: any
    let svc: JobsService

    beforeEach(() => {
      search = {
        isEnabled: jest.fn().mockReturnValue(true),
        indexJobSoon: jest.fn(),
        removeJobSoon: jest.fn(),
        searchJobs: jest.fn(),
      }
      embeddings = { embedJobSoon: jest.fn().mockResolvedValue(undefined) }
      svc = new JobsService(
        prismaMock,
        cache,
        access,
        { createNotification: jest.fn() } as any,
        wallet,
        pricing,
        undefined,
        undefined,
        undefined,
        search,
        embeddings
      )
      cache.get.mockResolvedValue(null)
    })

    it("create indexes ACTIVE jobs and embeds every new job", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "rec-1",
        companyId: "co-1",
        emailVerifiedAt: new Date(),
      })
      prismaMock.job.count.mockResolvedValue(0)
      access.companyScope.mockResolvedValue({ manageCompanyIds: ["co-1"], companyIds: ["co-1"] })
      prismaMock.job.create.mockResolvedValue({ id: "job-9", status: "ACTIVE", requirements: [] })
      await svc.createJob("rec-1", { title: "Dev", description: "d", skills: [] } as any)
      expect(search.indexJobSoon).toHaveBeenCalledWith("job-9")
      expect(embeddings.embedJobSoon).toHaveBeenCalledWith("job-9")

      search.indexJobSoon.mockClear()
      prismaMock.job.create.mockResolvedValue({ id: "job-10", status: "DRAFT", requirements: [] })
      await svc.createJob("rec-1", { title: "Dev", status: "DRAFT", skills: [] } as any)
      expect(search.indexJobSoon).not.toHaveBeenCalled()
      expect(embeddings.embedJobSoon).toHaveBeenCalledWith("job-10")
    })

    it("update reindexes public jobs; embeds only when embedded fields change", async () => {
      const recruiter = { userId: "rec-1", role: "RECRUITER" } as any
      access.jobForManagement.mockResolvedValue({
        id: "job-1",
        status: "ACTIVE",
        title: "t",
        description: "d",
        requirements: [],
        benefits: [],
        publishedAt: new Date(),
      })
      prismaMock.job.update.mockResolvedValue({ id: "job-1", status: "ACTIVE" })
      await svc.updateJob("job-1", { location: "Paris" } as any, recruiter)
      expect(search.indexJobSoon).toHaveBeenCalledWith("job-1")
      expect(embeddings.embedJobSoon).not.toHaveBeenCalled()

      prismaMock.job.update.mockResolvedValue({ id: "job-1", status: "CLOSED" })
      await svc.updateJob("job-1", { status: "CLOSED" } as any, recruiter)
      expect(search.indexJobSoon).toHaveBeenCalledTimes(2)
      expect(embeddings.embedJobSoon).toHaveBeenCalledWith("job-1")
    })

    it("draft edits are not indexed", async () => {
      access.jobForManagement.mockResolvedValue({ id: "job-1", status: "DRAFT", benefits: [] })
      prismaMock.job.update.mockResolvedValue({ id: "job-1", status: "DRAFT" })
      await svc.updateJob("job-1", { location: "Rome" } as any, { userId: "r", role: "RECRUITER" } as any)
      expect(search.indexJobSoon).not.toHaveBeenCalled()
    })

    it("feature reindexes and delete removes from the index", async () => {
      access.jobForManagement.mockResolvedValue({
        id: "job-1",
        status: "ACTIVE",
        companyId: "co-1",
        title: "t",
      })
      prismaMock.job.findUnique.mockResolvedValue({ featuredUntil: null })
      prismaMock.job.update.mockResolvedValue({ featuredUntil: new Date() })
      await svc.featureJob("job-1", 14, { userId: "r", role: "RECRUITER" } as any)
      expect(search.indexJobSoon).toHaveBeenCalledWith("job-1")

      prismaMock.job.delete.mockResolvedValue({})
      await svc.deleteJob("job-1", { userId: "r", role: "RECRUITER" } as any)
      expect(search.removeJobSoon).toHaveBeenCalledWith("job-1")
    })

    it("hook failures never fail the request", async () => {
      embeddings.embedJobSoon.mockRejectedValue(new Error("queue down"))
      search.removeJobSoon.mockImplementation(() => {
        throw new Error("boom")
      })
      access.jobForManagement.mockResolvedValue({ id: "job-1", status: "ACTIVE" })
      prismaMock.job.delete.mockResolvedValue({})
      await expect(
        svc.deleteJob("job-1", { userId: "r", role: "RECRUITER" } as any)
      ).resolves.toEqual({ id: "job-1", deleted: true })
    })

    it("queries use Meili ids, hydrate ACTIVE rows from Postgres and keep Meili order", async () => {
      search.searchJobs.mockResolvedValue({ ids: ["b", "gone", "a"], total: 3 })
      prismaMock.job.findMany.mockResolvedValue([
        { id: "a", requirements: [] },
        { id: "b", requirements: null },
      ])
      const page = await svc.searchPublicJobsPage("react", "FULL_TIME" as any, "eng", true, {
        limit: 10,
        offset: 20,
      })
      expect(page.items.map((j: any) => j.id)).toEqual(["b", "a"])
      expect(page.items[0].requirements).toEqual([])
      expect(page.total).toBe(3)
      expect(search.searchJobs).toHaveBeenCalledWith({
        q: "react",
        type: "FULL_TIME",
        categorySlug: "eng",
        remote: true,
        limit: 10,
        offset: 20,
      })
      expect(prismaMock.job.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ["b", "gone", "a"] },
        status: "ACTIVE",
      })
      expect(cache.set).toHaveBeenCalledWith(
        "jobs:public:react:FULL_TIME:eng:true:10:20",
        page,
        120
      )
    })

    it("falls back to Postgres when Meili is down or the query is empty", async () => {
      search.searchJobs.mockResolvedValue(null)
      prismaMock.job.count.mockResolvedValue(0)
      prismaMock.job.findMany.mockResolvedValue([])
      await svc.searchPublicJobsPage("react")
      expect(prismaMock.job.findMany.mock.calls[0][0].where.AND[0].OR).toBeDefined()

      search.searchJobs.mockClear()
      await svc.searchPublicJobsPage("  ")
      expect(search.searchJobs).not.toHaveBeenCalled()
    })

    it("Postgres pagination continues past the featured block and clamps the limit", async () => {
      prismaMock.job.count.mockResolvedValueOnce(3).mockResolvedValueOnce(40)
      prismaMock.job.findMany.mockResolvedValueOnce([{ id: "x", requirements: [] }])
      const page = await svc.searchPublicJobsPage(undefined, undefined, undefined, false, {
        limit: 500,
        offset: 10,
      })
      expect(page.total).toBe(43)
      // offset 10 >= 3 featured: only the regular query runs, skipping 7 of them
      expect(prismaMock.job.findMany).toHaveBeenCalledTimes(1)
      expect(prismaMock.job.findMany.mock.calls[0][0]).toMatchObject({ skip: 7, take: 100 })
    })
  })
})
