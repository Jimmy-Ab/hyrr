import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(forwardRef(() => MessagesGateway)) private messagesGateway?: MessagesGateway,
  ) {}

  async getConversations(userId: string, role: string) {
    if (role === 'SEEKER') {
      const me = await this.prisma.user.findUnique({ where: { id: userId } });
      const seekerEmail = me?.email;

      const apps: any[] = await this.prisma.application.findMany({
        where: {
          OR: [
            { userId },
            ...(seekerEmail ? [{ email: seekerEmail }] : []),
          ],
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
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Group by Recruiter ID so there is only 1 conversation item per recruiter
      const groupedMap = new Map<string, any>();

      for (const app of apps) {
        const recruiterKey = app.job?.recruiterId || app.job?.companyId || app.id;
        const activeMessages: any[] = app.messages || [];
        const unreadCount = activeMessages.filter(
          (m: any) => m.receiverId === userId && !m.read
        ).length;

        const existing = groupedMap.get(recruiterKey);
        if (!existing) {
          groupedMap.set(recruiterKey, { ...app, _visibleMessages: activeMessages, _unreadCount: unreadCount });
        } else {
          const existingDate = existing._visibleMessages[0]?.createdAt ?? existing.updatedAt;
          const currentDate = activeMessages[0]?.createdAt ?? app.updatedAt;

          if (currentDate > existingDate || (existing._visibleMessages.length === 0 && activeMessages.length > 0)) {
            groupedMap.set(recruiterKey, {
              ...app,
              _visibleMessages: activeMessages,
              _unreadCount: existing._unreadCount + unreadCount,
            });
          } else {
            existing._unreadCount += unreadCount;
          }
        }
      }

      // Only show conversations that have at least 1 visible (non-deleted) message
      const result = Array.from(groupedMap.values()).filter(
        (item) => item._visibleMessages.length > 0
      );

      return result.map((app: any) => ({
        ...app,
        messages: app._visibleMessages,
        candidateName: app.job?.postedBy?.name || app.job?.company?.name || 'Recruiter',
        jobTitle: app.job?.title || app.title,
        avatar:
          app.job?.postedBy?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(app.job?.company?.name || 'Recruiter')}`,
      }));
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
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const groupedMap = new Map<string, any>();

      for (const app of apps) {
        const candidateKey = app.userId || app.email;
        const activeMessages: any[] = app.messages || [];
        const unreadCount = activeMessages.filter(
          (m: any) => m.receiverId === userId && !m.read
        ).length;

        const existing = groupedMap.get(candidateKey);
        if (!existing) {
          groupedMap.set(candidateKey, { ...app, _visibleMessages: activeMessages, _unreadCount: unreadCount });
        } else {
          const existingDate = existing._visibleMessages[0]?.createdAt ?? existing.updatedAt;
          const currentDate = activeMessages[0]?.createdAt ?? app.updatedAt;

          if (currentDate > existingDate || (existing._visibleMessages.length === 0 && activeMessages.length > 0)) {
            groupedMap.set(candidateKey, {
              ...app,
              _visibleMessages: activeMessages,
              _unreadCount: existing._unreadCount + unreadCount,
            });
          } else {
            existing._unreadCount += unreadCount;
          }
        }
      }

      // Only show conversations that have at least 1 visible (non-deleted) message
      const result = Array.from(groupedMap.values()).filter(
        (item) => item._visibleMessages.length > 0
      );

      return result.map((app: any) => ({
        ...app,
        messages: app._visibleMessages,
        candidateName: app.name || app.user?.name || 'Applicant',
        jobTitle: app.job?.title || app.title,
        avatar:
          app.user?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(app.name || 'Applicant')}`,
      }));
    }
  }

  async getMessages(applicationId: string, role?: string) {
    const where: any = { applicationId };
    if (role === 'SEEKER') {
      where.deletedBySeeker = false;
    } else if (role === 'RECRUITER') {
      where.deletedByRecruiter = false;
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteConversation(applicationId: string, userId: string, role: string) {
    if (role === 'SEEKER') {
      await this.prisma.message.updateMany({
        where: { applicationId },
        data: { deletedBySeeker: true },
      });
    } else {
      await this.prisma.message.updateMany({
        where: { applicationId },
        data: { deletedByRecruiter: true },
      });
    }
    return { success: true, message: 'Conversation deleted for this user.' };
  }

  async createMessage(applicationId: string, senderId: string | null, senderType: string, text: string) {
    const application: any = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    let receiverId: string | null = null;
    if (application) {
      if (senderType === 'SEEKER') {
        receiverId = application.job?.recruiterId || null;
      } else {
        receiverId = application.userId || null;
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
    });

    if (senderId) {
      await this.prisma.message.updateMany({
        where: { applicationId, senderId: { not: senderId }, read: false },
        data: { read: true },
      });
    }

    if (this.messagesGateway?.server) {
      // Broadcast to chat room (gateway's send_message uses client.to() to exclude sender)
      this.messagesGateway.server.to(`chat_${applicationId}`).emit('new_message', message);
      this.messagesGateway.server.to(`chat_${applicationId}`).emit('unread_update', { applicationId });

      // Also notify receiver's private room in case they're not in the chat room
      if (receiverId) {
        this.messagesGateway.server.to(`user_${receiverId}`).emit('new_message', message);
        this.messagesGateway.server.to(`user_${receiverId}`).emit('unread_update', { applicationId });
      }
    }

    return message;
  }

  async markThreadRead(applicationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { applicationId, senderId: { not: userId }, read: false },
      data: { read: true },
    });
  }

  async getUnreadCount(userId: string, role: string = 'SEEKER') {
    if (role === 'SEEKER') {
      const count = await this.prisma.message.count({
        where: {
          application: { userId },
          senderId: { not: userId },
          read: false,
          deletedBySeeker: false,
        },
      });
      return { count };
    } else {
      const count = await this.prisma.message.count({
        where: {
          application: { job: { recruiterId: userId } },
          senderId: { not: userId },
          read: false,
          deletedByRecruiter: false,
        },
      });
      return { count };
    }
  }
}
