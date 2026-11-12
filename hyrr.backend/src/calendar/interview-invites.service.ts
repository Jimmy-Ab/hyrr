import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import { ApplicationStatus, NotificationAction, NotificationType, Prisma } from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { buildIcs, icsAttachment } from "../core/delivery/ics"
import { interviewScheduled } from "../core/delivery/templates"
import { AppException } from "../core/exceptions/app-exception"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"

const MIN_LEAD_MS = 15 * 60_000
const MAX_AHEAD_MS = 90 * 86_400_000

const fail = (message: string, status: HttpStatus, code: string) =>
  new AppException(message, status, code)

/** Seeker-safe invite shape (no recruiter notes, no AI data). */
const INVITE_INCLUDE = {
  slots: { orderBy: { startTime: "asc" } },
  application: {
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
      job: {
        select: { id: true, title: true, companyId: true, company: { select: { name: true } } },
      },
    },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.InterviewInviteInclude

type InviteRow = Prisma.InterviewInviteGetPayload<{ include: typeof INVITE_INCLUDE }>

export function presentInvite(invite: InviteRow, now = Date.now()) {
  const future = invite.slots.filter((s) => s.startTime.getTime() > now)
  return {
    id: invite.id,
    applicationId: invite.applicationId,
    title: invite.title,
    durationMin: invite.durationMin,
    location: invite.location,
    meetingUrl: invite.meetingUrl,
    note: invite.note,
    // OPEN invites whose times have all passed read as EXPIRED (no cron needed).
    status: invite.status === "OPEN" && future.length === 0 ? "EXPIRED" : invite.status,
    eventId: invite.eventId,
    createdAt: invite.createdAt,
    jobTitle: invite.application.job.title,
    companyName: invite.application.job.company?.name ?? null,
    candidateName: invite.application.name,
    organizerName: invite.createdBy?.name ?? null,
    slots: (invite.status === "OPEN" ? future : invite.slots).map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      booked: !!s.bookedAt,
    })),
  }
}

/** Native interview scheduling: the recruiter offers times, the candidate books one. */
@Injectable()
export class InterviewInvitesService {
  private readonly logger = new Logger(InterviewInvitesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly gateway?: MessagesGateway
  ) {}

  async create(
    actor: Actor,
    data: {
      applicationId: string
      title: string
      durationMin: number
      slots: { startTime: string }[]
      location?: string
      meetingUrl?: string
      note?: string
    }
  ) {
    const application = await this.access.applicationFor(actor, data.applicationId, "manage")
    if (!application.userId)
      throw fail(
        "This candidate has no Hyrr account, so they can't pick a time. Schedule the interview directly instead.",
        HttpStatus.BAD_REQUEST,
        "CANDIDATE_HAS_NO_ACCOUNT"
      )
    if (
      application.status === ApplicationStatus.WITHDRAWN ||
      application.status === ApplicationStatus.ARCHIVED
    )
      throw fail(
        "This application is closed, so interview times can't be offered.",
        HttpStatus.CONFLICT,
        "APPLICATION_CLOSED"
      )

    const now = Date.now()
    const durationMs = data.durationMin * 60_000
    const starts = [...new Set(data.slots.map((s) => new Date(s.startTime).getTime()))].sort(
      (a, b) => a - b
    )
    for (const start of starts) {
      if (Number.isNaN(start)) throw fail("Invalid time", HttpStatus.BAD_REQUEST, "INVALID_DATE")
      if (start < now + MIN_LEAD_MS)
        throw fail(
          "Every time must be at least 15 minutes from now.",
          HttpStatus.BAD_REQUEST,
          "SLOT_IN_PAST"
        )
      if (start > now + MAX_AHEAD_MS)
        throw fail("Times can be at most 90 days ahead.", HttpStatus.BAD_REQUEST, "SLOT_TOO_FAR")
    }
    for (let i = 1; i < starts.length; i++)
      if (starts[i] - starts[i - 1] < durationMs)
        throw fail(
          "Two of the times overlap. Leave at least the interview length between them.",
          HttpStatus.BAD_REQUEST,
          "SLOTS_OVERLAP"
        )

    const invite = await this.prisma.$transaction(async (tx) => {
      // One open invite per application: a new offer replaces the previous one.
      await tx.interviewInvite.updateMany({
        where: { applicationId: application.id, status: "OPEN" },
        data: { status: "CANCELED" },
      })
      return tx.interviewInvite.create({
        data: {
          applicationId: application.id,
          createdById: actor.userId,
          title: data.title,
          durationMin: data.durationMin,
          location: data.location || null,
          meetingUrl: data.meetingUrl || null,
          note: data.note || null,
          slots: {
            create: starts.map((start) => ({
              startTime: new Date(start),
              endTime: new Date(start + durationMs),
            })),
          },
        },
        include: INVITE_INCLUDE,
      })
    })

    const payload = presentInvite(invite)
    await this.notifications
      .createNotification(
        application.userId,
        `📅 ${payload.companyName ?? "The hiring team"} invited you to pick an interview time for ${payload.jobTitle}`,
        NotificationType.INTERVIEW,
        NotificationAction.CALENDAR,
        invite.id
      )
      .catch((err) => this.logger.warn(`Invite notification failed: ${err?.message}`))
    this.gateway?.emitToUsers([application.userId], "interview_invite_received", payload)
    this.gateway?.emitToCompany(
      invite.application.job.companyId,
      "interview_invite_updated",
      payload
    )
    return payload
  }

  /** Seeker: their invites. Recruiter: the invites of one application. */
  async list(actor: Actor, applicationId?: string) {
    if (actor.role === "SEEKER") {
      const rows = await this.prisma.interviewInvite.findMany({
        where: { application: { userId: actor.userId }, status: { in: ["OPEN", "BOOKED"] } },
        include: INVITE_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 50,
      })
      return rows.map((r) => presentInvite(r))
    }
    if (!applicationId)
      throw fail("applicationId is required", HttpStatus.BAD_REQUEST, "APPLICATION_REQUIRED")
    await this.access.applicationFor(actor, applicationId, "view")
    const rows = await this.prisma.interviewInvite.findMany({
      where: { applicationId },
      include: INVITE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    return rows.map((r) => presentInvite(r))
  }

  /** Candidate books one time. Only one booking can win (conditional OPEN → BOOKED). */
  async book(actor: Actor, inviteId: string, slotId: string) {
    const invite = await this.prisma.interviewInvite.findUnique({
      where: { id: inviteId },
      include: INVITE_INCLUDE,
    })
    if (!invite || invite.application.userId !== actor.userId)
      throw fail("Interview invite not found", HttpStatus.NOT_FOUND, "INVITE_NOT_FOUND")
    const slot = invite.slots.find((s) => s.id === slotId)
    if (!slot)
      throw fail("That time isn't part of this invite", HttpStatus.NOT_FOUND, "SLOT_NOT_FOUND")
    if (invite.status !== "OPEN")
      throw fail(
        "This invite is no longer open. Check your calendar or ask the recruiter for new times.",
        HttpStatus.CONFLICT,
        "INVITE_CLOSED"
      )
    if (slot.startTime.getTime() <= Date.now())
      throw fail(
        "That time has already passed. Pick another one.",
        HttpStatus.CONFLICT,
        "SLOT_PASSED"
      )

    const event = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.interviewInvite.updateMany({
        where: { id: invite.id, status: "OPEN" },
        data: { status: "BOOKED" },
      })
      if (claimed.count !== 1)
        throw fail("Someone just booked or closed this invite.", HttpStatus.CONFLICT, "SLOT_TAKEN")
      await tx.interviewSlot.update({ where: { id: slot.id }, data: { bookedAt: new Date() } })
      const created = await tx.calendarEvent.create({
        data: {
          // The recruiter who offered the times owns the event (delete permission).
          userId: invite.createdById,
          applicationId: invite.applicationId,
          title: invite.title,
          startTime: slot.startTime,
          endTime: slot.endTime,
          type: "INTERVIEW",
          meetingUrl: invite.meetingUrl,
          location: invite.location,
          notes: invite.note ?? "",
        },
      })
      await tx.interviewInvite.update({ where: { id: invite.id }, data: { eventId: created.id } })
      // Booking an interview moves early-stage applications to Interviewing.
      const app = invite.application
      if (app.status === ApplicationStatus.APPLIED || app.status === ApplicationStatus.IN_PROCESS) {
        await tx.application.update({
          where: { id: app.id },
          data: { status: ApplicationStatus.INTERVIEWING, tag: "Interview Stage" },
        })
        await tx.applicationStageEvent.create({
          data: {
            applicationId: app.id,
            fromStatus: app.status,
            toStatus: ApplicationStatus.INTERVIEWING,
            actorId: actor.userId,
          },
        })
      }
      return created
    })

    const booked = await this.prisma.interviewInvite.findUniqueOrThrow({
      where: { id: invite.id },
      include: INVITE_INCLUDE,
    })
    const payload = presentInvite(booked)
    await this.afterBooking(booked, event, actor.userId)
    return { invite: payload, event }
  }

  private async afterBooking(
    invite: InviteRow,
    event: { id: string; startTime: Date; endTime: Date | null },
    seekerId: string
  ) {
    const job = invite.application.job
    const ics = buildIcs({
      uid: event.id,
      start: event.startTime,
      end: event.endTime ?? new Date(event.startTime.getTime() + invite.durationMin * 60_000),
      title: `${invite.title} · ${job.title}`,
      description: invite.note,
      location: invite.location || invite.meetingUrl,
      url: invite.meetingUrl,
    })
    const mail = (name?: string | null) => ({
      ...interviewScheduled({
        name,
        jobTitle: job.title,
        startTime: event.startTime,
        meetingUrl: invite.meetingUrl,
        location: invite.location,
      }),
      attachments: [icsAttachment(ics)],
    })
    const when = event.startTime.toUTCString()
    try {
      await this.notifications.createNotification(
        seekerId,
        `✅ Interview booked: ${invite.title} for ${job.title}, ${when}`,
        NotificationType.INTERVIEW,
        NotificationAction.CALENDAR,
        event.id,
        { email: mail(invite.application.name) }
      )
      if (invite.createdById)
        await this.notifications.createNotification(
          invite.createdById,
          `✅ ${invite.application.name} booked ${invite.title} (${job.title}) for ${when}`,
          NotificationType.INTERVIEW,
          NotificationAction.CALENDAR,
          event.id,
          { email: mail(invite.createdBy?.name) }
        )
    } catch (err: any) {
      this.logger.warn(`Booking notifications failed for ${invite.id}: ${err?.message}`)
    }
    const payload = { invite: presentInvite(invite), event }
    this.gateway?.emitToUsers([seekerId], "calendar_event_confirmed", payload)
    this.gateway?.emitToCompany(job.companyId, "calendar_event_confirmed", payload)
    if (invite.application.status !== "INTERVIEWING")
      this.gateway?.emitApplicationUpdate(
        seekerId,
        {
          applicationId: invite.applicationId,
          status: "INTERVIEWING",
          tag: "Interview Stage",
          actorId: seekerId,
        },
        job.companyId
      )
  }

  async cancel(actor: Actor, inviteId: string) {
    const invite = await this.prisma.interviewInvite.findUnique({
      where: { id: inviteId },
      include: INVITE_INCLUDE,
    })
    if (!invite) throw fail("Interview invite not found", HttpStatus.NOT_FOUND, "INVITE_NOT_FOUND")
    await this.access.applicationFor(actor, invite.applicationId, "manage")
    const { count } = await this.prisma.interviewInvite.updateMany({
      where: { id: inviteId, status: "OPEN" },
      data: { status: "CANCELED" },
    })
    if (count !== 1)
      throw fail(
        "Only open invites can be withdrawn. To change a booked interview, edit the calendar event.",
        HttpStatus.CONFLICT,
        "INVITE_CLOSED"
      )
    const payload = presentInvite({ ...invite, status: "CANCELED" })
    if (invite.application.userId) {
      await this.notifications
        .createNotification(
          invite.application.userId,
          `The interview times for ${invite.application.job.title} were withdrawn.`,
          NotificationType.INTERVIEW,
          NotificationAction.CALENDAR,
          invite.id
        )
        .catch(() => undefined)
      this.gateway?.emitToUsers([invite.application.userId], "interview_invite_updated", payload)
    }
    this.gateway?.emitToCompany(
      invite.application.job.companyId,
      "interview_invite_updated",
      payload
    )
    return payload
  }
}
