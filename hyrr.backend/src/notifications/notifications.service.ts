import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private messagesGateway?: MessagesGateway,
  ) {}

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createNotification(userId: string, title: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
      },
    });

    if (this.messagesGateway) {
      try {
        this.messagesGateway.emitNotification(userId, notification);
      } catch {
        // socket optional
      }
    }

    return notification;
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId },
      data: { read: true },
    });
  }

  async clearNotifications(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }
}
