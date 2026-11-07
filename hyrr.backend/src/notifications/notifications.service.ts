import { Injectable, Optional } from "@nestjs/common"
import { NotificationAction, NotificationType, UserSetting } from "@prisma/client"
import { EmailService } from "../core/delivery/email.service"
import {
  appUrl,
  type EmailContent,
  notification as notificationEmail,
} from "../core/delivery/templates"
import { MessagesGateway } from "../messages/messages.gateway"
import { PrismaService } from "../prisma/prisma.service"

type PreferenceField = keyof Pick<
  UserSetting,
  | "applicationUpdates"
  | "interviewReminders"
  | "messageNotifications"
  | "offerNotifications"
  | "jobRecommendations"
>

/** Which per-user preference controls each notification type (SYSTEM is always delivered). */
export const NOTIFICATION_PREFERENCE: Record<NotificationType, PreferenceField | null> = {
  [NotificationType.APPLICATION]: "applicationUpdates",
  [NotificationType.INTERVIEW]: "interviewReminders",
  [NotificationType.MESSAGE]: "messageNotifications",
  [NotificationType.OFFER]: "offerNotifications",
  [NotificationType.JOB_ALERT]: "jobRecommendations",
  [NotificationType.SYSTEM]: null,
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    @Optional() private messagesGateway?: MessagesGateway
  ) {}

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      // Chat messages surface on the Messages badge only, never in the notification bell
      // (also hides MESSAGE rows created before this rule existed).
      where: { userId, type: { not: NotificationType.MESSAGE } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }

  /**
   * Creates an in-app notification (+ socket push + e-mail) unless the user's preferences opt out.
   * Returns the notification, or null when the user disabled this notification type.
   */
  async createNotification(
    userId: string,
    title: string,
    type: NotificationType = NotificationType.SYSTEM,
    actionView?: NotificationAction,
    /** Entity the notification points at (e.g. the applicationId of a message thread). */
    targetId?: string | null,
    /**
     * inApp: false → only the e-mail copy (used for chat messages, which have their own badge).
     * email: a specific template to send instead of the generic notification e-mail.
     */
    options: { inApp?: boolean; email?: EmailContent } = {}
  ) {
    const [user, setting] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, role: true },
      }),
      this.prisma.userSetting.findUnique({ where: { userId } }),
    ])
    if (!user) return null

    // Missing settings row → schema defaults (all type preferences on, e-mail on).
    const preference = NOTIFICATION_PREFERENCE[type]
    if (preference && setting && setting[preference] === false) return null

    if (options.inApp === false) {
      if (user.email && setting?.emailNotifications !== false) {
        this.sendEmailCopy(user, title, options.email)
      }
      return null
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        type,
        actionView,
        targetId: targetId ?? null,
      },
    })

    if (this.messagesGateway) {
      try {
        this.messagesGateway.emitNotification(userId, notification)
      } catch {
        // socket optional
      }
    }

    if (user.email && setting?.emailNotifications !== false) {
      this.sendEmailCopy(user, title, options.email)
    }

    return notification
  }

  private sendEmailCopy(
    user: { email: string; name?: string | null; role?: string | null },
    title: string,
    specific?: EmailContent
  ) {
    const content =
      specific ??
      notificationEmail({ name: user.name, title, url: appUrl(user.role, "/notifications") })
    this.email.send({ to: user.email, ...content }).catch(() => undefined)
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    })
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId },
      data: { read: true },
    })
  }

  async clearNotifications(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    })
  }
}
