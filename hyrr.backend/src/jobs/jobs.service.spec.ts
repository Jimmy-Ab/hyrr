import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { CacheService } from "../cache/cache.service"
import { AccessService } from "../core/access/access.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { JobsService } from "./jobs.service"

describe("JobsService", () => {
  let service: JobsService
  let prismaMock: any
  let access: any

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() },
        },
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
    prismaMock.job.findMany.mockResolvedValue([
      { id: "job-2", title: "Product Designer", status: "ACTIVE" },
    ] as any)

    const result = await service.searchPublicJobs("Design")
    expect(result).toHaveLength(1)
    expect(prismaMock.job.findMany).toHaveBeenCalled()
  })

  it("searches with case-insensitive contains instead of a raw tsquery", async () => {
    prismaMock.job.findMany.mockResolvedValue([{ id: "job-2", requirements: null }])
    const result: any[] = await service.searchPublicJobs("acme")
    const where = prismaMock.job.findMany.mock.calls[0][0].where
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
})
