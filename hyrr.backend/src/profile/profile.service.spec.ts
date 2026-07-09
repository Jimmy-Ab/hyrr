import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('ProfileService', () => {
  let service: ProfileService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should retrieve a seeker profile', async () => {
    prismaMock.seekerProfile.findUnique.mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      title: 'Software Developer',
    } as any);

    const result = await service.getProfile('user-1');
    expect(result.id).toBe('profile-1');
    expect(result.title).toBe('Software Developer');
  });

  it('should update profile fields successfully', async () => {
    prismaMock.seekerProfile.findUnique.mockResolvedValue({ id: 'profile-1' } as any);
    prismaMock.seekerProfile.update.mockResolvedValue({
      id: 'profile-1',
      title: 'Lead Software Engineer',
    } as any);

    const result = await service.updateProfile('user-1', { title: 'Lead Software Engineer' });
    expect(result.title).toBe('Lead Software Engineer');
  });
});
