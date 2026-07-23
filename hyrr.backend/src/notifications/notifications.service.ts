import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createNotification(userId: string, title: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
      },
    });
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
