import { ConflictException, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { mockDeep } from "jest-mock-extended"
import { CaptchaService } from "../core/security/captcha.service"
import { PrismaService } from "../prisma/prisma.service"
import { AccountEmailService } from "./account-email.service"
import { AuthService } from "./auth.service"
import { RegisterDto } from "./dtos/register.dto"
import { jwtSecret, verifyAccessToken } from "./jwt.config"
import { LoginAttemptsService } from "./login-attempts.service"
import { TwoFactorService } from "./two-factor.service"

/** Minimal stand-in for CacheService (in-memory, no TTL handling needed for these tests). */
function memoryCache() {
  const store = new Map<string, unknown>()
  return {
    get: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    set: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
    del: jest.fn(async (k: string) => void store.delete(k)),
  }
}

describe("AuthService", () => {
  let service: AuthService
  let prismaMock: any
  let captcha: { isEnabled: jest.Mock; verify: jest.Mock }
  let twoFactor: { verifyCode: jest.Mock }
  let accountEmail: {
    sendVerification: jest.Mock
    notifyPasswordChanged: jest.Mock
    refreshCompanyVerification: jest.Mock
  }

  beforeEach(async () => {
    captcha = { isEnabled: jest.fn().mockReturnValue(false), verify: jest.fn() }
    twoFactor = { verifyCode: jest.fn() }
    accountEmail = {
      sendVerification: jest.fn().mockResolvedValue(undefined),
      notifyPasswordChanged: jest.fn().mockResolvedValue(undefined),
      refreshCompanyVerification: jest.fn().mockResolvedValue(undefined),
    }
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
        { provide: CaptchaService, useValue: captcha },
        { provide: LoginAttemptsService, useValue: new LoginAttemptsService(memoryCache() as any) },
        { provide: TwoFactorService, useValue: twoFactor },
        { provide: AccountEmailService, useValue: accountEmail },
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

    expect((result as any).accessToken).toBe("mock_token")
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

describe("AuthService account security", () => {
  const jwt = new JwtService({ secret: jwtSecret() })
  let prisma: any
  let captcha: { isEnabled: jest.Mock; verify: jest.Mock }
  let twoFactor: { verifyCode: jest.Mock }
  let accountEmail: any
  let service: AuthService
  let passwordHash: string

  const baseUser = (over: Record<string, unknown> = {}) => ({
    id: "u1",
    email: "a@b.c",
    name: "A",
    role: "SEEKER",
    status: "ACTIVE",
    passwordHash,
    tokenVersion: 0,
    emailVerifiedAt: new Date(),
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorRecoveryCodes: [],
    companyId: null,
    ...over,
  })

  beforeAll(async () => {
    passwordHash = await bcrypt.hash("password123", 4)
  })

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    captcha = { isEnabled: jest.fn().mockReturnValue(true), verify: jest.fn() }
    twoFactor = { verifyCode: jest.fn() }
    accountEmail = {
      sendVerification: jest.fn().mockResolvedValue(undefined),
      notifyPasswordChanged: jest.fn().mockResolvedValue(undefined),
      refreshCompanyVerification: jest.fn().mockResolvedValue(undefined),
    }
    service = new AuthService(
      prisma,
      jwt,
      captcha as any,
      new LoginAttemptsService(memoryCache() as any),
      twoFactor as any,
      accountEmail
    )
  })

  describe("login captcha", () => {
    const fail = () =>
      service.login({ email: "a@b.c", password: "wrong-password" }, "1.2.3.4").catch((e) => e)

    it("requires a captcha after 3 failures (same e-mail) when captcha is enabled", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser())
      captcha.verify.mockRejectedValue(
        Object.assign(new Error("x"), { errorCode: "CAPTCHA_REQUIRED" })
      )
      for (let i = 0; i < 3; i++) expect(await fail()).toBeInstanceOf(UnauthorizedException)
      expect(captcha.verify).not.toHaveBeenCalled()

      await expect(
        service.login({ email: "a@b.c", password: "password123" }, "9.9.9.9")
      ).rejects.toMatchObject({ errorCode: "CAPTCHA_REQUIRED" })
      expect(captcha.verify).toHaveBeenCalledWith(undefined, "9.9.9.9")
    })

    it("counts failures per IP across different e-mails", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      for (const email of ["x@b.c", "y@b.c", "z@b.c"]) {
        await service.login({ email, password: "nope-nope" }, "5.5.5.5").catch(() => null)
      }
      captcha.verify.mockResolvedValue(undefined)
      await service.login({ email: "q@b.c", password: "nope-nope" }, "5.5.5.5").catch(() => null)
      expect(captcha.verify).toHaveBeenCalledTimes(1)
    })

    it("lets a valid captcha through and resets the counter on success", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser())
      for (let i = 0; i < 3; i++) await fail()
      captcha.verify.mockResolvedValue(undefined)
      const ok: any = await service.login(
        { email: "a@b.c", password: "password123", captchaToken: "t" },
        "1.2.3.4"
      )
      expect(ok.accessToken).toBeDefined()
      captcha.verify.mockClear()
      await service.login({ email: "a@b.c", password: "password123" }, "1.2.3.4")
      expect(captcha.verify).not.toHaveBeenCalled()
    })

    it("never asks for a captcha when captcha is disabled", async () => {
      captcha.isEnabled.mockReturnValue(false)
      prisma.user.findUnique.mockResolvedValue(baseUser())
      for (let i = 0; i < 5; i++) await fail()
      const ok: any = await service.login({ email: "a@b.c", password: "password123" }, "1.2.3.4")
      expect(ok.accessToken).toBeDefined()
      expect(captcha.verify).not.toHaveBeenCalled()
    })
  })

  it("register verifies the captcha and sends the verification e-mail", async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue(baseUser({ emailVerifiedAt: null }))
    const result = await service.register(
      { name: "A", email: "a@b.c", password: "password123", role: "SEEKER", captchaToken: "t" },
      "1.1.1.1"
    )
    expect(captcha.verify).toHaveBeenCalledWith("t", "1.1.1.1")
    expect(result.emailVerified).toBe(false)
    expect(accountEmail.sendVerification).toHaveBeenCalled()
  })

  it("access and refresh tokens carry the token version and verification flags", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser({ tokenVersion: 4, twoFactorEnabled: false }))
    const result: any = await service.login({ email: "a@b.c", password: "password123" })
    expect(verifyAccessToken(jwt, result.accessToken).tv).toBe(4)
    expect((await service.verifyRefreshToken(result.refreshToken)).tv).toBe(4)
    expect(result).toMatchObject({ emailVerified: true, twoFactorEnabled: false })
  })

  describe("tokenVersion revocation", () => {
    it("rejects a refresh token issued before the version was bumped", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser({ tokenVersion: 1 }))
      await expect(service.refreshTokens("u1", 0)).rejects.toThrow(UnauthorizedException)
      await expect(service.refreshTokens("u1", 1)).resolves.toMatchObject({ userId: "u1" })
    })

    it("change-password bumps the version and returns fresh tokens for this session", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser())
      prisma.user.update.mockResolvedValue(baseUser({ tokenVersion: 1 }))
      const tokens = await service.changePassword("u1", "password123", "new-password-1")
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
      })
      expect(verifyAccessToken(jwt, tokens.accessToken).tv).toBe(1)
      expect(accountEmail.notifyPasswordChanged).toHaveBeenCalled()
    })
  })

  describe("2FA login", () => {
    beforeEach(() => captcha.isEnabled.mockReturnValue(false))

    it("returns an MFA challenge instead of tokens and the mfa token is not an access token", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser({ twoFactorEnabled: true }))
      const result: any = await service.login({ email: "a@b.c", password: "password123" })
      expect(result).toEqual({ mfaRequired: true, mfaToken: expect.any(String) })
      expect(result.accessToken).toBeUndefined()
      expect(() => verifyAccessToken(jwt, result.mfaToken)).toThrow(UnauthorizedException)
      await expect(service.verifyRefreshToken(result.mfaToken)).rejects.toThrow(
        UnauthorizedException
      )
    })

    it("exchanges a valid code for tokens", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser({ twoFactorEnabled: true }))
      const { mfaToken }: any = await service.login({ email: "a@b.c", password: "password123" })
      twoFactor.verifyCode.mockResolvedValue(true)
      const tokens = await service.verifyMfaLogin(mfaToken, "123456")
      expect(verifyAccessToken(jwt, tokens.accessToken).sub).toBe("u1")
      expect(tokens.twoFactorEnabled).toBe(true)
    })

    it("rejects wrong codes, access tokens used as mfa tokens and stale versions", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser({ twoFactorEnabled: true }))
      const { mfaToken }: any = await service.login({ email: "a@b.c", password: "password123" })
      twoFactor.verifyCode.mockResolvedValue(false)
      await expect(service.verifyMfaLogin(mfaToken, "000000")).rejects.toMatchObject({
        errorCode: "TWO_FACTOR_INVALID_CODE",
      })

      const access = jwt.sign({ sub: "u1", role: "SEEKER", email: "a@b.c", tv: 0 })
      await expect(service.verifyMfaLogin(access, "123456")).rejects.toMatchObject({
        errorCode: "MFA_SESSION_EXPIRED",
      })

      prisma.user.findUnique.mockResolvedValue(
        baseUser({ twoFactorEnabled: true, tokenVersion: 2 })
      )
      twoFactor.verifyCode.mockResolvedValue(true)
      await expect(service.verifyMfaLogin(mfaToken, "123456")).rejects.toMatchObject({
        errorCode: "MFA_SESSION_EXPIRED",
      })
    })

    it("locks the second step after too many wrong codes", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser({ twoFactorEnabled: true }))
      const { mfaToken }: any = await service.login({ email: "a@b.c", password: "password123" })
      twoFactor.verifyCode.mockResolvedValue(false)
      for (let i = 0; i < 10; i++)
        await service.verifyMfaLogin(mfaToken, "000000").catch(() => null)
      twoFactor.verifyCode.mockResolvedValue(true)
      await expect(service.verifyMfaLogin(mfaToken, "123456")).rejects.toMatchObject({
        errorCode: "TOO_MANY_REQUESTS",
      })
    })
  })

  it("OAuth sign-up marks the provider-verified e-mail as verified and refreshes company verification", async () => {
    prisma.user.findFirst.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue(baseUser())
    prisma.user.update.mockResolvedValue(baseUser())
    await service.upsertOAuthUser(
      { provider: "google", id: "g", email: "a@b.c", emailVerified: true, name: "A", avatar: "" },
      "SEEKER"
    )
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
    })
    expect(accountEmail.refreshCompanyVerification).toHaveBeenCalledWith("u1")
  })

  it("getMe exposes emailVerified/twoFactorEnabled but never the password hash", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      emailVerifiedAt: null,
      twoFactorEnabled: true,
      passwordHash: "secret-hash",
    })
    const me: any = await service.getMe("u1")
    expect(me).toMatchObject({ emailVerified: false, twoFactorEnabled: true, hasPassword: true })
    expect(me.passwordHash).toBeUndefined()
    expect(me.emailVerifiedAt).toBeUndefined()
  })
})
