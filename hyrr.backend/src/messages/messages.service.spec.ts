import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('MessagesService', () => {
  let service: MessagesService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should list conversations for user', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { id: 'app-1', messages: [{ text: 'Hello' }] },
    ] as any);

    const result = await service.getConversations('user-1', 'SEEKER');
    expect(result).toHaveLength(1);
  });

  it('should save a sent message and mark other messages as read', async () => {
    prismaMock.message.create.mockResolvedValue({
      id: 'msg-1',
      text: 'Thanks for the invite',
      senderType: 'SEEKER',
    } as any);

    prismaMock.message.updateMany.mockResolvedValue({ count: 1 } as any);

    const result = await service.createMessage('app-1', 'user-1', 'SEEKER', 'Thanks for the invite');
    expect(result.id).toBe('msg-1');
    expect(prismaMock.message.updateMany).toHaveBeenCalled();
  });
});
