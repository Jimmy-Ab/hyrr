import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('CalendarService', () => {
  let service: CalendarService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  it('should list calendar events for a seeker', async () => {
    prismaMock.calendarEvent.findMany.mockResolvedValue([
      { id: 'event-1', title: 'Technical Interview' },
    ] as any);

    const result = await service.getEvents('seeker-1', 'SEEKER');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Technical Interview');
  });

  it('should schedule a new interview event', async () => {
    prismaMock.calendarEvent.create.mockResolvedValue({
      id: 'event-2',
      title: 'Culture Fit stage',
      startTime: new Date('2026-07-15T10:00:00Z'),
    } as any);

    const result = await service.createEvent({
      applicationId: 'app-1',
      title: 'Culture Fit stage',
      startTime: '2026-07-15T10:00:00Z',
      type: 'INTERVIEW',
    });

    expect(result.id).toBe('event-2');
  });
});
