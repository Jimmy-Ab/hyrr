import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AccessService } from "../core/access/access.service"
import { EmailDeliveryService } from "../core/delivery/email-delivery.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { MessagesGateway } from "./messages.gateway"
import { MessagesService } from "./messages.service"

const sqlText = (q: any): string => (q?.strings ? q.strings.join("?") : String(q?.sql ?? q))

describe("MessagesService", () => {
  let service: MessagesService
  let prismaMock: any
  let gateway: any
  let access: any
  let notifications: any
  let email: any

  const seeker = { userId: "seeker-1", role: "SEEKER", email: "sam@example.com" }
  const rec1 = { userId: "rec-1", role: "RECRUITER" }
  const rec2 = { userId: "rec-2", role: "RECRUITER" }

  const baseApp = (overrides: Record<string, any> = {}) => ({
    id: "app-1",
    userId: "seeker-1",
    email: "sam@example.com",
    name: "Sam Seeker",
    title: "Engineer",
    status: "APPLIED",
    job: {
      id: "job-1",
      title: "Engineer",
      companyId: "co-1",
      recruiterId: "rec-1",
      company: { id: "co-1", name: "Acme", logo: null, color: null },
      postedBy: { id: "rec-1", name: "Rita", avatar: "rita.png" },
    },
    user: { id: "seeker-1", name: "Sam Seeker", avatar: "sam.png" },
    ...overrides,
  })

  /** Routes $queryRaw calls: DISTINCT ON → last visible messages, COUNT → unread counts. */
  const mockRaw = (last: any[], unread: any[]) =>
    prismaMock.$queryRaw.mockImplementation(async (q: any) =>
      sqlText(q).includes("DISTINCT ON") ? last : unread
    )

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    prismaMock.$queryRaw.mockResolvedValue([])
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.conversationState.upsert.mockResolvedValue({})
    gateway = {
      emitNewMessage: jest.fn(),
      emitUnreadUpdate: jest.fn(),
      emitToRooms: jest.fn(),
      isUserInRoom: jest.fn().mockResolvedValue(false),
    }
    access = {
      applicationFor: jest.fn().mockResolvedValue(baseApp()),
      jobScopeWhere: jest.fn().mockResolvedValue({ OR: [{ companyId: { in: ["co-1"] } }] }),
      isApplicationOwner: jest.fn(
        (actor: any, app: any) =>
          actor.role === "SEEKER" &&
          (app.userId === actor.userId || (!app.userId && app.email === actor.email))
      ),
    }
    notifications = { createNotification: jest.fn().mockResolvedValue({ id: "n1" }) }
    email = { send: jest.fn().mockResolvedValue({ delivered: false }) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AccessService, useValue: access },
        { provide: MessagesGateway, useValue: gateway },
        { provide: NotificationsService, useValue: notifications },
        { provide: EmailDeliveryService, useValue: email },
      ],
    }).compile()

    service = module.get<MessagesService>(MessagesService)
  })

  describe("conversations", () => {
    it("lists only threads with a visible message, newest first, and excludes SAVED (seeker)", async () => {
      prismaMock.application.findMany
        .mockResolvedValueOnce([{ id: "app-1" }, { id: "app-2" }, { id: "app-3" }])
        .mockResolvedValueOnce([baseApp(), baseApp({ id: "app-2" })])
      // app-3 was cleared by the viewer: no visible message → not returned by the SQL.
      mockRaw(
        [
          { id: "m1", applicationId: "app-1", createdAt: new Date("2026-01-01") },
          { id: "m2", applicationId: "app-2", createdAt: new Date("2026-02-01") },
        ],
        [{ applicationId: "app-1", count: 2 }]
      )
      prismaMock.message.findMany.mockResolvedValue([
        {
          id: "m1",
          applicationId: "app-1",
          text: "old",
          senderType: "RECRUITER",
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "m2",
          applicationId: "app-2",
          text: "new",
          senderType: "RECRUITER",
          createdAt: new Date("2026-02-01"),
        },
      ])

      const result: any[] = await service.getConversations(seeker)

      const scopeArgs = prismaMock.application.findMany.mock.calls[0][0]
      expect(scopeArgs.where.AND[0].status).toEqual({ not: "SAVED" })
      expect(scopeArgs.where.AND[0].OR).toEqual([
        { userId: "seeker-1" },
        { userId: null, email: "sam@example.com" },
      ])
      expect(scopeArgs.where.AND[1]).toEqual({ messages: { some: {} } })
      expect(result.map((c) => c.applicationId)).toEqual(["app-2", "app-1"])
      expect(result[1]).toMatchObject({
        candidateName: "Rita",
        unreadCount: 2,
        canSend: true,
        isGuest: false,
        company: { id: "co-1", name: "Acme" },
      })
      expect(result[0].lastMessage).toMatchObject({ id: "m2", text: "new", clientId: null })
    })

    it("returns nothing (and runs no detail queries) when no thread has messages", async () => {
      prismaMock.application.findMany.mockResolvedValueOnce([])
      const result = await service.getConversations(rec1)
      expect(result).toEqual([])
      expect(prismaMock.application.findMany).toHaveBeenCalledTimes(1)
      expect(prismaMock.application.findMany.mock.calls[0][0].where.AND[0]).toMatchObject({
        status: { not: "SAVED" },
        job: { OR: [{ companyId: { in: ["co-1"] } }] },
      })
    })
  })

  describe("per-user read state", () => {
    it("unread SQL is scoped to the viewer's own ConversationState and other-side senders", async () => {
      prismaMock.application.findMany.mockResolvedValue([{ id: "app-1" }])
      prismaMock.$queryRaw.mockResolvedValue([{ applicationId: "app-1", count: 3 }])

      expect(await service.getUnreadCount(rec1)).toEqual({ count: 3 })
      const q1 = prismaMock.$queryRaw.mock.calls[0][0]
      expect(sqlText(q1)).toContain(`"lastReadAt"`)
      expect(sqlText(q1)).toContain(`"clearedAt"`)
      expect(q1.values).toContain("rec-1")
      expect(q1.values).toContainEqual(["SEEKER"])

      await service.getUnreadCount(seeker)
      const q2 = prismaMock.$queryRaw.mock.calls[1][0]
      expect(q2.values).toContain("seeker-1")
      expect(q2.values).toContainEqual(["RECRUITER", "ADMIN"])
    })

    it("marking read only moves the reader's state (teammates stay independent) and emits messages_read", async () => {
      prismaMock.message.findFirst.mockResolvedValue({ createdAt: new Date("2020-01-01") })
      prismaMock.application.findMany.mockResolvedValue([])

      const result = await service.markThreadRead("app-1", rec1)

      expect(result).toEqual({ unreadCount: 0 })
      expect(prismaMock.conversationState.upsert).toHaveBeenCalledTimes(1)
      const upsert = prismaMock.conversationState.upsert.mock.calls[0][0]
      expect(upsert.where).toEqual({
        applicationId_userId: { applicationId: "app-1", userId: "rec-1" },
      })
      expect(upsert.update.lastReadAt).toBeInstanceOf(Date)
      expect(JSON.stringify(prismaMock.conversationState.upsert.mock.calls)).not.toContain(
        rec2.userId
      )
      expect(prismaMock.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            applicationId: "app-1",
            senderType: { in: ["SEEKER"] },
          }),
          data: { read: true },
        })
      )
      expect(gateway.emitUnreadUpdate).toHaveBeenCalledWith("rec-1", { applicationId: "app-1" })
      expect(gateway.emitToRooms).toHaveBeenCalledWith(
        ["chat_app-1", "user_seeker-1"],
        "messages_read",
        expect.objectContaining({ applicationId: "app-1", readerSide: "RECRUITER" })
      )
    })

    it("delete-for-me sets only the caller's clearedAt", async () => {
      prismaMock.message.findFirst.mockResolvedValue(null)
      const result = await service.clearConversation("app-1", rec2)
      expect(result).toEqual({ applicationId: "app-1", cleared: true })
      const upsert = prismaMock.conversationState.upsert.mock.calls[0][0]
      expect(upsert.where.applicationId_userId.userId).toBe("rec-2")
      expect(upsert.update).toEqual({ clearedAt: expect.any(Date) })
      expect(prismaMock.message.updateMany).not.toHaveBeenCalled()
    })

    it("history hides messages before my clearedAt and has no side effects", async () => {
      const clearedAt = new Date("2026-03-01")
      prismaMock.conversationState.findUnique.mockResolvedValue({ clearedAt })
      prismaMock.message.findMany.mockResolvedValue([])

      await service.getMessages("app-1", seeker)

      expect(prismaMock.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { applicationId: "app-1", createdAt: { gt: clearedAt } },
          orderBy: { createdAt: "asc" },
        })
      )
      expect(prismaMock.message.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.conversationState.upsert).not.toHaveBeenCalled()
      expect(gateway.emitUnreadUpdate).not.toHaveBeenCalled()
    })
  })

  describe("sending", () => {
    beforeEach(() => {
      prismaMock.application.findUnique.mockResolvedValue(baseApp())
      prismaMock.message.create.mockImplementation(async ({ data }: any) => ({
        id: "m-new",
        createdAt: new Date("2026-05-01"),
        read: false,
        sender: { id: data.senderId, name: "X", avatar: "x.png", role: data.senderType },
        ...data,
      }))
    })

    it("a seeker can start a thread; delivered once to chat, seeker, company and poster rooms", async () => {
      const msg = await service.createMessage("app-1", seeker, "Hello", {
        clientId: "c-1",
        excludeSocketId: "sock-1",
      })

      expect(msg).toMatchObject({
        id: "m-new",
        text: "Hello",
        clientId: "c-1",
        senderType: "SEEKER",
      })
      expect(msg.sender).toMatchObject({ id: "seeker-1", role: "SEEKER" })
      expect(prismaMock.message.create.mock.calls[0][0].data).toMatchObject({
        receiverId: "rec-1",
        senderType: "SEEKER",
        clientId: "c-1",
      })
      expect(gateway.emitNewMessage).toHaveBeenCalledTimes(1)
      expect(gateway.emitNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: "m-new" }),
        ["chat_app-1", "user_seeker-1", "company_co-1", "user_rec-1"],
        "sock-1"
      )
      expect(gateway.emitToRooms).toHaveBeenCalledWith(
        ["company_co-1", "user_rec-1", "user_seeker-1"],
        "unread_update",
        { applicationId: "app-1" }
      )
      // Sender's own read position moves to their message.
      expect(prismaMock.conversationState.upsert.mock.calls[0][0].update).toEqual({
        lastReadAt: new Date("2026-05-01"),
      })
      expect(notifications.createNotification).toHaveBeenCalledWith(
        "rec-1",
        expect.stringContaining("Sam Seeker"),
        "MESSAGE",
        "MESSAGES",
        "app-1",
        // Messages only light up the Messages badge: e-mail copy, no bell notification.
        { inApp: false }
      )
    })

    it("returns the stored message for a repeated clientId without creating a duplicate", async () => {
      prismaMock.message.findUnique.mockResolvedValue({
        id: "m-old",
        applicationId: "app-1",
        senderId: "seeker-1",
        text: "Hello",
        clientId: "c-1",
      })
      const msg = await service.createMessage("app-1", seeker, "Hello", { clientId: "c-1" })
      expect(msg.id).toBe("m-old")
      expect(prismaMock.message.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { senderId_clientId: { senderId: "seeker-1", clientId: "c-1" } },
        })
      )
      expect(prismaMock.message.create).not.toHaveBeenCalled()
      expect(gateway.emitNewMessage).not.toHaveBeenCalled()
    })

    it("handles the clientId race (P2002) by returning the winner", async () => {
      prismaMock.message.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: "m-winner",
        applicationId: "app-1",
        text: "Hello",
        clientId: "c-1",
      })
      prismaMock.message.create.mockRejectedValue(
        Object.assign(new Error("dup"), { code: "P2002" })
      )

      const msg = await service.createMessage("app-1", seeker, "Hello", { clientId: "c-1" })
      expect(msg.id).toBe("m-winner")
      expect(gateway.emitNewMessage).not.toHaveBeenCalled()
    })

    it("a withdrawn application is read-only for everyone (409 CONVERSATION_CLOSED)", async () => {
      access.applicationFor.mockResolvedValue(baseApp({ status: "WITHDRAWN" }))
      for (const actor of [seeker, rec1]) {
        await expect(service.createMessage("app-1", actor, "Hi")).rejects.toMatchObject({
          errorCode: "CONVERSATION_CLOSED",
          status: 409,
        })
      }
      expect(prismaMock.message.create).not.toHaveBeenCalled()
    })

    it("a seeker cannot message on a SAVED job", async () => {
      access.applicationFor.mockResolvedValue(baseApp({ status: "SAVED" }))
      await expect(service.createMessage("app-1", seeker, "Hi")).rejects.toMatchObject({
        errorCode: "CONVERSATION_CLOSED",
      })
      expect(prismaMock.message.create).not.toHaveBeenCalled()
    })

    it("skips the notification when the receiver is viewing the thread", async () => {
      gateway.isUserInRoom.mockResolvedValue(true)
      await service.createMessage("app-1", rec1, "Hi there")
      expect(gateway.isUserInRoom).toHaveBeenCalledWith("seeker-1", "chat_app-1")
      expect(notifications.createNotification).not.toHaveBeenCalled()
      expect(gateway.emitToRooms).toHaveBeenCalledWith(
        ["user_seeker-1", "user_rec-1"],
        "unread_update",
        { applicationId: "app-1" }
      )
    })

    it("e-mails guest applicants (no account) and never fails when e-mail is unavailable", async () => {
      const guest = baseApp({ userId: null, user: null, email: "guest@example.com" })
      access.applicationFor.mockResolvedValue(guest)
      prismaMock.application.findUnique.mockResolvedValue(guest)
      prismaMock.user.findUnique.mockResolvedValue(null)
      email.send.mockRejectedValue(new Error("not configured"))

      const msg = await service.createMessage("app-1", rec1, "Interview on Monday?")

      expect(msg.id).toBe("m-new")
      expect(email.send).toHaveBeenCalledWith(
        "guest@example.com",
        expect.stringContaining("Acme"),
        expect.stringContaining("Interview on Monday?")
      )
      expect(notifications.createNotification).not.toHaveBeenCalled()
      expect(gateway.emitNewMessage).toHaveBeenCalledWith(
        expect.anything(),
        ["chat_app-1", "company_co-1", "user_rec-1"],
        undefined
      )
    })
  })
})
