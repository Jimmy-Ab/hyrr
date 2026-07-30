import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { DeepMockProxy, mockDeep } from "jest-mock-extended"
import { PrismaService } from "../prisma/prisma.service"
import { JobsService } from "./jobs.service"

describe("JobsService", () => {
  let service: JobsService
  let prismaMock: DeepMockProxy<PrismaClient>

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile()

    service = module.get<JobsService>(JobsService)
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
})
