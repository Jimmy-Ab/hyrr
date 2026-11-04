import { ConflictException, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { mockDeep } from "jest-mock-extended"
import { PrismaService } from "../prisma/prisma.service"
import { AuthService } from "./auth.service"
import { RegisterDto } from "./dtos/register.dto"

describe("AuthService", () => {
  let service: AuthService
  let prismaMock: any

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    // Interactive transactions run against the same mock client.
    prismaMock.$transaction.mockImplementation((fn: any) => fn(prismaMock))
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
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(prismaMock.seekerProfile.create).toHaveBeenCalled()
  })

  it("creates company + OWNER membership inside the transaction for recruiters", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ id: "rec-1", email: "r@x.io", role: "RECRUITER" })
    prismaMock.company.create.mockResolvedValue({ id: "co-1" })
    prismaMock.user.update.mockResolvedValue({
      id: "rec-1",
      email: "r@x.io",
      role: "RECRUITER",
      companyId: "co-1",
    })

    await service.register({
      name: "Rae",
      email: "r@x.io",
      password: "password123",
      role: "RECRUITER",
    })

    expect(prismaMock.companyMember.create).toHaveBeenCalledWith({
      data: { companyId: "co-1", userId: "rec-1", role: "OWNER" },
    })
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
    const passwordHash = await bcrypt.hash("password123", 4)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-123",
      email: "emily@example.com",
      passwordHash,
      role: "SEEKER",
      status: "ACTIVE",
    })

    prismaMock.user.update.mockResolvedValue({})

    const result = await service.login({
      email: "emily@example.com",
      password: "password123",
    })

    expect(result.accessToken).toBe("mock_token")
  })

  it("rejects login for a suspended account even with the right password", async () => {
    const passwordHash = await bcrypt.hash("password123", 4)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-9",
      email: "bad@example.com",
      passwordHash,
      role: "SEEKER",
      status: "SUSPENDED",
    })

    await expect(
      service.login({ email: "bad@example.com", password: "password123" })
    ).rejects.toMatchObject({ errorCode: "ACCOUNT_INACTIVE", status: 403 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("refuses to refresh tokens for a non-active user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u", status: "SUSPENDED" })
    await expect(service.refreshTokens("u")).rejects.toThrow(UnauthorizedException)
  })

  describe("OAuth", () => {
    it("never links or creates by e-mail when the provider did not verify it", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      const result = await service.upsertOAuthUser(
        {
          provider: "github",
          id: "gh-1",
          email: "victim@example.com",
          emailVerified: false,
          name: "Mallory",
          avatar: "",
        },
        "SEEKER"
      )
      expect(result).toEqual({ error: "email_unverified" })
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it("uses the requested role only for brand-new accounts", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        role: "SEEKER",
        status: "ACTIVE",
        googleId: null,
      })
      prismaMock.user.update.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        role: "SEEKER",
        status: "ACTIVE",
        googleId: "g1",
      })
      const result = await service.upsertOAuthUser(
        {
          provider: "google",
          id: "g1",
          email: "a@b.c",
          emailVerified: true,
          name: "A",
          avatar: "",
        },
        "RECRUITER"
      )
      expect(result).toMatchObject({ role: "SEEKER", userId: "u1" })
      expect(prismaMock.company.create).not.toHaveBeenCalled()
    })

    it("creates company + OWNER membership for a new RECRUITER OAuth signup", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.user.create.mockResolvedValue({ id: "n1", email: "n@b.c", role: "RECRUITER" })
      prismaMock.company.create.mockResolvedValue({ id: "co-9" })
      prismaMock.user.update.mockResolvedValue({
        id: "n1",
        email: "n@b.c",
        role: "RECRUITER",
        status: "ACTIVE",
        companyId: "co-9",
      })
      const result = await service.upsertOAuthUser(
        {
          provider: "linkedin",
          id: "li-1",
          email: "n@b.c",
          emailVerified: true,
          name: "New",
          avatar: "",
        },
        "RECRUITER"
      )
      expect(result).toMatchObject({ role: "RECRUITER" })
      expect(prismaMock.companyMember.create).toHaveBeenCalledWith({
        data: { companyId: "co-9", userId: "n1", role: "OWNER" },
      })
    })
  })

  describe("deleteAccount", () => {
    it("requires the current password for password accounts", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u",
        passwordHash: await bcrypt.hash("right-password", 4),
      })
      await expect(service.deleteAccount("u", "wrong")).rejects.toThrow(UnauthorizedException)
      expect(prismaMock.user.delete).not.toHaveBeenCalled()
    })

    it("asks a sole owner of a company with other members to transfer ownership", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u",
        role: "RECRUITER",
        companyId: "co",
        passwordHash: null,
      })
      prismaMock.companyMember.findMany.mockImplementation(async (args: any) =>
        args.where.userId === "u"
          ? [{ companyId: "co", userId: "u", role: "OWNER" }]
          : [{ companyId: "co", userId: "other", role: "RECRUITER" }]
      )
      await expect(service.deleteAccount("u")).rejects.toMatchObject({
        errorCode: "TRANSFER_OWNERSHIP_FIRST",
      })
      expect(prismaMock.user.delete).not.toHaveBeenCalled()
    })
  })
})

describe("RegisterDto", () => {
  const base = { name: "Eve", email: "eve@example.com", password: "password123" }

  it.each(["ADMIN", "admin", "SUPERUSER", ""])("rejects role %p", async (role) => {
    const errors = await validate(plainToInstance(RegisterDto, { ...base, role }))
    expect(errors.some((e) => e.property === "role")).toBe(true)
  })

  it.each(["SEEKER", "RECRUITER"])("accepts role %p", async (role) => {
    const errors = await validate(plainToInstance(RegisterDto, { ...base, role }))
    expect(errors).toHaveLength(0)
  })
})
