import { HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common"
import * as bcrypt from "bcrypt"
import { randomInt } from "crypto"
import * as QRCode from "qrcode"
import { AppException } from "../core/exceptions/app-exception"
import { decryptSecret, encryptSecret } from "../core/security/secret-box"
import { PrismaService } from "../prisma/prisma.service"
import { digestsEqual, sha256 } from "./one-time-token"
import { generateTotpSecret, totpUri, verifyTotp } from "./totp"

export const RECOVERY_CODE_COUNT = 10
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789" // no 0/o/1/l/i

type TwoFactorUser = {
  id: string
  twoFactorSecret: string | null
  twoFactorRecoveryCodes: string[]
}

const invalidCode = (status = HttpStatus.BAD_REQUEST) =>
  new AppException("The verification code is not valid", status, "TWO_FACTOR_INVALID_CODE")

/** Normalises a recovery code: lower-case, no separators/spaces. */
export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[\s-]/g, "")
}

export function hashRecoveryCode(code: string): string {
  return sha256(normalizeRecoveryCode(code))
}

function isTotpShape(code: string): boolean {
  return /^\d{6}$/.test(code.replace(/\s/g, ""))
}

@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  private issuer() {
    return process.env.TWO_FACTOR_ISSUER?.trim() || "Hyrr"
  }

  /** Starts (or restarts) enrolment: stores a new encrypted secret, still disabled. */
  async setup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true },
    })
    if (!user) throw new UnauthorizedException("Access denied")
    if (user.twoFactorEnabled) {
      throw new AppException(
        "Two-factor authentication is already enabled",
        HttpStatus.CONFLICT,
        "TWO_FACTOR_ALREADY_ENABLED"
      )
    }
    const secret = generateTotpSecret()
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptSecret(secret) },
    })
    const otpauthUrl = totpUri({ issuer: this.issuer(), label: user.email, secret })
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 })
    return { otpauthUrl, qrDataUrl, secret }
  }

  /** Confirms enrolment with a TOTP code and returns fresh recovery codes (shown once). */
  async enable(userId: string, code: string) {
    const user = await this.load(userId)
    if (user.twoFactorEnabled) {
      throw new AppException(
        "Two-factor authentication is already enabled",
        HttpStatus.CONFLICT,
        "TWO_FACTOR_ALREADY_ENABLED"
      )
    }
    const secret = decryptSecret(user.twoFactorSecret)
    if (!secret) {
      throw new AppException(
        "Start two-factor setup first",
        HttpStatus.BAD_REQUEST,
        "TWO_FACTOR_SETUP_REQUIRED"
      )
    }
    if (!(await this.verifyTotp(secret, code))) throw invalidCode()

    const recoveryCodes = this.generateRecoveryCodes()
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
      },
    })
    return { recoveryCodes }
  }

  async disable(userId: string, code: string, password?: string) {
    const user = await this.load(userId)
    this.assertEnabled(user)
    if (user.passwordHash) {
      if (!password) throw new UnauthorizedException("Password is required")
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException("Password is incorrect")
      }
    }
    if (!(await this.verifyCode(user, code))) throw invalidCode()
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] },
    })
    return { disabled: true }
  }

  async regenerateRecoveryCodes(userId: string, code: string) {
    const user = await this.load(userId)
    this.assertEnabled(user)
    if (!(await this.verifyCode(user, code))) throw invalidCode()
    const recoveryCodes = this.generateRecoveryCodes()
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode) },
    })
    return { recoveryCodes }
  }

  /**
   * Accepts a current TOTP code or an unused recovery code. A matching recovery code is consumed
   * atomically, so it works exactly once even under concurrent requests.
   */
  async verifyCode(user: TwoFactorUser, code: string): Promise<boolean> {
    const raw = (code || "").trim()
    if (!raw) return false
    if (isTotpShape(raw)) {
      const secret = decryptSecret(user.twoFactorSecret)
      return !!secret && (await this.verifyTotp(secret, raw.replace(/\s/g, "")))
    }
    const hash = hashRecoveryCode(raw)
    if (!user.twoFactorRecoveryCodes.some((stored) => digestsEqual(stored, hash))) return false
    const removed = await this.prisma.$executeRaw`
      UPDATE "User"
      SET "twoFactorRecoveryCodes" = array_remove("twoFactorRecoveryCodes", ${hash})
      WHERE "id" = ${user.id} AND ${hash} = ANY("twoFactorRecoveryCodes")`
    return removed === 1
  }

  /** ±1 step (30 s) tolerance for clock drift. */
  private async verifyTotp(secret: string, token: string): Promise<boolean> {
    return verifyTotp(secret, token.replace(/\s/g, ""))
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const chars = Array.from(
        { length: 10 },
        () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]
      ).join("")
      return `${chars.slice(0, 5)}-${chars.slice(5)}`
    })
  }

  private async load(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorRecoveryCodes: true,
      },
    })
    if (!user) throw new UnauthorizedException("Access denied")
    return user
  }

  private assertEnabled(user: { twoFactorEnabled: boolean }) {
    if (!user.twoFactorEnabled) {
      throw new AppException(
        "Two-factor authentication is not enabled",
        HttpStatus.BAD_REQUEST,
        "TWO_FACTOR_NOT_ENABLED"
      )
    }
  }
}
