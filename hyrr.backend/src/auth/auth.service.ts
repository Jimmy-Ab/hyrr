import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcrypt"
import { PrismaService } from "../prisma/prisma.service"
import { LoginDto } from "./dtos/login.dto"
import { RegisterDto } from "./dtos/register.dto"
import { jwtSecret } from "./jwt.config"

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException("Email already registered")

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(dto.name)}&background=6C63FF&color=fff`,
        role: dto.role as any,
      },
    })

    if (dto.role === "SEEKER") {
      await this.prisma.seekerProfile.create({
        data: {
          userId: user.id,
          title: "",
          location: "",
        },
      })
    } else if (dto.role === "RECRUITER") {
      const company = await this.prisma.company.create({
        data: {
          name: `${dto.name}'s Company`,
          logo: dto.name.charAt(0).toUpperCase(),
          country: "United States",
        },
      })
      await this.prisma.user.update({
        where: { id: user.id },
        data: { companyId: company.id },
      })
      user.companyId = company.id
      await (this.prisma as any).companyMember.create({
        data: { companyId: company.id, userId: user.id, role: "OWNER" },
      })
    }

    return this.generateTokens(user)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user || !user.passwordHash) throw new UnauthorizedException("Invalid credentials")

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException("Invalid credentials")

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    return this.generateTokens(user)
  }

  async refreshTokens(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.status !== "ACTIVE") throw new UnauthorizedException("Access denied")
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

  async upsertOAuthUser(profile: {
    provider: "google" | "github" | "linkedin"
    id: string
    email: string
    name: string
    avatar: string
  }) {
    const providerField = `${profile.provider}Id`
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ [providerField]: profile.id }, { email: profile.email }],
      },
    })

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar,
          [providerField]: profile.id,
          role: "SEEKER",
        },
      })
      await this.prisma.seekerProfile.create({
        data: { userId: user.id, title: "", location: "" },
      })
    } else if (!(user as any)[providerField]) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { [providerField]: profile.id },
      })
    }

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

  private generateTokens(user: {
    id: string
    role: string
    email: string
    companyId?: string | null
  }) {
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
