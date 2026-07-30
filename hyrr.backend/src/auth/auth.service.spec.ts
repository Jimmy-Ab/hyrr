import { ConflictException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { mockDeep } from "jest-mock-extended"
import { PrismaService } from "../prisma/prisma.service"
import { AuthService } from "./auth.service"

describe("AuthService", () => {
  let service: AuthService
  let prismaMock: any

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue("mock_token"),
          },
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  it("should register a new user successfully", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({
      id: "user-123",
      name: "Emily Carter",
      email: "emily@example.com",
      passwordHash: "hashed_password",
      role: "SEEKER",
    })

    prismaMock.seekerProfile.create.mockResolvedValue({})

    const result = await service.register({
      name: "Emily Carter",
      email: "emily@example.com",
      password: "password123",
      role: "SEEKER",
    })

    expect(result.accessToken).toBe("mock_token")
    expect(result.refreshToken).toBe("mock_token")
    expect(result.userId).toBe("user-123")
  })

  it("should throw ConflictException if email already exists during registration", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-123" })

    await expect(
      service.register({
        name: "Emily Carter",
        email: "emily@example.com",
        password: "password123",
        role: "SEEKER",
      })
    ).rejects.toThrow(ConflictException)
  })

  it("should login an existing user with correct password", async () => {
    const passwordHash = await bcrypt.hash("password123", 12)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-123",
      email: "emily@example.com",
      passwordHash,
      role: "SEEKER",
    })

    prismaMock.user.update.mockResolvedValue({})

    const result = await service.login({
      email: "emily@example.com",
      password: "password123",
    })

    expect(result.accessToken).toBe("mock_token")
  })
})
