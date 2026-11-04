import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AccountEmailService } from "./account-email.service"
import { sha256 } from "./one-time-token"

describe("AccountEmailService", () => {
  let prisma: any
  let email: { send: jest.Mock }
  let captcha: { verify: jest.Mock; isEnabled: jest.Mock }
  let companyVerification: { refreshForUser: jest.Mock }
  let service: AccountEmailService

  const token = (over: Record<string, unknown> = {}) => ({
    id: "t1",
    userId: "u1",
    type: "VERIFY_EMAIL",
    tokenHash: sha256("raw-token-value-123"),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    ...over,
  })

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    email = { send: jest.fn().mockResolvedValue({ delivered: false }) }
    captcha = { verify: jest.fn().mockResolvedValue(undefined), isEnabled: jest.fn() }
    companyVerification = { refreshForUser: jest.fn().mockResolvedValue(undefined) }
    service = new AccountEmailService(
      prisma,
      email as any,
      captcha as any,
      companyVerification as any
    )
  })

  describe("verification", () => {
    it("stores only the hash of a 24h token and e-mails the raw link", async () => {
      await service.sendVerification({ id: "u1", email: "a@b.c", name: "A", role: "SEEKER" })
      const data = prisma.authToken.create.mock.calls[0][0].data
      const sent = email.send.mock.calls[0][0]
      const raw = decodeURIComponent(/token=([^\s"&<]+)/.exec(sent.text)![1])
      expect(data.tokenHash).toBe(sha256(raw))
      expect(data.type).toBe("VERIFY_EMAIL")
      const ttl = data.expiresAt.getTime() - Date.now()
      expect(ttl).toBeGreaterThan(23.9 * 3600_000)
      expect(ttl).toBeLessThanOrEqual(24 * 3600_000)
      expect(sent.to).toBe("a@b.c")
    })

    it("verifies once and refreshes company verification", async () => {
      prisma.authToken.findUnique.mockResolvedValue(token())
      prisma.authToken.updateMany.mockResolvedValue({ count: 1 })
      await expect(service.verifyEmail("raw-token-value-123")).resolves.toEqual({ verified: true })
      expect(prisma.authToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256("raw-token-value-123") },
      })
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "u1", emailVerifiedAt: null },
        data: { emailVerifiedAt: expect.any(Date) },
      })
      expect(companyVerification.refreshForUser).toHaveBeenCalledWith("u1")
    })

    it.each([
      ["unknown", null, "TOKEN_INVALID"],
      ["used", token({ usedAt: new Date() }), "TOKEN_INVALID"],
      ["wrong type", token({ type: "RESET_PASSWORD" }), "TOKEN_INVALID"],
      ["expired", token({ expiresAt: new Date(Date.now() - 1) }), "TOKEN_EXPIRED"],
    ])("rejects %s tokens", async (_label, row, code) => {
      prisma.authToken.findUnique.mockResolvedValue(row)
      await expect(service.verifyEmail("raw-token-value-123")).rejects.toMatchObject({
        errorCode: code,
        status: 400,
      })
      expect(prisma.user.updateMany).not.toHaveBeenCalled()
    })

    it("loses the race when the token is consumed concurrently", async () => {
      prisma.authToken.findUnique.mockResolvedValue(token())
      prisma.authToken.updateMany.mockResolvedValue({ count: 0 })
      await expect(service.verifyEmail("raw-token-value-123")).rejects.toMatchObject({
        errorCode: "TOKEN_INVALID",
      })
    })

    it("resend is limited to one per minute", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        name: "A",
        role: "SEEKER",
        emailVerifiedAt: null,
      })
      prisma.authToken.findFirst.mockResolvedValue({ id: "recent" })
      await expect(service.resendVerification("u1")).rejects.toMatchObject({
        errorCode: "TOO_MANY_REQUESTS",
        status: 429,
      })
      prisma.authToken.findFirst.mockResolvedValue(null)
      await expect(service.resendVerification("u1")).resolves.toEqual({ sent: true })
      expect(email.send).toHaveBeenCalledTimes(1)
    })
  })

  describe("password reset", () => {
    it("forgot-password always answers ok and never reveals unknown accounts", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.forgotPassword("nobody@b.c")).resolves.toEqual({ ok: true })
      expect(prisma.authToken.create).not.toHaveBeenCalled()
      expect(captcha.verify).toHaveBeenCalled()
    })

    it("forgot-password invalidates older unused reset tokens and issues a 1h token", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@b.c",
        name: "A",
        role: "RECRUITER",
        status: "ACTIVE",
      })
      await service.forgotPassword("a@b.c")
      await new Promise((r) => setImmediate(r))
      expect(prisma.authToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1", type: "RESET_PASSWORD", usedAt: null },
        data: { usedAt: expect.any(Date) },
      })
      const data = prisma.authToken.create.mock.calls[0][0].data
      expect(data.type).toBe("RESET_PASSWORD")
      expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3600_000)
      expect(email.send.mock.calls[0][0].text).toContain("/reset-password?token=")
    })

    it("reset sets the password, bumps tokenVersion and notifies the user", async () => {
      prisma.authToken.findUnique.mockResolvedValue(token({ type: "RESET_PASSWORD" }))
      prisma.authToken.updateMany.mockResolvedValue({ count: 1 })
      prisma.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() })
      prisma.user.update.mockResolvedValue({ id: "u1", email: "a@b.c", name: "A", role: "SEEKER" })
      await expect(service.resetPassword("raw-token-value-123", "new-password-1")).resolves.toEqual(
        {
          ok: true,
        }
      )
      const data = prisma.user.update.mock.calls[0][0].data
      expect(data.tokenVersion).toEqual({ increment: 1 })
      expect(data.passwordHash).toMatch(/^\$2[aby]\$/)
      expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: "a@b.c" }))
    })

    it("reset refuses a verification token", async () => {
      prisma.authToken.findUnique.mockResolvedValue(token({ type: "VERIFY_EMAIL" }))
      await expect(
        service.resetPassword("raw-token-value-123", "new-password-1")
      ).rejects.toMatchObject({
        errorCode: "TOKEN_INVALID",
      })
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })
})
