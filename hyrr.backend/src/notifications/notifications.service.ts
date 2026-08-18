import { Injectable, Optional } from "@nestjs/common"
import { NotificationAction, NotificationType } from "@prisma/client"
import { EmailDeliveryService } from "../core/delivery/email-delivery.service"
import { MessagesGateway } from "../messages/messages.gateway"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private emailDelivery: EmailDeliveryService,
    @Optional() private messagesGateway?: MessagesGateway
  ) {}

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }

  async createNotification(
    userId: string,
    title: string,
    type: NotificationType = NotificationType.SYSTEM,
    actionView?: NotificationAction
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        type,
        actionView,
      },
    })

    if (this.messagesGateway) {
      try {
        this.messagesGateway.emitNotification(userId, notification)
      } catch {
        // socket optional
      }
    }

    const [user, setting] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      this.prisma.userSetting.findUnique({
        where: { userId },
        select: { emailNotifications: true },
      }),
    ])
    if (user?.email && setting?.emailNotifications !== false) {
      this.emailDelivery.send(user.email, "Hyrr notification", title).catch(() => undefined)
    }

    return notification
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
