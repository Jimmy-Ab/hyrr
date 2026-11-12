import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { buildIcs } from "../core/delivery/ics"
import { InterviewInvitesService, presentInvite } from "./interview-invites.service"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000)

describe("InterviewInvitesService", () => {
  let prisma: any
  let access: { applicationFor: jest.Mock }
  let notifications: { createNotification: jest.Mock }
  let gateway: {
    emitToUsers: jest.Mock
    emitToCompany: jest.Mock
    emitApplicationUpdate: jest.Mock
  }
  let service: InterviewInvitesService
  const recruiter = { userId: "rec-1", role: "RECRUITER", companyId: "co-1" } as any
  const seeker = { userId: "seek-1", role: "SEEKER" } as any

  const invite = (over: Record<string, any> = {}) => ({
    id: "inv-1",
    applicationId: "app-1",
    createdById: "rec-1",
    title: "Technical interview",
    durationMin: 45,
    location: null,
    meetingUrl: "https://meet.example/abc",
    note: "Bring a laptop",
    status: "OPEN",
    eventId: null,
    createdAt: new Date(),
    slots: [
      {
        id: "s1",
        inviteId: "inv-1",
        startTime: inHours(24),
        endTime: inHours(24.75),
        bookedAt: null,
      },
      {
        id: "s2",
        inviteId: "inv-1",
        startTime: inHours(48),
        endTime: inHours(48.75),
        bookedAt: null,
      },
    ],
    application: {
      id: "app-1",
      userId: "seek-1",
      name: "Sam",
      status: "IN_PROCESS",
      job: { id: "job-1", title: "Data Engineer", companyId: "co-1", company: { name: "Acme" } },
    },
    createdBy: { id: "rec-1", name: "Rita" },
    ...over,
  })

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    access = {
      applicationFor: jest
        .fn()
        .mockResolvedValue({ id: "app-1", userId: "seek-1", status: "IN_PROCESS" }),
    }
    notifications = { createNotification: jest.fn().mockResolvedValue(undefined) }
    gateway = { emitToUsers: jest.fn(), emitToCompany: jest.fn(), emitApplicationUpdate: jest.fn() }
    service = new InterviewInvitesService(
      prisma,
      access as any,
      notifications as any,
      gateway as any
    )
  })

  const create = (slots: Date[], over: Record<string, any> = {}) =>
    service.create(recruiter, {
      applicationId: "app-1",
      title: "Technical interview",
      durationMin: 45,
      slots: slots.map((d) => ({ startTime: d.toISOString() })),
      ...over,
    })

  describe("create", () => {
    it("refuses candidates without an account, past times and overlapping times", async () => {
      access.applicationFor.mockResolvedValueOnce({ id: "app-1", userId: null, status: "APPLIED" })
      expect(await code(create([inHours(5)]))).toBe("CANDIDATE_HAS_NO_ACCOUNT")
      expect(await code(create([new Date(Date.now() + 60_000)]))).toBe("SLOT_IN_PAST")
      expect(await code(create([inHours(5), inHours(5.5)]))).toBe("SLOTS_OVERLAP")
      expect(await code(create([inHours(24 * 100)]))).toBe("SLOT_TOO_FAR")
      expect(prisma.interviewInvite.create).not.toHaveBeenCalled()
    })

    it("replaces the open invite, notifies the seeker and the team live", async () => {
      prisma.interviewInvite.create.mockResolvedValue(invite())
      const result = await create([inHours(48), inHours(24)])
      expect(prisma.interviewInvite.updateMany).toHaveBeenCalledWith({
        where: { applicationId: "app-1", status: "OPEN" },
        data: { status: "CANCELED" },
      })
      const slots = prisma.interviewInvite.create.mock.calls[0][0].data.slots.create
      expect(slots.map((s: any) => s.endTime.getTime() - s.startTime.getTime())).toEqual([
        45 * 60_000,
        45 * 60_000,
      ])
      expect(slots[0].startTime < slots[1].startTime).toBe(true)
      expect(gateway.emitToUsers).toHaveBeenCalledWith(
        ["seek-1"],
        "interview_invite_received",
        result
      )
      expect(notifications.createNotification).toHaveBeenCalled()
    })
  })

  describe("book", () => {
    it("only the candidate of the application can book", async () => {
      prisma.interviewInvite.findUnique.mockResolvedValue(invite())
      expect(
        await code(service.book({ userId: "other", role: "SEEKER" } as any, "inv-1", "s1"))
      ).toBe("INVITE_NOT_FOUND")
    })

    it("a second booking loses with 409 SLOT_TAKEN and writes nothing else", async () => {
      prisma.interviewInvite.findUnique.mockResolvedValue(invite())
      prisma.interviewInvite.updateMany.mockResolvedValue({ count: 0 })
      expect(await code(service.book(seeker, "inv-1", "s1"))).toBe("SLOT_TAKEN")
      expect(prisma.calendarEvent.create).not.toHaveBeenCalled()
    })

    it("closed invites and past times are refused", async () => {
      prisma.interviewInvite.findUnique.mockResolvedValue(invite({ status: "CANCELED" }))
      expect(await code(service.book(seeker, "inv-1", "s1"))).toBe("INVITE_CLOSED")
      const past = invite()
      past.slots[0].startTime = new Date(Date.now() - 1000)
      prisma.interviewInvite.findUnique.mockResolvedValue(past)
      expect(await code(service.book(seeker, "inv-1", "s1"))).toBe("SLOT_PASSED")
    })

    it("creates the calendar event, moves to Interviewing and e-mails an .ics to both", async () => {
      prisma.interviewInvite.findUnique.mockResolvedValue(invite())
      prisma.interviewInvite.updateMany.mockResolvedValue({ count: 1 })
      const event = { id: "ev-1", startTime: inHours(24), endTime: inHours(24.75) }
      prisma.calendarEvent.create.mockResolvedValue(event)
      prisma.interviewInvite.findUniqueOrThrow.mockResolvedValue(
        invite({ status: "BOOKED", eventId: "ev-1" })
      )
      const result = await service.book(seeker, "inv-1", "s1")
      expect(prisma.calendarEvent.create.mock.calls[0][0].data).toMatchObject({
        userId: "rec-1",
        applicationId: "app-1",
        type: "INTERVIEW",
      })
      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "INTERVIEWING" }) })
      )
      const mails = notifications.createNotification.mock.calls.map((c: any[]) => c[5]?.email)
      expect(mails).toHaveLength(2)
      for (const mail of mails) expect(mail.attachments[0].content).toContain("BEGIN:VEVENT")
      expect(gateway.emitToCompany).toHaveBeenCalledWith(
        "co-1",
        "calendar_event_confirmed",
        expect.objectContaining({ event })
      )
      expect(result.invite.status).toBe("BOOKED")
    })
  })

  it("seeker payloads never contain recruiter-only data", () => {
    const shown = presentInvite(invite() as any)
    expect(Object.keys(shown).some((k) => /^ai|recruiterNotes/i.test(k))).toBe(false)
    expect(shown.slots).toHaveLength(2)
  })

  it("an open invite whose times have all passed reads as EXPIRED", () => {
    const old = invite()
    old.slots.forEach((s) => (s.startTime = new Date(Date.now() - 3_600_000)))
    expect(presentInvite(old as any).status).toBe("EXPIRED")
  })

  it("builds a valid .ics with escaped text", () => {
    const ics = buildIcs({
      uid: "ev-1",
      start: new Date("2026-12-01T10:00:00Z"),
      end: new Date("2026-12-01T10:45:00Z"),
      title: "Interview, round 1; Acme",
    })
    expect(ics).toContain("DTSTART:20261201T100000Z")
    expect(ics).toContain("SUMMARY:Interview\\, round 1\\; Acme")
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true)
  })
})
