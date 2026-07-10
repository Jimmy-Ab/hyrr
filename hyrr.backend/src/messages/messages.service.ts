import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async getConversations(userId: string, role: string) {
    // Get all applications the user is involved in that have messages
    const where =
      role === 'SEEKER'
        ? { userId }
        : { job: { recruiterId: userId } };

    return this.prisma.application.findMany({
      where: where as any,
      include: {
        job: { include: { company: true } },
        user: { select: { id: true, name: true, avatar: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMessages(applicationId: string) {
    return this.prisma.message.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(applicationId: string, senderId: string | null, senderType: string, text: string) {
    const message = await this.prisma.message.create({
      data: {
        applicationId,
        senderId,
        senderType: senderType as any,
        text,
      },
    });

    // Mark other messages in thread as read
    await this.prisma.message.updateMany({
      where: { applicationId, senderId: { not: senderId }, read: false },
      data: { read: true },
    });

    return message;
  }

  async markThreadRead(applicationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { applicationId, senderId: { not: userId }, read: false },
      data: { read: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.message.count({
      where: {
        application: { userId },
        senderId: { not: userId },
        read: false,
      },
    });
  }
}
