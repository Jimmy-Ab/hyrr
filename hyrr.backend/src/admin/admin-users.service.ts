import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { AuthTokenType, Prisma, UserRole, UserStatus } from "@prisma/client"
import { RESET_PASSWORD_TTL_MS } from "../auth/account-email.service"
import { newRawToken, sha256 } from "../auth/one-time-token"
import { EmailService } from "../core/delivery/email.service"
import * as templates from "../core/delivery/templates"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { computeProfileStrength } from "../matching/scoring"
import { PrismaService } from "../prisma/prisma.service"
import type { AdminCtx } from "./admin-moderation.service"
import { AuditService } from "./audit.service"
import { pageArgs, pageOf } from "./pagination"

const DAY_MS = 24 * 60 * 60 * 1000

const USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  twoFactorEnabled: true,
  joinedAt: true,
  lastActiveAt: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_LIST_SELECT }>

const toListItem = ({ emailVerifiedAt, company, ...u }: UserRow) => ({
  ...u,
  emailVerified: !!emailVerifiedAt,
  company: company ?? null,
})

export type UserFilters = { q?: string; role?: UserRole; status?: UserStatus }

/** Admin user management: search, detail, suspend/reactivate, verify e-mail, password reset. */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService
  ) {}

  async list(filters: UserFilters, cursor?: string, limit?: number) {
    const where: Prisma.UserWhereInput = {}
    if (filters.role) where.role = filters.role
    if (filters.status) where.status = filters.status
    if (filters.q)
      where.OR = [
        { name: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
      ]
    const rows = await this.prisma.user.findMany({
      where,
      select: USER_LIST_SELECT,
      orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
      ...pageArgs(cursor, limit),
    })
    const page = pageOf(rows, limit)
    return { items: page.items.map(toListItem), nextCursor: page.nextCursor }
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_LIST_SELECT })
    if (!user) throw new NotFoundAppException("User not found", "USER_NOT_FOUND")
    const since = new Date(Date.now() - 30 * DAY_MS)
    const [profile, wallet, applications, jobsPosted, messages30d, audit] = await Promise.all([
      this.prisma.seekerProfile.findUnique({
        where: { userId: id },
        include: {
          interests: { select: { id: true } },
          experiences: { select: { role: true } },
          educations: { select: { id: true } },
        },
      }),
      this.prisma.creditWallet.findUnique({ where: { userId: id }, select: { balance: true } }),
      this.prisma.application.count({ where: { userId: id, status: { not: "SAVED" } } }),
      this.prisma.job.count({ where: { recruiterId: id } }),
      this.prisma.message.count({ where: { senderId: id, createdAt: { gte: since } } }),
      this.audit.forTarget(`user:${id}`, 10),
    ])
    return {
      ...toListItem(user),
      seeker: profile
        ? {
            title: profile.title,
            location: profile.location,
            applications,
            profileStrength: computeProfileStrength(profile).profileStrength,
          }
        : null,
      wallet: wallet ? { balance: wallet.balance } : null,
      recent: { applications, jobsPosted, messages30d },
      audit,
    }
  }

  private async load(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    })
    if (!user) throw new NotFoundAppException("User not found", "USER_NOT_FOUND")
    return user
  }

  /** SUSPENDED + tokenVersion+1 (signs the user out everywhere). */
  async suspend(id: string, reason: string, ctx: AdminCtx) {
    if (id === ctx.actorId)
      throw new AppException(
        "You can't suspend your own account",
        HttpStatus.BAD_REQUEST,
        "CANNOT_SUSPEND_SELF"
      )
    const user = await this.load(id)
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.SUSPENDED, tokenVersion: { increment: 1 } },
      })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "user.suspend",
          target: `user:${id}`,
          details: `Suspended ${user.email}`,
          reason,
          meta: { before: { status: user.status }, after: { status: UserStatus.SUSPENDED } },
          ip: ctx.ip,
          severity: "critical",
        },
        tx
      )
    })
    return { id, status: UserStatus.SUSPENDED }
  }

  async reactivate(id: string, ctx: AdminCtx) {
    const user = await this.load(id)
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: UserStatus.ACTIVE } })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "user.reactivate",
          target: `user:${id}`,
          details: `Reactivated ${user.email}`,
          meta: { before: { status: user.status }, after: { status: UserStatus.ACTIVE } },
          ip: ctx.ip,
          severity: "info",
        },
        tx
      )
    })
    return { id, status: UserStatus.ACTIVE }
  }

  async verifyEmail(id: string, ctx: AdminCtx) {
    const user = await this.load(id)
    const emailVerifiedAt = user.emailVerifiedAt ?? new Date()
    await this.prisma.$transaction(async (tx) => {
      if (!user.emailVerifiedAt) await tx.user.update({ where: { id }, data: { emailVerifiedAt } })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "user.verify_email",
          target: `user:${id}`,
          details: `Marked ${user.email} as verified`,
          meta: { alreadyVerified: !!user.emailVerifiedAt },
          ip: ctx.ip,
          severity: "info",
        },
        tx
      )
    })
    return { id, emailVerified: true, emailVerifiedAt }
  }

  /** Same mechanism as forgot-password: one-time RESET_PASSWORD token (1 h) e-mailed to the user. */
  async resetPassword(id: string, ctx: AdminCtx) {
    const user = await this.load(id)
    const raw = newRawToken()
    const now = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.authToken.updateMany({
        where: { userId: id, type: AuthTokenType.RESET_PASSWORD, usedAt: null },
        data: { usedAt: now },
      })
      await tx.authToken.create({
        data: {
          userId: id,
          type: AuthTokenType.RESET_PASSWORD,
          tokenHash: sha256(raw),
          expiresAt: new Date(now.getTime() + RESET_PASSWORD_TTL_MS),
        },
      })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "user.reset_password",
          target: `user:${id}`,
          details: `Sent a password-reset e-mail to ${user.email}`,
          ip: ctx.ip,
          severity: "info",
        },
        tx
      )
    })
    const url = templates.appUrl(user.role, `/reset-password?token=${encodeURIComponent(raw)}`)
    await this.email
      .send({ to: user.email, ...templates.resetPassword({ name: user.name, url }) })
      .catch((err: any) => this.logger.warn(`Password reset e-mail failed: ${err?.message}`))
    return { id, sent: true, emailConfigured: this.email.isEnabled() }
  }
}
