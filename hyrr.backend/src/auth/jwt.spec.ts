import { UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import {
  JWT_SECRET_PLACEHOLDER,
  jwtSecret,
  jwtSecretProblem,
  verifyAccessToken,
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

  it("rejects tampered tokens", () => {
    expect(() => verifyAccessToken(jwt, access.slice(0, -2) + "xx")).toThrow(UnauthorizedException)
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

    it("returns the current role/company from the database", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
        role: "RECRUITER",
        email: "a@b.c",
        companyId: "co-1",
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
