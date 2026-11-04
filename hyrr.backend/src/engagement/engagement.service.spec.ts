import { ConflictException, ForbiddenException } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { EngagementService } from "./engagement.service"

describe("EngagementService", () => {
  let prisma: any
  let access: any
  let email: any
  let service: EngagementService
  const seeker = { userId: "seeker-1", role: "SEEKER", email: "s@x.io" }
  const future = new Date(Date.now() + 86_400_000)

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    access = { applicationFor: jest.fn(), jobForManagement: jest.fn() }
    email = { send: jest.fn().mockResolvedValue({ delivered: true }) }
    service = new EngagementService(prisma, access, email)
    access.applicationFor.mockResolvedValue({
      id: "app-1",
      jobId: "job-1",
      userId: "seeker-1",
      job: { title: "Engineer", companyId: "co-1" },
    })
    prisma.interviewAvailability.findUnique.mockImplementation(async (args: any) =>
      args.where.id
        ? { id: "slot-1", jobId: "job-1", startTime: future, endTime: future, meetingUrl: "u" }
        : null
    )
  })

  it("books a free slot exactly once", async () => {
    prisma.interviewAvailability.updateMany.mockResolvedValue({ count: 1 })
    const booked = await service.reserveSlot(seeker, "slot-1", "app-1")
    expect(booked.bookedApplicationId).toBe("app-1")
    expect(prisma.interviewAvailability.updateMany).toHaveBeenCalledWith({
      where: { id: "slot-1", bookedApplicationId: null },
      data: { bookedApplicationId: "app-1" },
    })
    expect(prisma.calendarEvent.create).toHaveBeenCalledTimes(1)
  })

  it("rejects a double booking when the conditional update claims nothing", async () => {
    prisma.interviewAvailability.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.reserveSlot(seeker, "slot-1", "app-1")).rejects.toThrow(ConflictException)
    expect(prisma.calendarEvent.create).not.toHaveBeenCalled()
  })

  it("refuses to book for someone else's application", async () => {
    access.applicationFor.mockResolvedValue({
      id: "app-2",
      jobId: "job-1",
      userId: "other",
      job: { title: "Engineer", companyId: "co-1" },
    })
    await expect(service.reserveSlot(seeker, "slot-1", "app-2")).rejects.toThrow(ForbiddenException)
  })

  it("public availability never exposes meeting links", async () => {
    prisma.job.findUnique.mockResolvedValue({ status: "ACTIVE" })
    prisma.interviewAvailability.findMany.mockResolvedValue([
      { id: "slot-1", startTime: future, endTime: future, bookedApplicationId: null },
    ])
    const slots = await service.availableSlots("job-1")
    expect(slots[0]).toEqual({ id: "slot-1", startTime: future, endTime: future, booked: false })
    expect(prisma.interviewAvailability.findMany.mock.calls[0][0].select.meetingUrl).toBeUndefined()
  })

  it("renders the company NAME into templates", async () => {
    prisma.companyMember.findUnique.mockResolvedValue({ role: "RECRUITER" })
    access.applicationFor.mockResolvedValue({
      id: "app-1",
      name: "Ada",
      email: "ada@x.io",
      job: { title: "Engineer", companyId: "co-1" },
    })
    prisma.companyEmailTemplate.findUnique.mockResolvedValue({
      companyId: "co-1",
      subject: "{{companyName}}",
      body: "Hi {{candidateName}}",
    })
    prisma.company.findUnique.mockResolvedValue({ name: "Acme" })
    await service.sendTemplate(
      { userId: "r", role: "RECRUITER", companyId: "co-1" },
      "tpl",
      "app-1"
    )
    expect(email.send).toHaveBeenCalledWith("ada@x.io", "Acme", "Hi Ada")
  })
})
