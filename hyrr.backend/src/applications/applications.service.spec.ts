import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
  });

  it('should allow applying to a job', async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    prismaMock.application.create.mockResolvedValue({
      id: 'app-123',
      name: 'James Carter',
      email: 'james@example.com',
      status: 'APPLIED',
    } as any);

    const result = await service.applyToJob('job-1', {
      name: 'James Carter',
      email: 'james@example.com',
      title: 'Engineer',
      location: 'SF',
    });

    expect(result.id).toBe('app-123');
    expect(result.status).toBe('APPLIED');
  });

  it('should fetch candidates for Kanban board', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { id: 'app-1', status: 'APPLIED' },
      { id: 'app-2', status: 'IN_PROCESS' },
    ] as any);

    const result = await service.getCandidatesForJob('job-1');
    expect(result).toHaveLength(2);
  });
});
