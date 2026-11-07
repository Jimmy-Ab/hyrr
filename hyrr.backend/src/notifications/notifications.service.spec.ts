import { NotificationsService } from "./notifications.service"

describe("NotificationsService", () => {
  let prisma: any
  let emailDelivery: any
  let gateway: any
  let service: NotificationsService

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ email: "sam@x.io" }) },
      userSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: {
        create: jest.fn().mockResolvedValue({ id: "n1" }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    emailDelivery = { send: jest.fn().mockResolvedValue(undefined) }
    gateway = { emitNotification: jest.fn() }
    service = new NotificationsService(prisma, emailDelivery, gateway)
  })

  it("inApp: false sends only the e-mail copy (no bell notification, no socket push)", async () => {
    const result = await service.createNotification(
      "u1",
      "New message from Rita",
      "MESSAGE" as any,
      "MESSAGES" as any,
      "app-1",
      { inApp: false }
    )
    expect(result).toBeNull()
    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(gateway.emitNotification).not.toHaveBeenCalled()
    expect(emailDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sam@x.io", subject: "New message from Rita" })
    )
  })

  it("a specific e-mail template replaces the generic copy (and respects the e-mail setting)", async () => {
    const { interviewScheduled } = await import("../core/delivery/templates")
    const email = interviewScheduled({
      name: "Sam",
      jobTitle: "Backend Engineer",
      startTime: "2026-11-20T10:00:00Z",
      meetingUrl: "https://meet.example.com/abc",
    })
    await service.createNotification(
      "u1",
      "Interview",
      "INTERVIEW" as any,
      "CALENDAR" as any,
      null,
      {
        email,
      }
    )
    expect(emailDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sam@x.io", subject: "Interview scheduled: Backend Engineer" })
    )
    expect(emailDelivery.send.mock.calls[0][0].html).toContain("https://meet.example.com/abc")

    emailDelivery.send.mockClear()
    prisma.userSetting.findUnique.mockResolvedValue({ emailNotifications: false })
    await service.createNotification(
      "u1",
      "Interview",
      "INTERVIEW" as any,
      "CALENDAR" as any,
      null,
      {
        email,
      }
    )
    expect(emailDelivery.send).not.toHaveBeenCalled()
  })

  it("regular notifications are still stored and pushed", async () => {
    await service.createNotification("u1", "Status updated", "APPLICATION" as any)
    expect(prisma.notification.create).toHaveBeenCalled()
    expect(gateway.emitNotification).toHaveBeenCalled()
  })

  it("the bell list never includes chat message notifications", async () => {
    await service.getNotifications("u1")
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", type: { not: "MESSAGE" } } })
    )
  })
})
