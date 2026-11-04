import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { mockDeep } from "jest-mock-extended"
import { decryptSecret, encryptSecret } from "../core/security/secret-box"
import { base32Decode, base32Encode, generateTotp, generateTotpSecret, verifyTotp } from "./totp"
import { hashRecoveryCode, TwoFactorService } from "./two-factor.service"

describe("TOTP", () => {
  it("matches the RFC 6238 SHA-1 test vectors", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"))
    // RFC 6238 Appendix B (last 6 digits of the 8-digit values).
    expect(generateTotp(secret, 59_000)).toBe("287082")
    expect(generateTotp(secret, 1_111_111_109_000)).toBe("081804")
    expect(generateTotp(secret, 20_000_000_000_000)).toBe("353130")
  })

  it("round-trips base32 and tolerates one step of drift only", () => {
    const secret = generateTotpSecret()
    expect(base32Encode(base32Decode(secret))).toBe(secret)
    const now = Date.now()
    expect(verifyTotp(secret, generateTotp(secret, now - 30_000), now)).toBe(true)
    expect(verifyTotp(secret, generateTotp(secret, now - 90_000), now)).toBe(false)
    expect(verifyTotp(secret, "abcdef", now)).toBe(false)
  })
})

describe("TwoFactorService", () => {
  let prisma: any
  let service: TwoFactorService
  const secret = generateTotpSecret()

  const user = (over: Record<string, unknown> = {}) => ({
    id: "u1",
    email: "a@b.c",
    passwordHash: null,
    twoFactorEnabled: true,
    twoFactorSecret: encryptSecret(secret),
    twoFactorRecoveryCodes: [hashRecoveryCode("abcde-fghjk")],
    ...over,
  })

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    service = new TwoFactorService(prisma)
  })

  it("setup stores an encrypted secret and returns QR + otpauth URL", async () => {
    prisma.user.findUnique.mockResolvedValue({ email: "a@b.c", twoFactorEnabled: false })
    const result = await service.setup("u1")
    expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Hyrr:a%40b\.c\?secret=/)
    expect(result.qrDataUrl).toMatch(/^data:image\/png;base64,/)
    const stored = prisma.user.update.mock.calls[0][0].data.twoFactorSecret
    expect(stored).not.toContain(result.secret)
    expect(decryptSecret(stored)).toBe(result.secret)
  })

  it("setup refuses when already enabled", async () => {
    prisma.user.findUnique.mockResolvedValue({ email: "a@b.c", twoFactorEnabled: true })
    await expect(service.setup("u1")).rejects.toMatchObject({
      errorCode: "TWO_FACTOR_ALREADY_ENABLED",
    })
  })

  it("enable requires a valid TOTP and returns 10 recovery codes stored as hashes", async () => {
    prisma.user.findUnique.mockResolvedValue(user({ twoFactorEnabled: false }))
    await expect(service.enable("u1", "000000")).rejects.toMatchObject({
      errorCode: "TWO_FACTOR_INVALID_CODE",
    })
    const { recoveryCodes } = await service.enable("u1", generateTotp(secret))
    expect(recoveryCodes).toHaveLength(10)
    expect(new Set(recoveryCodes).size).toBe(10)
    const data = prisma.user.update.mock.calls[0][0].data
    expect(data.twoFactorEnabled).toBe(true)
    expect(data.twoFactorRecoveryCodes).toEqual(recoveryCodes.map(hashRecoveryCode))
    expect(data.twoFactorRecoveryCodes).not.toContain(recoveryCodes[0])
  })

  it("enable without setup fails with TWO_FACTOR_SETUP_REQUIRED", async () => {
    prisma.user.findUnique.mockResolvedValue(
      user({ twoFactorEnabled: false, twoFactorSecret: null })
    )
    await expect(service.enable("u1", "123456")).rejects.toMatchObject({
      errorCode: "TWO_FACTOR_SETUP_REQUIRED",
    })
  })

  it("recovery codes are single use (atomic consume)", async () => {
    prisma.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    expect(await service.verifyCode(user(), "ABCDE-FGHJK")).toBe(true)
    // A concurrent / repeated use finds the code already removed.
    expect(await service.verifyCode(user(), "abcde fghjk")).toBe(false)
    expect(await service.verifyCode(user(), "zzzzz-zzzzz")).toBe(false)
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2)
  })

  it("disable needs the password for password accounts and a valid code", async () => {
    const passwordHash = await bcrypt.hash("password123", 4)
    prisma.user.findUnique.mockResolvedValue(user({ passwordHash }))
    await expect(service.disable("u1", generateTotp(secret))).rejects.toThrow(/Password/)
    await expect(service.disable("u1", "000000", "password123")).rejects.toMatchObject({
      errorCode: "TWO_FACTOR_INVALID_CODE",
    })
    await expect(service.disable("u1", generateTotp(secret), "password123")).resolves.toEqual({
      disabled: true,
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] },
    })
  })

  it("regenerating recovery codes requires 2FA to be enabled", async () => {
    prisma.user.findUnique.mockResolvedValue(user({ twoFactorEnabled: false }))
    await expect(service.regenerateRecoveryCodes("u1", "123456")).rejects.toMatchObject({
      errorCode: "TWO_FACTOR_NOT_ENABLED",
    })
    prisma.user.findUnique.mockResolvedValue(user())
    const { recoveryCodes } = await service.regenerateRecoveryCodes("u1", generateTotp(secret))
    expect(recoveryCodes).toHaveLength(10)
  })
})
