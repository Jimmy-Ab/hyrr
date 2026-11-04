import { HttpStatus, Injectable } from "@nestjs/common"
import {
  ApplicationStatus,
  EventType,
  NotificationAction,
  NotificationType,
  Prisma,
} from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { AppException } from "../core/exceptions/app-exception"
import { PUBLIC_COMPANY_SELECT } from "../jobs/public-company"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"

/** Application fields a seeker may see on their calendar (no notes / AI data). */
const SEEKER_EVENT_APPLICATION = {
  id: true,
  jobId: true,
  userId: true,
  name: true,
  status: true,
  job: { include: { company: { select: PUBLIC_COMPANY_SELECT } } },
} satisfies Prisma.ApplicationSelect

const RECRUITER_EVENT_APPLICATION = {
  job: { include: { company: true } },
  user: { select: { id: true, name: true, avatar: true, email: true } },
} satisfies Prisma.ApplicationInclude

const parseIso = (value: string, field: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    throw new AppException(
      `${field} must be an ISO-8601 datetime`,
      HttpStatus.BAD_REQUEST,
      "INVALID_DATE"
    )
  return date
}

@Injectable()
export class CalendarService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private access: AccessService
  ) {}

  async getEvents(actor: Actor) {
    const { userId } = actor
    let where: Prisma.CalendarEventWhereInput

    if (actor.role === "SEEKER") {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
      where = {
        OR: [
          { application: { userId } },
          // Applications submitted as a guest with the same e-mail and not linked yet
          ...(user?.email ? [{ application: { userId: null, email: user.email } }] : []),
          { userId },
        ],
      }
      return this.prisma.calendarEvent.findMany({
        where,
        include: { application: { select: SEEKER_EVENT_APPLICATION } },
        orderBy: { startTime: "asc" },
      })
    }

    // Recruiters: events on their company's applications, plus events they created themselves
    const jobScope = await this.access.jobScopeWhere(actor)
    where = {
      OR: [
        { application: { job: jobScope, status: { not: ApplicationStatus.SAVED } } },
        { userId },
      ],
    }
    return this.prisma.calendarEvent.findMany({
      where,
      include: { application: { include: RECRUITER_EVENT_APPLICATION } },
      orderBy: { startTime: "asc" },
    })
  }

  async createEvent(
    data: {
      userId?: string
      applicationId?: string
      title: string
      startTime: string
      endTime?: string
      type: string
      meetingUrl?: string
      location?: string
      notes?: string
    },
    actor: Actor
  ) {
    if (data.applicationId) await this.access.applicationFor(actor, data.applicationId, "manage")
    const startTime = parseIso(data.startTime, "startTime")
    const endTime = data.endTime ? parseIso(data.endTime, "endTime") : null
    if (endTime && endTime < startTime)
      throw new AppException(
        "endTime must be after startTime",
        HttpStatus.BAD_REQUEST,
        "INVALID_DATE"
      )
    const event = await this.prisma.calendarEvent.create({
      data: {
        // The creator owns the event (used for delete permission)
        userId: actor.userId,
        applicationId: data.applicationId || null,
        title: data.title,
        startTime,
        endTime,
        type: Object.values(EventType).includes(data.type?.toUpperCase() as EventType)
          ? (data.type.toUpperCase() as EventType)
          : EventType.INTERVIEW,
        meetingUrl: data.meetingUrl || null,
        location: data.location || null,
        notes: data.notes || "",
      },
      include:
        actor.role === "SEEKER"
          ? {
              application: {
                select: { ...SEEKER_EVENT_APPLICATION, user: { select: { id: true } } },
              },
            }
          : { application: { include: RECRUITER_EVENT_APPLICATION } },
    })

    // Notify the seeker if this event is linked to their application
    const seekerUserId = (event as any).application?.user?.id
    if (seekerUserId && seekerUserId !== actor.userId) {
      const dateStr = new Date(event.startTime).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      await this.notificationsService.createNotification(
        seekerUserId,
        `📅 Interview scheduled: "${event.title}" on ${dateStr}`,
        NotificationType.INTERVIEW,
        NotificationAction.CALENDAR
      )
    }

    return event
  }

  async deleteEvent(id: string, actor: Actor) {
    await this.access.calendarEventFor(actor, id)
    await this.prisma.calendarEvent.delete({ where: { id } })
    return { id, deleted: true }
  }
}
