import { Inject, Injectable, Optional, forwardRef } from "@nestjs/common"
import { NotificationAction, NotificationType } from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { MessagesGateway } from "./messages.gateway"

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    @Optional()
    @Inject(forwardRef(() => MessagesGateway))
    private messagesGateway?: MessagesGateway,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private notifications?: NotificationsService
  ) {}

  async getConversations(userId: string, role: string) {
    if (role === "SEEKER") {
      const me = await this.prisma.user.findUnique({ where: { id: userId } })
      const seekerEmail = me?.email

      const apps: any[] = await this.prisma.application.findMany({
        where: {
          OR: [{ userId }, ...(seekerEmail ? [{ email: seekerEmail }] : [])],
        },
        include: {
          job: {
            include: {
              company: true,
              postedBy: { select: { id: true, name: true, avatar: true } },
            },
          },
          user: { select: { id: true, name: true, avatar: true } },
          messages: {
            where: { deletedBySeeker: false },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      })

      // A chat is scoped to its application. Returning every application keeps
      // first-contact threads reachable and prevents messages for other roles
      // at the same company from being hidden by client-side grouping.
      return apps.map((app: any) => ({
        ...app,
        _unreadCount: (app.messages || []).filter(
          (message: any) => message.receiverId === userId && !message.read
        ).length,
        candidateName: app.job?.postedBy?.name || app.job?.company?.name || "Recruiter",
        jobTitle: app.job?.title || app.title,
        avatar:
          app.job?.postedBy?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(app.job?.company?.name || "Recruiter")}`,
      }))
    } else {
      // Recruiter role: group by Seeker
      const apps: any[] = await this.prisma.application.findMany({
        where: {
          job: { recruiterId: userId },
        },
        include: {
          job: { include: { company: true } },
          user: { select: { id: true, name: true, avatar: true, email: true } },
          messages: {
            where: { deletedByRecruiter: false },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      })

      return apps.map((app: any) => ({
        ...app,
        _unreadCount: (app.messages || []).filter(
          (message: any) => message.receiverId === userId && !message.read
        ).length,
        candidateName: app.name || app.user?.name || "Applicant",
        jobTitle: app.job?.title || app.title,
        avatar:
          app.user?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(app.name || "Applicant")}`,
      }))
    }
  }

  async getMessages(applicationId: string, actor: Actor) {
    await this.access.applicationFor(actor, applicationId, "view")
    await this.prisma.message.updateMany({
      where: { applicationId, senderId: { not: actor.userId }, read: false },
      data: { read: true },
    })
    const where: any = { applicationId }
    if (actor.role === "SEEKER") {
      where.deletedBySeeker = false
    } else if (actor.role === "RECRUITER") {
      where.deletedByRecruiter = false
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
    })
  }

  async deleteConversation(applicationId: string, userId: string, role: string, actor: Actor) {
    await this.access.applicationFor(actor, applicationId, "view")
    if (role === "SEEKER") {
      await this.prisma.message.updateMany({
        where: { applicationId },
        data: { deletedBySeeker: true },
      })
    } else {
      await this.prisma.message.updateMany({
        where: { applicationId },
        data: { deletedByRecruiter: true },
      })
    }
    return { success: true, message: "Conversation deleted for this user." }
  }

  async createMessage(
    applicationId: string,
    senderId: string | null,
    senderType: string,
    text: string,
    actor: Actor
  ) {
    await this.access.applicationFor(actor, applicationId, "view")
    const application: any = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: { include: { company: { select: { name: true } } } },
        user: { select: { name: true } },
      },
    })

    let receiverId: string | null = null
    if (application) {
      if (senderType === "SEEKER") {
        receiverId = application.job?.recruiterId || null
      } else {
        receiverId = application.userId || null
      }
    }

    const message = await this.prisma.message.create({
      data: {
        applicationId,
        senderId,
        receiverId,
        senderType: senderType as any,
        text,
        deletedBySeeker: false,
        deletedByRecruiter: false,
      },
    })

    if (senderId) {
      await this.prisma.message.updateMany({
        where: { applicationId, senderId: { not: senderId }, read: false },
        data: { read: true },
      })
    }

    if (this.messagesGateway?.server) {
      // Broadcast to chat room (gateway's send_message uses client.to() to exclude sender)
      this.messagesGateway.server.to(`chat_${applicationId}`).emit("new_message", message)
      this.messagesGateway.server
        .to(`chat_${applicationId}`)
        .emit("unread_update", { applicationId })

      // Also notify receiver's private room in case they're not in the chat room
      if (receiverId) {
        this.messagesGateway.server.to(`user_${receiverId}`).emit("new_message", message)
        this.messagesGateway.server
          .to(`user_${receiverId}`)
          .emit("unread_update", { applicationId })
      }
    }

    if (receiverId) {
      const senderName =
        senderType === "SEEKER"
          ? application.name || application.user?.name || "An applicant"
          : application.job?.company?.name || "Your recruiter"
      this.notifications
        ?.createNotification(
          receiverId,
          `New message from ${senderName} about ${application.job?.title || "your application"}`,
          NotificationType.MESSAGE,
          NotificationAction.MESSAGES
        )
        .catch(() => undefined)
    }

    return message
  }

  async markThreadRead(applicationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { applicationId, senderId: { not: userId }, read: false },
      data: { read: true },
    })
  }

  async assertParticipant(applicationId: string, actor: Actor) {
    await this.access.applicationFor(actor, applicationId, "view")
  }

  async getUnreadCount(userId: string, role: string = "SEEKER") {
    if (role === "SEEKER") {
      const count = await this.prisma.message.count({
        where: {
          application: { userId },
          senderId: { not: userId },
          read: false,
          deletedBySeeker: false,
        },
      })
      return { count }
    } else {
      const count = await this.prisma.message.count({
        where: {
          application: { job: { recruiterId: userId } },
          senderId: { not: userId },
          read: false,
          deletedByRecruiter: false,
        },
      })
      return { count }
    }
  }
}
