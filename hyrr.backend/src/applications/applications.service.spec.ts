import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AiService } from "../ai/ai.service"
import { PricingService } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { AccessService } from "../core/access/access.service"
import { CaptchaService } from "../core/security/captcha.service"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { ApplicationsService, SEEKER_APPLICATION_FIELDS } from "./applications.service"

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe("ApplicationsService", () => {
  let service: ApplicationsService
  let prismaMock: any
  let access: any
  let notifications: any
  let ai: any
  let gateway: any
  let captcha: any
  let wallet: any

  const activeJob = { id: "job-1", status: "ACTIVE", title: "Engineer", recruiterId: "rec-1" }
  const applyDto = {
    name: "James Carter",
    email: "james@example.com",
    title: "Engineer",
    location: "SF",
  }

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    // Interactive transactions run against the same mock; batch transactions resolve the array.
    prismaMock.$transaction.mockImplementation((arg: any) =>
      typeof arg === "function" ? arg(prismaMock) : Promise.all(arg)
    )
    access = {
      jobForManagement: jest.fn().mockResolvedValue({ id: "job-1" }),
      jobForView: jest.fn().mockResolvedValue({ id: "job-1" }),
      applicationFor: jest.fn(),
      jobScopeWhere: jest.fn().mockResolvedValue({ OR: [{ companyId: { in: ["co-1"] } }] }),
    }
    notifications = { createNotification: jest.fn().mockResolvedValue({}) }
    ai = {
      scoreApplication: jest.fn().mockResolvedValue({ score: 80, summary: "ok" }),
      resolveModel: jest.fn().mockResolvedValue({ model: "gpt-4o-mini", provider: "openai" }),
    }
    gateway = { emitAiScoreUpdate: jest.fn(), emitApplicationUpdate: jest.fn() }
    captcha = {
      isEnabled: jest.fn().mockReturnValue(false),
      verify: jest.fn().mockResolvedValue(undefined),
    }
    wallet = {
      debit: jest.fn().mockResolvedValue({ balanceAfter: 18, transactionId: "t1" }),
      credit: jest.fn().mockResolvedValue({ balanceAfter: 20, transactionId: "t2" }),
      hasCharge: jest.fn(async (type: string) => type === "AI_ANALYSIS"),
    }
    // Seekers in these tests have a verified e-mail unless a test says otherwise.
    prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AccessService, useValue: access },
        { provide: NotificationsService, useValue: notifications },
        { provide: AiService, useValue: ai },
        { provide: MessagesGateway, useValue: gateway },
        { provide: CaptchaService, useValue: captcha },
        { provide: WalletService, useValue: wallet },
        {
          provide: PricingService,
          useValue: { getConfig: jest.fn().mockResolvedValue({ aiRerunCost: 2, applyCost: 1 }) },
        },
      ],
    }).compile()

    service = module.get<ApplicationsService>(ApplicationsService)
  })

  describe("applyToJob (C1)", () => {
    it("should allow applying to a job", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.application.findFirst.mockResolvedValue(null)
      prismaMock.application.create.mockResolvedValue({ id: "app-123", status: "APPLIED" } as any)
      prismaMock.application.findUnique.mockResolvedValue({ id: "app-123", status: "APPLIED" })

      const result: any = await service.applyToJob("job-1", applyDto, {
        userId: "seeker-1",
        role: "SEEKER",
        email: "james@example.com",
      })

      expect(result.id).toBe("app-123")
      expect(result.status).toBe("APPLIED")
      expect(notifications.createNotification).toHaveBeenCalledWith(
        "rec-1",
        expect.any(String),
        "APPLICATION",
        "APPLICATIONS"
      )
      expect(ai.scoreApplication).toHaveBeenCalledWith("app-123")
    })

    it("returns 404 JOB_NOT_FOUND for a non-ACTIVE job", async () => {
      prismaMock.job.findUnique.mockResolvedValue({ ...activeJob, status: "CLOSED" })
      await expect(service.applyToJob("job-1", applyDto, null)).rejects.toMatchObject({
        status: 404,
        errorCode: "JOB_NOT_FOUND",
      })
      expect(prismaMock.application.create).not.toHaveBeenCalled()
    })

    it("upgrades a SAVED application to APPLIED instead of creating a duplicate", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.application.findFirst.mockResolvedValue({ id: "app-saved", status: "SAVED" })
      prismaMock.application.update.mockResolvedValue({ id: "app-saved", status: "APPLIED" })
      prismaMock.applicationStageEvent.create.mockResolvedValue({})
      prismaMock.application.findUnique.mockResolvedValue({ id: "app-saved", status: "APPLIED" })

      const result: any = await service.applyToJob(
        "job-1",
        { ...applyDto, coverLetter: "Hi", resumeUrl: "http://localhost:3000/api/uploads/a.pdf" },
        { userId: "seeker-1", role: "SEEKER", email: "james@example.com" }
      )

      expect(prismaMock.application.create).not.toHaveBeenCalled()
      expect(prismaMock.application.update).toHaveBeenCalledWith({
        where: { id: "app-saved" },
        data: expect.objectContaining({
          status: "APPLIED",
          coverLetter: "Hi",
          resumeUrl: "http://localhost:3000/api/uploads/a.pdf",
          appliedAt: expect.any(Date),
        }),
      })
      expect(prismaMock.applicationStageEvent.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.applicationStageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: "SAVED", toStatus: "APPLIED" }),
      })
      expect(result.id).toBe("app-saved")
      expect(result.status).toBe("APPLIED")
    })

    it("seeker re-applying to a non-SAVED application gets 409 ALREADY_APPLIED", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.application.findFirst.mockResolvedValue({ id: "app-1", status: "IN_PROCESS" })
      await expect(
        service.applyToJob("job-1", applyDto, { userId: "seeker-1", role: "SEEKER" })
      ).rejects.toMatchObject({ status: 409, errorCode: "ALREADY_APPLIED" })
    })

    it("seekers with an unverified e-mail get 403 EMAIL_NOT_VERIFIED", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.user.findUnique.mockResolvedValue({ emailVerifiedAt: null })
      await expect(
        service.applyToJob("job-1", applyDto, { userId: "seeker-1", role: "SEEKER" })
      ).rejects.toMatchObject({ status: 403, errorCode: "EMAIL_NOT_VERIFIED" })
      expect(prismaMock.application.create).not.toHaveBeenCalled()
      expect(prismaMock.application.update).not.toHaveBeenCalled()
    })

    it("recruiters cannot apply (403)", async () => {
      await expect(
        service.applyToJob("job-1", applyDto, { userId: "rec-1", role: "RECRUITER" })
      ).rejects.toMatchObject({ status: 403 })
    })

    it("guests must sign in: 401 LOGIN_REQUIRED and nothing is written", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      await expect(service.applyToJob("job-1", applyDto, null)).rejects.toMatchObject({
        status: 401,
        errorCode: "LOGIN_REQUIRED",
      })
      expect(prismaMock.application.create).not.toHaveBeenCalled()
      expect(wallet.debit).not.toHaveBeenCalled()
    })

    it("charges the apply cost to the seeker's wallet inside the apply transaction", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.application.findFirst.mockResolvedValue(null)
      prismaMock.application.create.mockResolvedValue({ id: "app-77", status: "APPLIED" })
      prismaMock.application.findUnique.mockResolvedValue({ id: "app-77", status: "APPLIED" })
      await service.applyToJob("job-1", applyDto, { userId: "seeker-1", role: "SEEKER" })
      expect(wallet.debit).toHaveBeenCalledTimes(1)
      expect(wallet.debit.mock.calls[0][0]).toMatchObject({
        userId: "seeker-1",
        amount: 1,
        type: "APPLICATION",
        referenceId: "app-77",
      })
    })

    it("402 INSUFFICIENT_CREDITS propagates (the transaction rolls back)", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.application.findFirst.mockResolvedValue(null)
      prismaMock.application.create.mockResolvedValue({ id: "app-78", status: "APPLIED" })
      const { AppException } = await import("../core/exceptions/app-exception")
      wallet.debit.mockRejectedValueOnce(
        new AppException("no credits", 402, "INSUFFICIENT_CREDITS", { balance: 0, required: 1 })
      )
      await expect(
        service.applyToJob("job-1", applyDto, { userId: "seeker-1", role: "SEEKER" })
      ).rejects.toMatchObject({ status: 402, errorCode: "INSUFFICIENT_CREDITS" })
      expect(ai.scoreApplication).not.toHaveBeenCalled()
    })

    it("starts background AI analysis after a seeker applies", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.application.findFirst.mockResolvedValue(null)
      prismaMock.application.create.mockResolvedValue({ id: "app-s", status: "APPLIED" })
      prismaMock.application.findUnique.mockResolvedValue({ id: "app-s", status: "APPLIED" })

      await service.applyToJob("job-1", applyDto, { userId: "seeker-1", role: "SEEKER" })
      await flush()

      expect(ai.scoreApplication).toHaveBeenCalledWith("app-s")
    })

    it("seeker payload never selects any ai* field", async () => {
      prismaMock.job.findUnique.mockResolvedValue(activeJob)
      prismaMock.application.findFirst.mockResolvedValue(null)
      prismaMock.application.create.mockResolvedValue({ id: "app-123", status: "APPLIED" } as any)
      prismaMock.application.findUnique.mockResolvedValue({ id: "app-123", status: "APPLIED" })

      await service.applyToJob("job-1", applyDto, {
        userId: "seeker-1",
        role: "SEEKER",
        email: "james@example.com",
      })

      const select = prismaMock.application.findUnique.mock.calls[0][0].select
      expect(Object.keys(select).filter((k) => /^ai/i.test(k))).toEqual([])
      expect(Object.keys(SEEKER_APPLICATION_FIELDS).filter((k) => /^ai/i.test(k))).toEqual([])
    })
  })

  describe("createCandidate (C2)", () => {
    it("creates a guest application for the job", async () => {
      prismaMock.application.findFirst.mockResolvedValue(null)
      prismaMock.application.create.mockResolvedValue({ id: "cand-1", status: "INTERVIEWING" })

      const result: any = await service.createCandidate(
        "job-1",
        { candidateName: "Ada", email: "ada@example.com", status: "INTERVIEWING" },
        { userId: "rec-1", role: "RECRUITER" }
      )

      expect(access.jobForManagement).toHaveBeenCalled()
      expect(prismaMock.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: null,
            name: "Ada",
            status: "INTERVIEWING",
            tag: "Interview Stage",
          }),
        })
      )
      expect(prismaMock.applicationStageEvent.create).toHaveBeenCalled()
      expect(result.id).toBe("cand-1")
    })

    it("rejects a duplicate email with 409", async () => {
      prismaMock.application.findFirst.mockResolvedValue({ id: "dup" })
      await expect(
        service.createCandidate(
          "job-1",
          { candidateName: "Ada", email: "ada@example.com" },
          { userId: "rec-1", role: "RECRUITER" }
        )
      ).rejects.toMatchObject({ status: 409, errorCode: "ALREADY_APPLIED" })
    })
  })

  describe("recruiter lists (C4)", () => {
    it("should fetch candidates for Kanban board", async () => {
      prismaMock.application.findMany.mockResolvedValue([
        { id: "app-1", status: "APPLIED" },
        { id: "app-2", status: "IN_PROCESS" },
      ] as any)

      const result = await service.getCandidatesForJob("job-1", {
        userId: "recruiter-1",
        role: "RECRUITER",
      })
      expect(result).toHaveLength(2)
    })

    it("excludes SAVED and paginates the job board", async () => {
      prismaMock.application.findMany.mockResolvedValue([])
      await service.getCandidatesForJob(
        "job-1",
        { userId: "rec-1", role: "RECRUITER" },
        { take: 9999, skip: 10 }
      )
      expect(prismaMock.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: "job-1", status: { not: "SAVED" } },
          take: 500,
          skip: 10,
        })
      )
    })

    it("excludes SAVED from company candidates and scopes by company", async () => {
      prismaMock.application.findMany.mockResolvedValue([])
      await service.getAllCompanyCandidates({ userId: "rec-1", role: "RECRUITER" })
      const args = prismaMock.application.findMany.mock.calls[0][0]
      expect(args.where.AND).toEqual(
        expect.arrayContaining([
          { status: { not: "SAVED" } },
          { job: { OR: [{ companyId: { in: ["co-1"] } }] } },
        ])
      )
      expect(args.take).toBe(200)
    })
  })

  describe("deleteApplication (C3)", () => {
    const seeker = { userId: "seeker-1", role: "SEEKER" }

    it("seeker unsaves a SAVED application (hard delete)", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "SAVED", job: activeJob })
      const result = await service.deleteApplication("app-1", seeker)
      expect(prismaMock.application.delete).toHaveBeenCalledWith({ where: { id: "app-1" } })
      expect(result).toEqual({ id: "app-1", deleted: true })
    })

    it("seeker withdraws an active application", async () => {
      access.applicationFor.mockResolvedValue({
        id: "app-1",
        name: "James",
        status: "INTERVIEWING",
        job: activeJob,
      })
      const result = await service.deleteApplication("app-1", seeker)

      expect(prismaMock.application.delete).not.toHaveBeenCalled()
      expect(prismaMock.application.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: expect.objectContaining({ status: "WITHDRAWN" }),
      })
      expect(prismaMock.applicationStageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: "INTERVIEWING", toStatus: "WITHDRAWN" }),
      })
      expect(notifications.createNotification).toHaveBeenCalledWith(
        "rec-1",
        expect.stringContaining("withdrew"),
        "APPLICATION",
        "APPLICATIONS"
      )
      expect(result).toEqual({ id: "app-1", status: "WITHDRAWN" })
    })

    it("withdrawing twice is a 409", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "WITHDRAWN", job: activeJob })
      await expect(service.deleteApplication("app-1", seeker)).rejects.toMatchObject({
        status: 409,
      })
    })

    it("recruiter hard-deletes with manage access", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "APPLIED", job: activeJob })
      const result = await service.deleteApplication("app-1", {
        userId: "rec-1",
        role: "RECRUITER",
      })
      expect(access.applicationFor).toHaveBeenCalledWith(expect.anything(), "app-1", "manage")
      expect(result).toEqual({ id: "app-1", deleted: true })
    })
  })

  describe("updateApplication (C5)", () => {
    const recruiter = { userId: "rec-1", role: "RECRUITER" }

    it("WITHDRAWN applications cannot change status (409)", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "WITHDRAWN", job: activeJob })
      await expect(
        service.updateApplication("app-1", { status: "OFFER" }, recruiter)
      ).rejects.toMatchObject({ status: 409, errorCode: "APPLICATION_WITHDRAWN" })
      expect(prismaMock.application.update).not.toHaveBeenCalled()
    })

    it("recruiters cannot set SAVED or WITHDRAWN", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "APPLIED", job: activeJob })
      await expect(
        service.updateApplication("app-1", { status: "WITHDRAWN" }, recruiter)
      ).rejects.toMatchObject({ status: 400 })
      await expect(
        service.updateApplication("app-1", { status: "SAVED" }, recruiter)
      ).rejects.toMatchObject({ status: 400 })
    })

    it("updates status, writes a stage event, notifies and returns the candidate with tag", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "APPLIED", job: activeJob })
      prismaMock.application.update.mockResolvedValue({
        id: "app-1",
        userId: "seeker-1",
        status: "OFFER",
        tag: "Offer Sent",
        aiScore: 70,
        job: { title: "Engineer" },
      })

      const result: any = await service.updateApplication("app-1", { status: "OFFER" }, recruiter)

      expect(prismaMock.$transaction).toHaveBeenCalled()
      expect(prismaMock.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "OFFER", tag: "Offer Sent" } })
      )
      expect(prismaMock.applicationStageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: "APPLIED", toStatus: "OFFER" }),
      })
      expect(notifications.createNotification).toHaveBeenCalledWith(
        "seeker-1",
        expect.stringContaining("Offer Extended"),
        "OFFER",
        "APPLICATIONS"
      )
      expect(result.tag).toBe("Offer Sent")
    })

    it("does not re-run AI analysis on ordinary updates (even when unscored)", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "APPLIED", job: activeJob })
      prismaMock.application.update.mockResolvedValue({
        id: "app-1",
        userId: null,
        status: "APPLIED",
        aiScore: null,
        job: { title: "Engineer" },
      })
      await service.updateApplication("app-1", { notes: "call back" } as any, recruiter)
      await flush()
      expect(ai.scoreApplication).not.toHaveBeenCalled()
    })

    it("seekers may only toggle seekerBookmarked", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "APPLIED", job: activeJob })
      await expect(
        service.updateApplication("app-1", { status: "OFFER" }, { userId: "s", role: "SEEKER" })
      ).rejects.toMatchObject({ status: 403 })
    })
  })
  describe("analyzeApplication (A1)", () => {
    const recruiter = { userId: "rec-1", role: "RECRUITER" }

    it("requires manage access", async () => {
      access.applicationFor.mockRejectedValue(
        Object.assign(new Error("Forbidden"), { status: 403 })
      )
      await expect(service.analyzeApplication("app-1", recruiter)).rejects.toMatchObject({
        status: 403,
      })
      expect(access.applicationFor).toHaveBeenCalledWith(recruiter, "app-1", "manage")
      expect(ai.scoreApplication).not.toHaveBeenCalled()
    })

    it("returns 503 AI_DISABLED and marks the application when no provider is configured", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", status: "APPLIED", job: activeJob })
      ai.resolveModel.mockResolvedValue(null)
      prismaMock.application.update.mockResolvedValue({})
      await expect(service.analyzeApplication("app-1", recruiter)).rejects.toMatchObject({
        status: 503,
        errorCode: "AI_DISABLED",
      })
      expect(prismaMock.application.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: { aiStatus: "DISABLED" },
      })
      expect(ai.scoreApplication).not.toHaveBeenCalled()
    })

    it("returns 409 AI_ALREADY_RUNNING while a recent analysis is pending", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", aiStatus: "PENDING", job: activeJob })
      prismaMock.application.updateMany.mockResolvedValue({ count: 0 })
      await expect(service.analyzeApplication("app-1", recruiter)).rejects.toMatchObject({
        status: 409,
        errorCode: "AI_ALREADY_RUNNING",
      })
      const where = prismaMock.application.updateMany.mock.calls[0][0].where
      expect(where.id).toBe("app-1")
      const stale = where.OR.find((c: any) => c.updatedAt)
      expect(Date.now() - stale.updatedAt.lt.getTime()).toBeGreaterThanOrEqual(2 * 60 * 1000 - 50)
      expect(ai.scoreApplication).not.toHaveBeenCalled()
    })

    it("claims the run, kicks off analysis and returns PENDING", async () => {
      access.applicationFor.mockResolvedValue({ id: "app-1", aiStatus: "FAILED", job: activeJob })
      prismaMock.application.updateMany.mockResolvedValue({ count: 1 })
      const result = await service.analyzeApplication("app-1", recruiter)
      await flush()
      expect(result).toEqual({ applicationId: "app-1", aiStatus: "PENDING" })
      expect(prismaMock.application.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { aiStatus: "PENDING", aiError: null } })
      )
      expect(ai.scoreApplication).toHaveBeenCalledWith("app-1")
    })

    describe("Momentum charge", () => {
      const paidJob = { ...activeJob, companyId: "co-1" }
      beforeEach(() => {
        access.applicationFor.mockResolvedValue({ id: "app-1", aiStatus: "DONE", job: paidJob })
        prismaMock.application.updateMany.mockResolvedValue({ count: 1 })
      })

      it("debits aiRerunCost in the claim transaction and keeps it when the run succeeds", async () => {
        ai.scoreApplication.mockResolvedValue({ score: 70, summary: "ok", status: "DONE" })
        await service.analyzeApplication("app-1", recruiter)
        await flush()
        await flush()
        expect(wallet.debit).toHaveBeenCalledWith(
          expect.objectContaining({
            companyId: "co-1",
            amount: 2,
            type: "AI_ANALYSIS",
            referenceId: expect.stringMatching(/^app-1:\d+$/),
          }),
          prismaMock
        )
        expect(wallet.credit).not.toHaveBeenCalled()
      })

      it.each(["FAILED", "DISABLED"])("refunds once when the run ends %s", async (status) => {
        ai.scoreApplication.mockResolvedValue({ score: null, summary: null, status })
        await service.analyzeApplication("app-1", recruiter)
        await flush()
        await flush()
        const runId = wallet.debit.mock.calls[0][0].referenceId
        expect(wallet.credit).toHaveBeenCalledTimes(1)
        expect(wallet.credit).toHaveBeenCalledWith(
          expect.objectContaining({
            companyId: "co-1",
            amount: 2,
            type: "REFUND",
            referenceId: runId,
          })
        )
      })

      it("a refund is never written twice for the same run", async () => {
        wallet.hasCharge.mockResolvedValue(true) // AI_ANALYSIS and REFUND both exist
        await service.refundAnalysis("co-1", 2, "app-1:1", "rec-1", "FAILED")
        expect(wallet.credit).not.toHaveBeenCalled()
      })

      it("402 INSUFFICIENT_CREDITS: no run starts and the claim rolls back with the transaction", async () => {
        wallet.debit.mockRejectedValue(
          Object.assign(new Error("Not enough"), { status: 402, errorCode: "INSUFFICIENT_CREDITS" })
        )
        await expect(service.analyzeApplication("app-1", recruiter)).rejects.toMatchObject({
          status: 402,
        })
        expect(ai.scoreApplication).not.toHaveBeenCalled()
      })

      it("503 AI_DISABLED and 409 AI_ALREADY_RUNNING are never charged", async () => {
        ai.resolveModel.mockResolvedValueOnce(null)
        prismaMock.application.update.mockResolvedValue({})
        await expect(service.analyzeApplication("app-1", recruiter)).rejects.toMatchObject({
          status: 503,
        })
        prismaMock.application.updateMany.mockResolvedValue({ count: 0 })
        await expect(service.analyzeApplication("app-1", recruiter)).rejects.toMatchObject({
          status: 409,
        })
        expect(wallet.debit).not.toHaveBeenCalled()
      })

      it("admins re-run for free; automatic first analysis after applying is free", async () => {
        await service.analyzeApplication("app-1", { userId: "a", role: "ADMIN" })
        expect(wallet.debit).not.toHaveBeenCalled()
        service.scoreInBackground("app-1")
        expect(wallet.debit).not.toHaveBeenCalled()
      })
    })
  })
})
