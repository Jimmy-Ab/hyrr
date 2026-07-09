import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let jwtService: JwtService;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should register a new user successfully', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-123',
      name: 'Emily Carter',
      email: 'emily@example.com',
      passwordHash: 'hashed_password',
      role: 'SEEKER',
    } as any);

    prismaMock.seekerProfile.create.mockResolvedValue({} as any);

    const result = await service.register({
      name: 'Emily Carter',
      email: 'emily@example.com',
      password: 'password123',
      role: 'SEEKER',
    });

    expect(result.accessToken).toBe('mock_token');
    expect(result.refreshToken).toBe('mock_token');
    expect(result.userId).toBe('user-123');
  });

  it('should throw ConflictException if email already exists during registration', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing-123' } as any);

    await expect(
      service.register({
        name: 'Emily Carter',
        email: 'emily@example.com',
        password: 'password123',
        role: 'SEEKER',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should login an existing user with correct password', async () => {
    const passwordHash = await bcrypt.hash('password123', 12);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'emily@example.com',
      passwordHash,
      role: 'SEEKER',
    } as any);

    prismaMock.user.update.mockResolvedValue({} as any);

    const result = await service.login({
      email: 'emily@example.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('mock_token');
  });
});
