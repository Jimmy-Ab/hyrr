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
