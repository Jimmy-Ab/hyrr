import {
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { CompanyMemberRole, Prisma, User, UserRole, UserStatus } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { PricingService } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { supportEmail, suspendedMessage } from "../core/config/support"
import { AppException } from "../core/exceptions/app-exception"
import { CaptchaService } from "../core/security/captcha.service"
import { PrismaService } from "../prisma/prisma.service"
import { AccountEmailService } from "./account-email.service"
import { LoginDto } from "./dtos/login.dto"
import { RegisterDto } from "./dtos/register.dto"
import { jwtSecret, tokenVersionMatches } from "./jwt.config"
import { LoginAttemptsService } from "./login-attempts.service"
import { TwoFactorService } from "./two-factor.service"

/** Failed logins (per e-mail or IP, 15-min window) after which a captcha is required. */
export const CAPTCHA_AFTER_FAILURES = 3
/** Wrong 2FA codes per user (15-min window) before further attempts are refused. */
export const MFA_MAX_FAILURES = 10

export type SignupRole = "SEEKER" | "RECRUITER"

export type OAuthProfile = {
  provider: "google" | "github" | "linkedin"
  id: string
  /** Only set when the provider asserts the address is verified. */
  email: string | null
  emailVerified: boolean
  name: string
  avatar: string
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  userId: string
  role: string
  emailVerified: boolean
  twoFactorEnabled: boolean
}

export type MfaChallenge = { mfaRequired: true; mfaToken: string }

export type OAuthResult = AuthTokens | { error: "email_unverified" | "account_inactive" }

/** Fields generateTokens needs (a full Prisma User satisfies it). */
type TokenUser = {
  id: string
  role: string
  email: string
  companyId?: string | null
  tokenVersion?: number
  emailVerifiedAt?: Date | null
  twoFactorEnabled?: boolean
}

type Tx = Prisma.TransactionClient

let cachedDummyHash: string | undefined
const dummyHash = () => (cachedDummyHash ??= bcrypt.hashSync("hyrr-no-such-account", 12))

const avatarFor = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6C63FF&color=fff`

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private captcha: CaptchaService,
    private attempts: LoginAttemptsService,
    private twoFactor: TwoFactorService,
    private accountEmail: AccountEmailService,
    private wallet: WalletService,
    private pricing: PricingService
  ) {}

  /** Momentum credits a new recruiter company starts with (read before the signup transaction). */
  private async signupBonusFor(role: SignupRole): Promise<number> {
    const config = await this.pricing.getConfig()
    return role === "RECRUITER" ? config.signupBonus : config.seekerSignupBonus
  }

  async register(dto: RegisterDto, ip?: string) {
    await this.captcha.verify(dto.captchaToken, ip)
    const email = dto.email.trim()
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictException("Email already registered")

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const signupBonus = await this.signupBonusFor(dto.role)
    const user = await this.prisma.$transaction((tx) =>
      this.createAccount(tx, {
        name: dto.name,
        email,
        passwordHash,
        avatar: avatarFor(dto.name),
        role: dto.role,
        signupBonus,
      })
    )
    void this.accountEmail
      .sendVerification(user)
      .catch((error) => this.logger.warn(`Verification e-mail failed: ${error?.message}`))
    return this.generateTokens(user)
  }

  /** Creates a user plus the role-specific records (seeker profile, or company + OWNER membership). */
  private async createAccount(
    tx: Tx,
    data: {
      name: string
      email: string
      avatar: string
      role: SignupRole
      passwordHash?: string
      providerField?: "googleId" | "githubId" | "linkedinId"
      providerId?: string
      emailVerifiedAt?: Date
      /** SIGNUP_BONUS credited to the new recruiter company's or seeker's wallet. */
      signupBonus?: number
    }
  ): Promise<User> {
    const role = data.role === "RECRUITER" ? UserRole.RECRUITER : UserRole.SEEKER
    let user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        avatar: data.avatar,
        role,
        ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
        ...(data.emailVerifiedAt ? { emailVerifiedAt: data.emailVerifiedAt } : {}),
        ...(data.providerField && data.providerId ? { [data.providerField]: data.providerId } : {}),
      },
    })

    if (role === UserRole.SEEKER) {
      await tx.seekerProfile.create({ data: { userId: user.id, title: "", location: "" } })
      await this.wallet.ensureOwnerWallet({ userId: user.id }, tx)
      if (data.signupBonus && data.signupBonus > 0)
        await this.wallet.credit(
          {
            userId: user.id,
            amount: data.signupBonus,
            type: "SIGNUP_BONUS",
            referenceId: user.id,
            actorId: user.id,
            note: "Welcome bonus",
          },
          tx
        )
    } else {
      const company = await tx.company.create({
        data: {
          name: `${data.name}'s Company`,
          logo: data.name.charAt(0).toUpperCase() || "C",
          country: "United States",
        },
      })
      user = await tx.user.update({ where: { id: user.id }, data: { companyId: company.id } })
      await tx.companyMember.create({
        data: { companyId: company.id, userId: user.id, role: CompanyMemberRole.OWNER },
      })
      await this.wallet.ensureWallet(company.id, tx)
      if (data.signupBonus && data.signupBonus > 0)
        await this.wallet.credit(
          {
            companyId: company.id,
            amount: data.signupBonus,
            type: "SIGNUP_BONUS",
            referenceId: company.id,
            actorId: user.id,
            note: "Welcome bonus",
          },
          tx
        )
    }
    return user
  }

  /**
   * Password login. After CAPTCHA_AFTER_FAILURES failures for the e-mail or IP a captcha is required
   * (only when captcha is enabled). Users with 2FA get an MFA challenge instead of tokens.
   */
  async login(dto: LoginDto, ip?: string): Promise<AuthTokens | MfaChallenge> {
    const email = dto.email.trim()
    const captchaOn = this.captcha.isEnabled()
    const keys = this.attempts.loginKeys(email, ip)
    if (captchaOn && (await this.attempts.count(keys)) >= CAPTCHA_AFTER_FAILURES) {
      await this.captcha.verify(dto.captchaToken, ip)
    }

    const user = await this.prisma.user.findUnique({ where: { email } })
    // Always run bcrypt so response time doesn't reveal whether the account exists.
    const valid = await bcrypt.compare(dto.password, user?.passwordHash || dummyHash())
    if (!user || !user.passwordHash || !valid) {
      if (captchaOn) await this.attempts.fail(keys)
      throw new UnauthorizedException("Invalid credentials")
    }
    this.assertActive(user)
    if (captchaOn) await this.attempts.reset(keys)

    if (user.twoFactorEnabled) {
      const mfaToken = this.jwtService.sign(
        { sub: user.id, type: "mfa", tv: user.tokenVersion ?? 0 },
        { expiresIn: "5m" }
      )
      return { mfaRequired: true, mfaToken }
    }

    const now = new Date()
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now, lastActiveAt: now },
    })

    return this.generateTokens(user)
  }

  /** Second login step: exchanges an MFA token + TOTP/recovery code for normal tokens. */
  async verifyMfaLogin(mfaToken: string, code: string): Promise<AuthTokens> {
    let payload: { sub?: string; type?: string; tv?: number }
    try {
      payload = await this.jwtService.verifyAsync(mfaToken, { secret: jwtSecret() })
    } catch {
      payload = {}
    }
    if (payload.type !== "mfa" || !payload.sub) throw this.mfaTokenInvalid()

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.twoFactorEnabled || !tokenVersionMatches(payload, user.tokenVersion ?? 0)) {
      throw this.mfaTokenInvalid()
    }
    this.assertActive(user)

    const keys = [`auth:fail:mfa:${user.id}`]
    if ((await this.attempts.count(keys)) >= MFA_MAX_FAILURES) {
      throw new AppException(
        "Too many invalid codes. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
        "TOO_MANY_REQUESTS"
      )
    }
    if (!(await this.twoFactor.verifyCode(user, code))) {
      await this.attempts.fail(keys)
      throw new AppException(
        "The verification code is not valid",
        HttpStatus.UNAUTHORIZED,
        "TWO_FACTOR_INVALID_CODE"
      )
    }
    await this.attempts.reset(keys)
    const now = new Date()
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now, lastActiveAt: now },
    })
    return this.generateTokens(user)
  }

  private mfaTokenInvalid() {
    return new AppException(
      "Your sign-in session expired. Please sign in again.",
      HttpStatus.UNAUTHORIZED,
      "MFA_SESSION_EXPIRED"
    )
  }

  private assertActive(user: { status: UserStatus }) {
    if (user.status === UserStatus.SUSPENDED)
      throw new AppException(suspendedMessage(), HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED", {
        supportEmail: supportEmail(),
      })
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        "This account is not active. Please contact support.",
        HttpStatus.FORBIDDEN,
        "ACCOUNT_INACTIVE"
      )
    }
  }

  /** `tokenVersion` is the refresh token's `tv`; a mismatch means the session was revoked. */
  async refreshTokens(userId: string, tokenVersion?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user?.status === UserStatus.SUSPENDED) this.assertActive(user) // 403 ACCOUNT_SUSPENDED
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException("Access denied")
    if (!tokenVersionMatches({ tv: tokenVersion }, user.tokenVersion ?? 0)) {
      throw new UnauthorizedException("Session has been revoked")
    }
    return this.generateTokens(user)
  }

  async verifyRefreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string
        type?: string
        tv?: number
      }>(token, {
        secret: jwtSecret(),
      })
      if (payload.type !== "refresh" || !payload.sub)
        throw new UnauthorizedException("Invalid refresh token")
      return payload
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException("Invalid refresh token")
    }
  }

  /**
   * Signs a user in through an OAuth provider.
   * - An existing provider link always wins.
   * - Otherwise we only link/create by e-mail when the provider verified that address.
   * - `role` is honoured only when a brand-new account is created.
   */
  async upsertOAuthUser(profile: OAuthProfile, role: SignupRole = "SEEKER"): Promise<OAuthResult> {
    const providerField = `${profile.provider}Id` as "googleId" | "githubId" | "linkedinId"
    const providerId = String(profile.id)

    let user = await this.prisma.user.findFirst({ where: { [providerField]: providerId } })
    const verifiedEmail = profile.emailVerified ? profile.email?.trim().toLowerCase() : undefined

    if (!user) {
      const email = profile.email?.trim()
      if (!email || !profile.emailVerified) return { error: "email_unverified" }

      user = await this.prisma.user.findUnique({ where: { email } })
      if (user) {
        if (user.status !== UserStatus.ACTIVE) return { error: "account_inactive" }
        if (!user[providerField] || !user.emailVerifiedAt) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              [providerField]: providerId,
              // The provider just vouched for this address.
              ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
            },
          })
        }
      } else {
        const name = profile.name?.trim() || email.split("@")[0]
        const signupRole: SignupRole = role === "RECRUITER" ? "RECRUITER" : "SEEKER"
        const signupBonus = await this.signupBonusFor(signupRole)
        user = await this.prisma.$transaction((tx) =>
          this.createAccount(tx, {
            name,
            email,
            avatar: profile.avatar || avatarFor(name),
            role: signupRole,
            providerField,
            providerId,
            emailVerifiedAt: new Date(),
            signupBonus,
          })
        )
      }
    }

    if (user.status !== UserStatus.ACTIVE) return { error: "account_inactive" }
    const markVerified =
      !user.emailVerifiedAt && !!verifiedEmail && verifiedEmail === user.email.toLowerCase()
    user = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        lastActiveAt: new Date(),
        ...(markVerified ? { emailVerifiedAt: new Date() } : {}),
      },
    })
    await this.accountEmail.refreshCompanyVerification(user.id)
    return this.generateTokens(user)
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        joinedAt: true,
        companyId: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
        passwordHash: true,
        company: { select: { id: true, name: true, status: true, verified: true } },
      },
    })
    if (!user) return null
    const { emailVerifiedAt, passwordHash, ...rest } = user
    return {
      ...rest,
      supportEmail: supportEmail(),
      emailVerified: !!emailVerifiedAt,
      // Lets the UI know whether password confirmation applies (OAuth-only accounts have none).
      hasPassword: !!passwordHash,
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Cannot change password for OAuth accounts")
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new UnauthorizedException("Current password is incorrect")

    const passwordHash = await bcrypt.hash(newPassword, 12)
    // Bumping tokenVersion signs out every other session; this one continues with fresh tokens.
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    })
    await this.accountEmail.notifyPasswordChanged(updated)
    return this.generateTokens(updated)
  }

  /**
   * C11: permanently deletes the account and the data it owns.
   * Sole owners of a company that still has other members must transfer ownership first.
   */
  async deleteAccount(userId: string, password?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException("User not found")
    if (user.passwordHash) {
      if (!password) throw new UnauthorizedException("Password is required to delete this account")
      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) throw new UnauthorizedException("Password is incorrect")
    }

    await this.prisma.$transaction(async (tx) => {
      const memberships = await tx.companyMember.findMany({ where: { userId } })
      const companyIds = new Set(memberships.map((m) => m.companyId))
      if (user.companyId) companyIds.add(user.companyId)

      for (const companyId of companyIds) {
        const others = await tx.companyMember.findMany({
          where: { companyId, userId: { not: userId } },
          orderBy: { createdAt: "asc" },
        })
        const isOwner = memberships.some(
          (m) => m.companyId === companyId && m.role === CompanyMemberRole.OWNER
        )
        const otherOwner = others.find((m) => m.role === CompanyMemberRole.OWNER)

        if (others.length === 0) {
          // Nobody else uses this company: remove it and everything hanging off it.
          if (isOwner || memberships.length === 0) {
            await tx.candidateLabel.deleteMany({ where: { companyId } })
            await tx.subscription.deleteMany({ where: { companyId } })
            await tx.company.delete({ where: { id: companyId } })
          }
          continue
        }
        if (isOwner && !otherOwner) {
          throw new AppException(
            "Transfer company ownership to another member before deleting your account",
            HttpStatus.CONFLICT,
            "TRANSFER_OWNERSHIP_FIRST"
          )
        }
        // Keep the company's jobs alive by handing them to another member.
        const heir = otherOwner || others[0]
        await tx.job.updateMany({
          where: { companyId, recruiterId: userId },
          data: { recruiterId: heir.userId },
        })
      }

      // Jobs posted in companies the user no longer belongs to would block the delete.
      const strayJobs = await tx.job.count({ where: { recruiterId: userId } })
      if (strayJobs > 0) await tx.job.deleteMany({ where: { recruiterId: userId } })

      if (user.role === UserRole.SEEKER) {
        await tx.application.deleteMany({ where: { userId } })
      }
      await tx.jobReport.deleteMany({ where: { reporterId: userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    return { deleted: true }
  }

  private generateTokens(user: TokenUser): AuthTokens {
    const tv = user.tokenVersion ?? 0
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      companyId: user.companyId || null,
      tv,
    }
    const accessToken = this.jwtService.sign(payload, { expiresIn: "15m" })
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: "refresh", tv },
      { expiresIn: "7d" }
    )
    return {
      accessToken,
      refreshToken,
      userId: user.id,
      role: user.role,
      emailVerified: !!user.emailVerifiedAt,
      twoFactorEnabled: !!user.twoFactorEnabled,
    }
  }
}
