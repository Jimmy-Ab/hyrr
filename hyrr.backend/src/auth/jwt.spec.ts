import { UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import {
  JWT_SECRET_PLACEHOLDER,
  jwtSecret,
  jwtSecretProblem,
  verifyAccessToken,
  verifyAccessTokenForSession,
} from "./jwt.config"
import { JwtStrategy } from "./strategies/jwt.strategy"

describe("access token verification", () => {
  const jwt = new JwtService({ secret: jwtSecret() })
  const access = jwt.sign({ sub: "u1", role: "SEEKER", email: "a@b.c" }, { expiresIn: "15m" })
  const refresh = jwt.sign({ sub: "u1", type: "refresh" }, { expiresIn: "7d" })

  it("accepts access tokens", () => {
    expect(verifyAccessToken(jwt, access).sub).toBe("u1")
  })

  it("rejects refresh tokens used as access tokens", () => {
    expect(() => verifyAccessToken(jwt, refresh)).toThrow(UnauthorizedException)
  })

  it("rejects MFA challenge tokens used as access tokens", () => {
    const mfa = jwt.sign({ sub: "u1", type: "mfa", tv: 0 }, { expiresIn: "5m" })
    expect(() => verifyAccessToken(jwt, mfa)).toThrow(UnauthorizedException)
  })

  describe("verifyAccessTokenForSession (sockets)", () => {
    const prisma: any = { user: { findUnique: jest.fn() } }
    beforeEach(() => prisma.user.findUnique.mockReset())

    it("accepts a token whose tv matches; legacy tokens without tv count as 0", async () => {
      prisma.user.findUnique.mockResolvedValue({ status: "ACTIVE", tokenVersion: 0 })
      await expect(verifyAccessTokenForSession(jwt, prisma, access)).resolves.toMatchObject({
        sub: "u1",
      })
    })

    it("rejects revoked tokens and inactive users", async () => {
      prisma.user.findUnique.mockResolvedValue({ status: "ACTIVE", tokenVersion: 1 })
      await expect(verifyAccessTokenForSession(jwt, prisma, access)).rejects.toThrow(
        UnauthorizedException
      )
      const v1 = jwt.sign({ sub: "u1", role: "SEEKER", email: "a@b.c", tv: 1 })
      await expect(verifyAccessTokenForSession(jwt, prisma, v1)).resolves.toBeDefined()
      prisma.user.findUnique.mockResolvedValue({ status: "SUSPENDED", tokenVersion: 1 })
      await expect(verifyAccessTokenForSession(jwt, prisma, v1)).rejects.toThrow(
        UnauthorizedException
      )
    })
  })

  it("rejects tampered tokens", () => {
    expect(() => verifyAccessToken(jwt, access.slice(0, -2) + "xx")).toThrow(UnauthorizedException)
  })

  describe("JwtStrategy lastActiveAt tracking", () => {
    it("writes lastActiveAt at most once per throttle window (cache key active:<id>)", async () => {
      const store = new Map<string, unknown>()
      const cache: any = {
        get: jest.fn(async (k: string) => store.get(k) ?? null),
        set: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
      }
      const prisma: any = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: "u1",
            status: "ACTIVE",
            role: "SEEKER",
            email: "a@b.c",
            tokenVersion: 0,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      }
      const strategy = new JwtStrategy(prisma, cache)
      await strategy.validate({ sub: "u1", role: "SEEKER", email: "a@b.c" })
      await strategy.validate({ sub: "u1", role: "SEEKER", email: "a@b.c" })
      expect(prisma.user.update).toHaveBeenCalledTimes(1)
      expect(prisma.user.update.mock.calls[0][0]).toMatchObject({
        where: { id: "u1" },
        data: { lastActiveAt: expect.any(Date) },
      })
      expect(cache.set).toHaveBeenCalledWith("active:u1", 1, 3600)
    })

    it("never fails the request when the write fails", async () => {
      const cache: any = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
      const prisma: any = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: "u1", status: "ACTIVE", tokenVersion: 0 }),
          update: jest.fn().mockRejectedValue(new Error("db down")),
        },
      }
      await expect(
        new JwtStrategy(prisma, cache).validate({ sub: "u1", role: "SEEKER", email: "a@b.c" })
      ).resolves.toMatchObject({ userId: "u1" })
    })
  })

  describe("JwtStrategy.validate", () => {
    const prisma: any = { user: { findUnique: jest.fn() } }
    const strategy = new JwtStrategy(prisma)

    beforeEach(() => prisma.user.findUnique.mockReset())

    it("rejects refresh-token payloads before touching the database", async () => {
      await expect(strategy.validate({ sub: "u1", type: "refresh" } as any)).rejects.toThrow(
        UnauthorizedException
      )
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it("rejects suspended users", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", status: "SUSPENDED", role: "SEEKER" })
      await expect(
        strategy.validate({ sub: "u1", role: "SEEKER", email: "a@b.c" })
      ).rejects.toThrow(UnauthorizedException)
    })

    it("rejects tokens issued before a password reset/change (tokenVersion)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
        role: "SEEKER",
        email: "a@b.c",
        tokenVersion: 2,
      })
      await expect(
        strategy.validate({ sub: "u1", role: "SEEKER", email: "a@b.c", tv: 1 })
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        strategy.validate({ sub: "u1", role: "SEEKER", email: "a@b.c", tv: 2 })
      ).resolves.toMatchObject({ userId: "u1" })
    })

    it("rejects mfa tokens before touching the database", async () => {
      await expect(strategy.validate({ sub: "u1", type: "mfa" } as any)).rejects.toThrow(
        UnauthorizedException
      )
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it("returns the current role/company from the database", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
        role: "RECRUITER",
        email: "a@b.c",
        companyId: "co-1",
        tokenVersion: 0,
      })
      await expect(
        strategy.validate({ sub: "u1", role: "SEEKER", email: "a@b.c" })
      ).resolves.toEqual({ userId: "u1", role: "RECRUITER", email: "a@b.c", companyId: "co-1" })
    })
  })
})

describe("jwtSecretProblem", () => {
  it("flags missing, short and placeholder secrets", () => {
    expect(jwtSecretProblem(undefined)).toBeTruthy()
    expect(jwtSecretProblem("short")).toBeTruthy()
    expect(jwtSecretProblem(JWT_SECRET_PLACEHOLDER)).toBeTruthy()
    expect(jwtSecretProblem("x".repeat(40))).toBeNull()
  })

  it("refuses an unsafe secret in production", () => {
    const env = { ...process.env }
    try {
      process.env.NODE_ENV = "production"
      process.env.JWT_SECRET = JWT_SECRET_PLACEHOLDER
      expect(() => jwtSecret()).toThrow(/production/)
    } finally {
      process.env = env
    }
  })
})
