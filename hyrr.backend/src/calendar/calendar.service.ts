import { Injectable } from "@nestjs/common"
import { EventType, NotificationAction, NotificationType } from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class CalendarService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private access: AccessService
  ) {}

  async getEvents(userId: string, role: string) {
    let where: any

    if (role === "SEEKER") {
      // Fetch the user so we can also match by email on the application
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      where = {
        OR: [
          // Events linked to an application that belongs to this seeker (by userId)
          { application: { userId } },
          // Events linked to an application that belongs to this seeker (by email, for un-linked apps)
          ...(user ? [{ application: { email: user.email } }] : []),
          // Events created directly for this seeker user
          { userId },
        ],
      }
    } else {
      // Recruiters: events for their jobs or events they created
      where = {
        OR: [{ application: { job: { recruiterId: userId } } }, { userId }],
      }
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        application: {
          include: {
            job: { include: { company: true } },
            user: { select: { id: true, name: true, avatar: true, email: true } },
          },
        },
      },
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
    const event = await this.prisma.calendarEvent.create({
      data: {
        userId: data.userId || null,
        applicationId: data.applicationId || null,
        title: data.title,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
        type: Object.values(EventType).includes(data.type?.toUpperCase() as EventType)
          ? (data.type.toUpperCase() as EventType)
          : EventType.INTERVIEW,
        meetingUrl: data.meetingUrl || null,
        location: data.location || null,
        notes: data.notes || "",
      },
      include: {
        application: {
          include: {
            job: { include: { company: true } },
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    })

    // Notify the seeker if this event is linked to their application
    if (event.application?.user?.id) {
      const seekerUserId = event.application.user.id
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
    return this.prisma.calendarEvent.delete({ where: { id } })
  }
}
