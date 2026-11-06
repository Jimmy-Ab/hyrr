import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { TalentService } from "./talent.service"

describe("TalentService team management", () => {
  let prisma: any
  let service: TalentService
  const owner = { userId: "owner-1", role: "RECRUITER", companyId: "co-1" }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    service = new TalentService(prisma, {} as any)
  })

  const asMember = (role: string) =>
    prisma.companyMember.findUnique.mockResolvedValue({
      id: "m",
      companyId: "co-1",
      userId: "owner-1",
      role,
    })

  it("rejects non-owners adding members", async () => {
    asMember("RECRUITER")
    await expect(
      service.addTeamMember(owner, { email: "x@y.z", role: "RECRUITER" })
    ).rejects.toThrow(ForbiddenException)
    expect(prisma.companyMember.create).not.toHaveBeenCalled()
  })

  it("never grants OWNER through the team route", async () => {
    asMember("OWNER")
    await expect(service.addTeamMember(owner, { email: "x@y.z", role: "OWNER" })).rejects.toThrow(
      BadRequestException
    )
  })

  it("cannot pull in a recruiter who already belongs to another company", async () => {
    asMember("OWNER")
    prisma.user.findFirst.mockResolvedValue({ id: "t1", role: "RECRUITER", companyId: "co-2" })
    prisma.companyMember.findMany.mockResolvedValue([])
    prisma.companyMember.count.mockResolvedValue(3)
    prisma.job.count.mockResolvedValue(0)
    await expect(service.addTeamMember(owner, { email: "t@y.z", role: "VIEWER" })).rejects.toThrow(
      ConflictException
    )
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it("lets a recruiter whose personal company is empty join, removing that company", async () => {
    asMember("OWNER")
    prisma.user.findFirst.mockResolvedValue({ id: "t1", role: "RECRUITER", companyId: "co-solo" })
    prisma.companyMember.findMany.mockResolvedValue([
      { id: "ms", companyId: "co-solo", userId: "t1", role: "OWNER" },
    ])
    prisma.companyMember.count.mockResolvedValue(0)
    prisma.job.count.mockResolvedValue(0)
    prisma.companyMember.create.mockResolvedValue({
      id: "m3",
      companyId: "co-1",
      userId: "t1",
      role: "RECRUITER",
      user: { id: "t1", name: "T", email: "t@y.z", avatar: "a" },
    })
    await service.addTeamMember(owner, { email: "t@y.z", role: "RECRUITER" })
    expect(prisma.company.deleteMany).toHaveBeenCalledWith({ where: { id: "co-solo" } })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { companyId: "co-1" },
    })
  })

  it("refuses a recruiter whose company already has jobs", async () => {
    asMember("OWNER")
    prisma.user.findFirst.mockResolvedValue({ id: "t1", role: "RECRUITER", companyId: "co-solo" })
    prisma.companyMember.findMany.mockResolvedValue([
      { id: "ms", companyId: "co-solo", userId: "t1", role: "OWNER" },
    ])
    prisma.companyMember.count.mockResolvedValue(0)
    prisma.job.count.mockResolvedValue(2)
    await expect(service.addTeamMember(owner, { email: "t@y.z", role: "VIEWER" })).rejects.toThrow(
      ConflictException
    )
    expect(prisma.company.deleteMany).not.toHaveBeenCalled()
  })

  it("only adds existing RECRUITER accounts", async () => {
    asMember("OWNER")
    prisma.user.findFirst.mockResolvedValue({ id: "s1", role: "SEEKER", companyId: null })
    await expect(service.addTeamMember(owner, { email: "s@y.z", role: "VIEWER" })).rejects.toThrow(
      NotFoundException
    )
  })

  it("adds an unattached recruiter and returns the GET shape", async () => {
    asMember("OWNER")
    prisma.user.findFirst.mockResolvedValue({ id: "t1", role: "RECRUITER", companyId: null })
    prisma.companyMember.findMany.mockResolvedValue([])
    prisma.companyMember.create.mockResolvedValue({
      id: "m2",
      companyId: "co-1",
      userId: "t1",
      role: "HIRING_MANAGER",
      user: { id: "t1", name: "T", email: "t@y.z", avatar: "a" },
    })
    const result = await service.addTeamMember(owner, { email: "t@y.z", role: "HIRING_MANAGER" })
    expect(result).toEqual({
      id: "m2",
      userId: "t1",
      role: "HIRING_MANAGER",
      user: { id: "t1", name: "T", email: "t@y.z", avatar: "a" },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { companyId: "co-1" },
    })
  })

  it("owners cannot remove themselves", async () => {
    asMember("OWNER")
    prisma.companyMember.findUnique
      .mockResolvedValueOnce({ id: "m", companyId: "co-1", userId: "owner-1", role: "OWNER" })
      .mockResolvedValueOnce({ id: "m", companyId: "co-1", userId: "owner-1", role: "OWNER" })
    await expect(service.removeTeamMember(owner, "m")).rejects.toThrow(BadRequestException)
  })

  it("seekers cannot use team endpoints", async () => {
    await expect(
      service.listTeam({ userId: "s", role: "SEEKER", companyId: null })
    ).rejects.toThrow(ForbiddenException)
  })
})

describe("TalentService job reports", () => {
  let prisma: any
  let access: any
  let notifications: any
  let cache: any
  let service: TalentService
  const seeker = { userId: "seeker-1", role: "SEEKER" }
  const job = {
    id: "job-1",
    title: "Data entry",
    status: "ACTIVE",
    companyId: "co-1",
    recruiterId: "rec-1",
  }

  beforeEach(() => {
    delete process.env.JOB_REPORT_FLAG_THRESHOLD
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    access = { companyScope: jest.fn().mockResolvedValue({ companyIds: [], manageCompanyIds: [] }) }
    notifications = { createNotification: jest.fn().mockResolvedValue({}) }
    cache = { delByPattern: jest.fn().mockResolvedValue(undefined) }
    service = new TalentService(prisma, access, notifications, cache)
    prisma.job.findUnique.mockResolvedValue(job)
    prisma.jobReport.findUnique.mockResolvedValue(null)
    prisma.jobReport.create.mockResolvedValue({ id: "r1" })
    prisma.job.updateMany.mockResolvedValue({ count: 1 })
  })

  it("records a report below the threshold without flagging", async () => {
    prisma.jobReport.count.mockResolvedValue(4)
    await expect(
      service.reportJob(seeker, "job-1", { reason: "SCAM", details: "  asks for a fee " })
    ).resolves.toEqual({ reported: true })
    expect(prisma.jobReport.create).toHaveBeenCalledWith({
      data: { jobId: "job-1", reporterId: "seeker-1", reason: "SCAM", details: "asks for a fee" },
    })
    expect(prisma.job.updateMany).not.toHaveBeenCalled()
    expect(notifications.createNotification).not.toHaveBeenCalled()
  })

  it("flags the job at the threshold, clears caches and notifies the poster once", async () => {
    prisma.jobReport.count.mockResolvedValue(5)
    await service.reportJob(seeker, "job-1", { reason: "SCAM" })
    expect(prisma.job.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: "ACTIVE" },
      data: { status: "FLAGGED" },
    })
    expect(cache.delByPattern).toHaveBeenCalledWith("jobs:public*")
    expect(cache.delByPattern).toHaveBeenCalledWith("ai:featured-jobs:*")
    expect(notifications.createNotification).toHaveBeenCalledWith(
      "rec-1",
      expect.stringContaining("under review"),
      "SYSTEM",
      undefined,
      "job-1"
    )
  })

  it("does not notify again when a concurrent report already flagged the job", async () => {
    prisma.jobReport.count.mockResolvedValue(6)
    prisma.job.updateMany.mockResolvedValue({ count: 0 })
    await service.reportJob(seeker, "job-1", { reason: "SCAM" })
    expect(notifications.createNotification).not.toHaveBeenCalled()
  })

  it("honours JOB_REPORT_FLAG_THRESHOLD", async () => {
    process.env.JOB_REPORT_FLAG_THRESHOLD = "2"
    prisma.jobReport.count.mockResolvedValue(2)
    await service.reportJob(seeker, "job-1", { reason: "MISLEADING" })
    expect(prisma.job.updateMany).toHaveBeenCalled()
    delete process.env.JOB_REPORT_FLAG_THRESHOLD
  })

  it("is idempotent per reporter", async () => {
    prisma.jobReport.findUnique.mockResolvedValue({ id: "r1" })
    await expect(service.reportJob(seeker, "job-1", { reason: "SCAM" })).resolves.toEqual({
      reported: true,
    })
    expect(prisma.jobReport.create).not.toHaveBeenCalled()
  })

  it("treats a concurrent duplicate (P2002) as reported", async () => {
    const { Prisma } = jest.requireActual("@prisma/client")
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" })
    )
    await expect(service.reportJob(seeker, "job-1", { reason: "SCAM" })).resolves.toEqual({
      reported: true,
    })
  })

  it("recruiters cannot report their own company's jobs", async () => {
    access.companyScope.mockResolvedValue({ companyIds: ["co-1"], manageCompanyIds: [] })
    await expect(
      service.reportJob({ userId: "rec-2", role: "RECRUITER" }, "job-1", { reason: "SCAM" })
    ).rejects.toMatchObject({ status: 403, errorCode: "CANNOT_REPORT_OWN_JOB" })
    expect(prisma.jobReport.create).not.toHaveBeenCalled()
  })

  it("recruiters of other companies can report", async () => {
    prisma.jobReport.count.mockResolvedValue(1)
    await expect(
      service.reportJob({ userId: "rec-9", role: "RECRUITER" }, "job-1", { reason: "DUPLICATE" })
    ).resolves.toEqual({ reported: true })
  })

  it("admins cannot report and drafts are not reportable", async () => {
    await expect(
      service.reportJob({ userId: "a", role: "ADMIN" }, "job-1", { reason: "SCAM" })
    ).rejects.toThrow(ForbiddenException)
    prisma.job.findUnique.mockResolvedValue({ ...job, status: "DRAFT" })
    await expect(service.reportJob(seeker, "job-1", { reason: "SCAM" })).rejects.toMatchObject({
      status: 404,
    })
  })

  it("an already-flagged job just records the report", async () => {
    prisma.job.findUnique.mockResolvedValue({ ...job, status: "FLAGGED" })
    await service.reportJob(seeker, "job-1", { reason: "SCAM" })
    expect(prisma.jobReport.create).toHaveBeenCalled()
    expect(prisma.job.updateMany).not.toHaveBeenCalled()
  })
})
