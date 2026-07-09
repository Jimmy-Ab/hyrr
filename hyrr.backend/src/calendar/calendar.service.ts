import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getEvents(userId: string, role: string) {
    const where =
      role === 'SEEKER'
        ? { application: { userId } }
        : { application: { job: { recruiterId: userId } } };

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        application: {
          include: {
            job: { include: { company: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async createEvent(data: {
    applicationId: string;
    title: string;
    startTime: string;
    endTime?: string;
    type: string;
    notes?: string;
  }) {
    return this.prisma.calendarEvent.create({
      data: {
        applicationId: data.applicationId,
        title: data.title,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
        type: data.type as any,
        notes: data.notes || '',
      },
      include: {
        application: {
          include: {
            job: { include: { company: true } },
          },
        },
      },
    });
  }

  async deleteEvent(id: string) {
    return this.prisma.calendarEvent.delete({ where: { id } });
  }
}
