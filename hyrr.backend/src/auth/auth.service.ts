import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { CompanyMemberRole, Prisma, User, UserRole, UserStatus } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { LoginDto } from "./dtos/login.dto"
import { RegisterDto } from "./dtos/register.dto"
import { jwtSecret } from "./jwt.config"

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
}

export type OAuthResult = AuthTokens | { error: "email_unverified" | "account_inactive" }

type Tx = Prisma.TransactionClient

const avatarFor = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6C63FF&color=fff`

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim()
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictException("Email already registered")

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.$transaction((tx) =>
      this.createAccount(tx, {
        name: dto.name,
        email,
        passwordHash,
        avatar: avatarFor(dto.name),
        role: dto.role,
      })
    )
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
        ...(data.providerField && data.providerId ? { [data.providerField]: data.providerId } : {}),
      },
    })

    if (role === UserRole.SEEKER) {
      await tx.seekerProfile.create({ data: { userId: user.id, title: "", location: "" } })
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
    }
    return user
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim() },
    })
    if (!user || !user.passwordHash) throw new UnauthorizedException("Invalid credentials")

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException("Invalid credentials")
    this.assertActive(user)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    return this.generateTokens(user)
  }

  private assertActive(user: { status: UserStatus }) {
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        "This account is not active. Please contact support.",
        HttpStatus.FORBIDDEN,
        "ACCOUNT_INACTIVE"
      )
    }
  }

  async refreshTokens(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException("Access denied")
    return this.generateTokens(user)
  }

  async verifyRefreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; type?: string }>(token, {
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

    if (!user) {
      const email = profile.email?.trim()
      if (!email || !profile.emailVerified) return { error: "email_unverified" }

      user = await this.prisma.user.findUnique({ where: { email } })
      if (user) {
        if (user.status !== UserStatus.ACTIVE) return { error: "account_inactive" }
        if (!user[providerField]) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { [providerField]: providerId },
          })
        }
      } else {
        const name = profile.name?.trim() || email.split("@")[0]
        user = await this.prisma.$transaction((tx) =>
          this.createAccount(tx, {
            name,
            email,
            avatar: profile.avatar || avatarFor(name),
            role: role === "RECRUITER" ? "RECRUITER" : "SEEKER",
            providerField,
            providerId,
          })
        )
      }
    }

    if (user.status !== UserStatus.ACTIVE) return { error: "account_inactive" }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    return this.generateTokens(user)
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
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
      },
    })
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Cannot change password for OAuth accounts")
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new UnauthorizedException("Current password is incorrect")

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    return { message: "Password changed successfully" }
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

  private generateTokens(user: {
    id: string
    role: string
    email: string
    companyId?: string | null
  }): AuthTokens {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      companyId: user.companyId || null,
    }
    const accessToken = this.jwtService.sign(payload, { expiresIn: "15m" })
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: "refresh" },
      { expiresIn: "7d" }
    )
    return { accessToken, refreshToken, userId: user.id, role: user.role }
  }
}
