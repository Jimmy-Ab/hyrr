import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { AuthTokenType, UserStatus } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { EmailService } from "../core/delivery/email.service"
import * as templates from "../core/delivery/templates"
import { AppException } from "../core/exceptions/app-exception"
import { CaptchaService } from "../core/security/captcha.service"
import { CompanyVerificationService } from "../core/verification/company-verification.service"
import { PrismaService } from "../prisma/prisma.service"
import { newRawToken, sha256 } from "./one-time-token"

export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000
export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000
export const RESEND_COOLDOWN_MS = 60 * 1000

type Recipient = { id: string; email: string; name: string; role: string }

const tokenInvalid = () =>
  new AppException(
    "This link is invalid or was already used",
    HttpStatus.BAD_REQUEST,
    "TOKEN_INVALID"
  )

/** E-mail verification and password reset flows (one-time tokens, stored as sha256 hashes). */
@Injectable()
export class AccountEmailService {
  private readonly logger = new Logger(AccountEmailService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly captcha: CaptchaService,
    private readonly companyVerification: CompanyVerificationService
  ) {}

  // ─── E-mail verification ──────────────────────────────────────────
  async sendVerification(user: Recipient): Promise<void> {
    const raw = await this.issueToken(user.id, AuthTokenType.VERIFY_EMAIL, VERIFY_EMAIL_TTL_MS)
    const url = templates.appUrl(user.role, `/verify-email?token=${encodeURIComponent(raw)}`)
    await this.email.send({ to: user.email, ...templates.verifyEmail({ name: user.name, url }) })
  }

  /** Re-sends the verification e-mail (max one per minute). */
  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, emailVerifiedAt: true },
    })
    if (!user) throw new AppException("Access denied", HttpStatus.UNAUTHORIZED, "UNAUTHORIZED")
    if (user.emailVerifiedAt) return { sent: false, alreadyVerified: true }

    const recent = await this.prisma.authToken.findFirst({
      where: {
        userId,
        type: AuthTokenType.VERIFY_EMAIL,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
      },
      select: { id: true },
    })
    if (recent) {
      throw new AppException(
        "Please wait a minute before requesting another e-mail",
        HttpStatus.TOO_MANY_REQUESTS,
        "TOO_MANY_REQUESTS"
      )
    }
    await this.sendVerification(user)
    return { sent: true }
  }

  async verifyEmail(raw: string) {
    const token = await this.consume(raw, AuthTokenType.VERIFY_EMAIL)
    await this.prisma.user.updateMany({
      where: { id: token.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    })
    await this.refreshCompanyVerification(token.userId)
    return { verified: true }
  }

  // ─── Password reset ───────────────────────────────────────────────
  /** Always resolves `{ ok: true }` so the response never reveals whether an account exists. */
  async forgotPassword(email: string, captchaToken?: string, ip?: string) {
    await this.captcha.verify(captchaToken, ip)
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim() },
      select: { id: true, email: true, name: true, role: true, status: true },
    })
    if (user && user.status === UserStatus.ACTIVE) {
      // Delivery runs in the background so response timing doesn't depend on the account existing.
      void this.sendReset(user).catch((error) =>
        this.logger.warn(`Password reset e-mail failed: ${(error as Error)?.message}`)
      )
    }
    return { ok: true }
  }

  private async sendReset(user: Recipient) {
    const raw = await this.issueToken(
      user.id,
      AuthTokenType.RESET_PASSWORD,
      RESET_PASSWORD_TTL_MS,
      {
        invalidatePrevious: true,
      }
    )
    const url = templates.appUrl(user.role, `/reset-password?token=${encodeURIComponent(raw)}`)
    await this.email.send({ to: user.email, ...templates.resetPassword({ name: user.name, url }) })
  }

  /** Sets a new password, revokes every session (tokenVersion++) and consumes the token. */
  async resetPassword(raw: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12)
    const token = await this.consume(raw, AuthTokenType.RESET_PASSWORD)
    const user = await this.prisma.$transaction(async (tx) => {
      // Any other outstanding reset links die with this one.
      await tx.authToken.updateMany({
        where: { userId: token.userId, type: AuthTokenType.RESET_PASSWORD, usedAt: null },
        data: { usedAt: new Date() },
      })
      const current = await tx.user.findUnique({
        where: { id: token.userId },
        select: { emailVerifiedAt: true },
      })
      return tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          // Following the link proves control of the mailbox.
          ...(current && !current.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}),
        },
        select: { id: true, email: true, name: true, role: true },
      })
    })
    await this.notifyPasswordChanged(user)
    return { ok: true }
  }

  async notifyPasswordChanged(user: { email: string; name: string }) {
    await this.email
      .send({ to: user.email, ...templates.passwordChanged({ name: user.name }) })
      .catch(() => undefined)
  }

  async refreshCompanyVerification(userId: string) {
    try {
      await this.companyVerification.refreshForUser(userId)
    } catch (error) {
      this.logger.warn(`Company verification refresh failed: ${(error as Error)?.message}`)
    }
  }

  // ─── Tokens ───────────────────────────────────────────────────────
  private async issueToken(
    userId: string,
    type: AuthTokenType,
    ttlMs: number,
    options: { invalidatePrevious?: boolean } = {}
  ): Promise<string> {
    const raw = newRawToken()
    const now = new Date()
    if (options.invalidatePrevious) {
      await this.prisma.authToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: now },
      })
    }
    await this.prisma.authToken.create({
      data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(now.getTime() + ttlMs) },
    })
    return raw
  }

  /**
   * Looks the token up by its sha256 hash (the raw value is never stored or compared directly) and
   * marks it used atomically, so a link works exactly once.
   */
  private async consume(raw: string, type: AuthTokenType) {
    if (!raw || typeof raw !== "string") throw tokenInvalid()
    const token = await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(raw) } })
    if (!token || token.type !== type || token.usedAt) throw tokenInvalid()
    if (token.expiresAt.getTime() <= Date.now()) {
      throw new AppException("This link has expired", HttpStatus.BAD_REQUEST, "TOKEN_EXPIRED")
    }
    const { count } = await this.prisma.authToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (count !== 1) throw tokenInvalid()
    return token
  }
}
