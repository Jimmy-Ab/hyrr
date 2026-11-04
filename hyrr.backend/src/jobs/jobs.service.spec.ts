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
    expect(prismaMock.job.findFirst.mock.calls[0][0].where).toEqual({ id: "job-x", status: "ACTIVE" })
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
    await expect(service.updateJob("job-1", { status: "ACTIVE" }, recruiter)).rejects.toMatchObject({
      status: 403,
    })
    access.jobForManagement.mockResolvedValue({ id: "job-1", status: "ACTIVE" })
    await expect(service.updateJob("job-1", { status: "FLAGGED" }, recruiter)).rejects.toMatchObject({
      status: 400,
    })
    expect(prismaMock.job.update).not.toHaveBeenCalled()
  })

  it("only notifies INSTANT alerts, in bulk", async () => {
    prismaMock.jobAlert.findMany.mockResolvedValue([
      { userId: "u1", keywords: ["react"], locations: [] },
      { userId: "u1", keywords: [], locations: [] },
      { userId: "u2", keywords: ["cobol"], locations: [] },
    ])
    prismaMock.notification.createManyAndReturn.mockResolvedValue([{ id: "n1", userId: "u1" }])
    prismaMock.user.findMany.mockResolvedValue([])

    const count = await service.notifyMatchingAlerts({
      id: "job-1",
      title: "React Developer",
      location: "Berlin",
      type: "FULL_TIME",
      remote: false,
      skills: ["React"],
      recruiterId: "rec-1",
    })

    const where = prismaMock.jobAlert.findMany.mock.calls[0][0].where
    expect(where.frequency).toBe("INSTANT")
    expect(prismaMock.jobAlert.findMany.mock.calls[0][0].take).toBeGreaterThan(0)
    expect(count).toBe(1)
    expect(prismaMock.notification.createManyAndReturn).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.createManyAndReturn.mock.calls[0][0].data).toHaveLength(1)
  })
})
