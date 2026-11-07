import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import {
  CompanyInvite,
  CompanyMemberRole,
  CompanyStatus,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client"
import { newRawToken, sha256 } from "../auth/one-time-token"
import { PricingService } from "../billing/pricing.service"
import { assertSeatAvailable, openInviteWhere } from "../billing/seats"
import { WalletService } from "../billing/wallet.service"
import { resolveCompanyMembership } from "../core/access/company-membership"
import { EmailService } from "../core/delivery/email.service"
import * as templates from "../core/delivery/templates"
import { AppException } from "../core/exceptions/app-exception"
import {
  CompanyVerificationService,
  isFreeMailDomain,
  registrableDomain,
} from "../core/verification/company-verification.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import type { AssignableRole } from "./dtos/team.dto"

type Tx = Prisma.TransactionClient
type TeamActor = { userId: string; role: string; companyId?: string | null }

export const INVITE_TTL_DAYS = 7
const ASSIGNABLE: string[] = ["RECRUITER", "HIRING_MANAGER", "VIEWER"]

export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  VIEWER: "Viewer",
}

const fail = (message: string, status: HttpStatus, code: string, details?: Record<string, any>) =>
  new AppException(message, status, code, details)

/** "dalasa@acme.com" → "d•••••@acme.com" (invite previews never reveal the full address). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return "•••"
  return `${local.charAt(0)}${"•".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`
}

const sameEmail = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Company and team onboarding: company setup, e-mail invites with an accept link, join requests
 * by verified domain, ownership transfer and leaving a team.
 */
@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService,
    private readonly email: EmailService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly verification?: CompanyVerificationService
  ) {}

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async requireOwner(actor: TeamActor) {
    const member = await resolveCompanyMembership(this.prisma, actor)
    if (member.role !== CompanyMemberRole.OWNER)
      throw fail("Only the company owner can manage the team", HttpStatus.FORBIDDEN, "OWNER_ONLY")
    return member.companyId
  }

  private requireRecruiter(actor: TeamActor) {
    if (actor.role !== UserRole.RECRUITER)
      throw fail(
        "Team invites need a recruiter account. Sign up as a recruiter with this e-mail to join.",
        HttpStatus.FORBIDDEN,
        "INVITE_NEEDS_RECRUITER"
      )
  }

  private async notify(userIds: (string | null | undefined)[], title: string) {
    for (const id of new Set(userIds.filter(Boolean) as string[])) {
      try {
        await this.notifications?.createNotification(id, title, NotificationType.SYSTEM)
      } catch (err: any) {
        this.logger.warn(`Team notification failed for ${id}: ${err?.message}`)
      }
    }
  }

  private async ownerIds(companyId: string) {
    const owners = await this.prisma.companyMember.findMany({
      where: { companyId, role: CompanyMemberRole.OWNER },
      select: { userId: true },
    })
    return owners.map((o) => o.userId)
  }

  /** User-initiated team changes go to the audit log for traceability. */
  private async log(
    actorId: string,
    action: string,
    companyId: string,
    details: string,
    meta?: Record<string, any>,
    tx?: Tx
  ) {
    try {
      await (tx ?? this.prisma).auditLog.create({
        data: {
          userId: actorId,
          action,
          target: `company:${companyId}`,
          details,
          meta: meta ?? undefined,
          ip: "",
          severity: "info",
        },
      })
    } catch (err: any) {
      if (tx) throw err
      this.logger.warn(`Audit entry failed (${action}): ${err?.message}`)
    }
  }

  /**
   * Checks that a recruiter can move into `companyId`: every company they belong to now must be an
   * empty placeholder (they are its only member and it has no jobs). Returns those company ids.
   */
  async assertCanMove(db: Tx | PrismaService, userId: string, companyId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { companyId: true, companyMemberships: { select: { companyId: true } } },
    })
    const previous = Array.from(
      new Set([
        ...(user?.companyMemberships ?? []).map((m) => m.companyId),
        ...(user?.companyId ? [user.companyId] : []),
      ])
    )
    if (previous.includes(companyId))
      throw fail("You're already on this team", HttpStatus.CONFLICT, "ALREADY_MEMBER")
    for (const previousId of previous) {
      const [otherMembers, jobs, company] = await Promise.all([
        db.companyMember.count({ where: { companyId: previousId, userId: { not: userId } } }),
        db.job.count({ where: { companyId: previousId } }),
        db.company.findUnique({ where: { id: previousId }, select: { name: true } }),
      ])
      if (otherMembers > 0 || jobs > 0)
        throw fail(
          `You're part of ${company?.name ?? "another company"}. Leave it (or transfer ownership) before joining a new team.`,
          HttpStatus.CONFLICT,
          "LEAVE_CURRENT_COMPANY",
          { company: company?.name }
        )
    }
    return previous
  }

  /** Moves a recruiter into a company; their empty placeholder company (if any) is removed. */
  async moveIntoCompany(tx: Tx, userId: string, companyId: string, role: CompanyMemberRole) {
    const previous = await this.assertCanMove(tx, userId, companyId)
    for (const previousId of previous) {
      await tx.companyMember.deleteMany({ where: { companyId: previousId } })
      await tx.candidateLabel.deleteMany({ where: { companyId: previousId } })
      await tx.subscription.deleteMany({ where: { companyId: previousId } })
      await tx.user.updateMany({ where: { companyId: previousId }, data: { companyId: null } })
      await tx.company.deleteMany({ where: { id: previousId } })
    }
    await tx.companyMember.create({ data: { companyId, userId, role } })
    await tx.user.update({ where: { id: userId }, data: { companyId } })
    // Someone who joins a team no longer needs their pending join requests.
    await tx.companyJoinRequest.updateMany({
      where: { userId, status: "PENDING" },
      data: { status: "CANCELED", decidedAt: new Date() },
    })
  }

  /** Creates a company with the user as OWNER (sign-up and "Set up your company"). */
  async createCompanyFor(
    tx: Tx,
    user: { id: string; name: string },
    company: { name: string; website?: string | null },
    signupBonus: number
  ) {
    const name = company.name.trim()
    const created = await tx.company.create({
      data: {
        name,
        logo: name.charAt(0).toUpperCase() || "C",
        country: "",
        website: company.website || null,
      },
    })
    await tx.user.update({ where: { id: user.id }, data: { companyId: created.id } })
    await tx.companyMember.create({
      data: { companyId: created.id, userId: user.id, role: CompanyMemberRole.OWNER },
    })
    await this.wallet.ensureWallet(created.id, tx)
    if (signupBonus > 0)
      await this.wallet.credit(
        {
          companyId: created.id,
          amount: signupBonus,
          type: "SIGNUP_BONUS",
          referenceId: created.id,
          actorId: user.id,
          note: "Welcome bonus",
        },
        tx
      )
    return created
  }

  // ─── company setup (recruiters without a company) ──────────────────────────

  /** OAuth sign-ups and people who left a team land here once. One welcome bonus per person. */
  async setupCompany(actor: TeamActor, data: { name: string; website?: string | null }) {
    if (actor.role !== UserRole.RECRUITER)
      throw fail("Only recruiters can create a company", HttpStatus.FORBIDDEN, "RECRUITER_ONLY")
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, name: true, companyId: true },
    })
    if (!user) throw fail("Account not found", HttpStatus.NOT_FOUND, "USER_NOT_FOUND")
    if (user.companyId)
      throw fail("You already belong to a company", HttpStatus.CONFLICT, "ALREADY_IN_COMPANY")

    const hadBonus = await this.prisma.creditTransaction.count({
      where: { actorId: user.id, type: "SIGNUP_BONUS" },
    })
    const bonus = hadBonus ? 0 : (await this.pricing.getConfig()).signupBonus
    const company = await this.prisma.$transaction(async (tx) => {
      const created = await this.createCompanyFor(tx, user, data, bonus)
      await tx.companyJoinRequest.updateMany({
        where: { userId: user.id, status: "PENDING" },
        data: { status: "CANCELED", decidedAt: new Date() },
      })
      return created
    })
    if (company.website) await this.verification?.refreshForCompany(company.id)
    return { id: company.id, name: company.name, website: company.website }
  }

  // ─── invites ────────────────────────────────────────────────────────────────

  private presentInvite(invite: CompanyInvite & { invitedBy?: { name: string } | null }) {
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      expired: invite.expiresAt.getTime() <= Date.now(),
      invitedBy: invite.invitedBy?.name ?? null,
    }
  }

  private async sendInvite(invite: CompanyInvite, rawToken: string, inviterId: string) {
    const [company, inviter] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: invite.companyId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: inviterId }, select: { name: true } }),
    ])
    const url = templates.appUrl("RECRUITER", `/invite?token=${encodeURIComponent(rawToken)}`)
    try {
      await this.email.send({
        to: invite.email,
        ...templates.teamInvite({
          inviterName: inviter?.name,
          companyName: company?.name ?? "your team",
          role: ROLE_LABEL[invite.role] ?? invite.role,
          url,
        }),
      })
    } catch (err: any) {
      this.logger.warn(`Invite e-mail failed for invite ${invite.id}: ${err?.message}`)
    }
  }

  async listInvites(actor: TeamActor) {
    const companyId = await this.requireOwner(actor)
    const invites = await this.prisma.companyInvite.findMany({
      where: { companyId, acceptedAt: null, declinedAt: null, revokedAt: null },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return invites.map((i) => this.presentInvite(i))
  }

  /** Owner invites a colleague. Open invites hold a seat (402 SEAT_LIMIT_REACHED beyond the plan). */
  async invite(actor: TeamActor, data: { email: string; role: AssignableRole }) {
    const companyId = await this.requireOwner(actor)
    if (!ASSIGNABLE.includes(data.role))
      throw fail(
        "Role must be Recruiter, Hiring Manager or Viewer",
        HttpStatus.BAD_REQUEST,
        "INVALID_ROLE"
      )
    const email = data.email.trim().toLowerCase()

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true, companyId: true },
    })
    if (existing) {
      if (existing.role !== UserRole.RECRUITER)
        throw fail(
          "This e-mail belongs to a job seeker account. Invites need a recruiter account, so ask them to use their work e-mail.",
          HttpStatus.CONFLICT,
          "INVITE_NEEDS_RECRUITER"
        )
      const member = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: existing.id } },
      })
      if (member || existing.companyId === companyId)
        throw fail("This person is already on your team", HttpStatus.CONFLICT, "ALREADY_MEMBER")
    }

    // Re-inviting the same e-mail replaces the earlier open invite (frees its seat first).
    await this.prisma.companyInvite.updateMany({
      where: { ...openInviteWhere(companyId), email },
      data: { revokedAt: new Date() },
    })
    await assertSeatAvailable(this.prisma, companyId)

    const raw = newRawToken()
    const invite = await this.prisma.companyInvite.create({
      data: {
        companyId,
        email,
        role: data.role as CompanyMemberRole,
        tokenHash: sha256(raw),
        invitedById: actor.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
      include: { invitedBy: { select: { name: true } } },
    })
    await this.sendInvite(invite, raw, actor.userId)
    await this.log(
      actor.userId,
      "team.invite",
      companyId,
      `Invited ${email} as ${ROLE_LABEL[data.role]}`,
      {
        inviteId: invite.id,
        role: data.role,
      }
    )
    return this.presentInvite(invite)
  }

  private async ownedInvite(actor: TeamActor, inviteId: string) {
    const companyId = await this.requireOwner(actor)
    const invite = await this.prisma.companyInvite.findUnique({ where: { id: inviteId } })
    if (
      !invite ||
      invite.companyId !== companyId ||
      invite.acceptedAt ||
      invite.declinedAt ||
      invite.revokedAt
    )
      throw fail("Invite not found", HttpStatus.NOT_FOUND, "INVITE_NOT_FOUND")
    return invite
  }

  /** New link + 7 more days; the old link stops working. */
  async resendInvite(actor: TeamActor, inviteId: string) {
    const invite = await this.ownedInvite(actor, inviteId)
    if (invite.expiresAt.getTime() <= Date.now())
      await assertSeatAvailable(this.prisma, invite.companyId)
    const raw = newRawToken()
    const updated = await this.prisma.companyInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
      include: { invitedBy: { select: { name: true } } },
    })
    await this.sendInvite(updated, raw, actor.userId)
    return this.presentInvite(updated)
  }

  async revokeInvite(actor: TeamActor, inviteId: string) {
    const invite = await this.ownedInvite(actor, inviteId)
    await this.prisma.companyInvite.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    })
    await this.log(
      actor.userId,
      "team.invite_revoke",
      invite.companyId,
      `Revoked the invite for ${invite.email}`
    )
    return { id: invite.id, revoked: true }
  }

  /** Valid invite by raw token, or 410 INVITE_EXPIRED (unknown, used, revoked or expired). */
  async openInvite(db: Tx | PrismaService, rawToken: string) {
    const invite = rawToken
      ? await db.companyInvite.findUnique({
          where: { tokenHash: sha256(rawToken) },
          include: {
            company: { select: { id: true, name: true, logo: true, status: true } },
            invitedBy: { select: { name: true } },
          },
        })
      : null
    if (
      !invite ||
      invite.acceptedAt ||
      invite.declinedAt ||
      invite.revokedAt ||
      invite.expiresAt.getTime() <= Date.now()
    )
      throw fail(
        "This invite link has expired or was already used. Ask your team owner to send a new one.",
        HttpStatus.GONE,
        "INVITE_EXPIRED"
      )
    if (invite.company.status === CompanyStatus.SUSPENDED)
      throw fail("This company is suspended right now.", HttpStatus.FORBIDDEN, "COMPANY_SUSPENDED")
    return invite
  }

  /** Public preview for the accept page: never the full e-mail. */
  async previewInvite(rawToken: string) {
    const invite = await this.openInvite(this.prisma, rawToken)
    return {
      company: { name: invite.company.name, logo: invite.company.logo },
      role: invite.role,
      roleLabel: ROLE_LABEL[invite.role] ?? invite.role,
      invitedBy: invite.invitedBy?.name ?? null,
      emailHint: maskEmail(invite.email),
      expiresAt: invite.expiresAt,
    }
  }

  /** Joins the invite's company inside `tx` (used by accept and by sign-up through a link). */
  async consumeInvite(tx: Tx, rawToken: string, user: { id: string; email: string; role: string }) {
    const invite = await this.openInvite(tx, rawToken)
    if (user.role !== UserRole.RECRUITER)
      this.requireRecruiter({ userId: user.id, role: user.role })
    if (!sameEmail(invite.email, user.email))
      throw fail(
        `This invite was sent to ${maskEmail(invite.email)}. Sign in with that e-mail to accept it.`,
        HttpStatus.FORBIDDEN,
        "INVITE_EMAIL_MISMATCH"
      )
    await this.moveIntoCompany(tx, user.id, invite.companyId, invite.role)
    await tx.companyInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })
    await this.log(
      user.id,
      "team.invite_accept",
      invite.companyId,
      `${user.email} joined as ${ROLE_LABEL[invite.role]}`,
      { inviteId: invite.id },
      tx
    )
    return invite
  }

  async acceptInvite(actor: TeamActor, rawToken: string) {
    this.requireRecruiter(actor)
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, email: true, role: true, name: true },
    })
    if (!user) throw fail("Account not found", HttpStatus.NOT_FOUND, "USER_NOT_FOUND")
    // Clear error before the transaction (e.g. "leave your current company first").
    const preview = await this.openInvite(this.prisma, rawToken)
    await this.assertCanMove(this.prisma, user.id, preview.companyId)
    const invite = await this.prisma.$transaction((tx) => this.consumeInvite(tx, rawToken, user))
    // The invite link proves the inbox: mark the e-mail verified if it wasn't yet.
    await this.prisma.user.updateMany({
      where: { id: user.id, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    })
    await this.notify(
      [invite.invitedById],
      `${user.name} accepted your invite and joined ${invite.company.name}.`
    )
    return { companyId: invite.companyId, company: invite.company.name, role: invite.role }
  }

  async declineInvite(actor: TeamActor, rawToken: string) {
    const invite = await this.openInvite(this.prisma, rawToken)
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { email: true, name: true },
    })
    if (!sameEmail(invite.email, user?.email))
      throw fail(
        `This invite was sent to ${maskEmail(invite.email)}.`,
        HttpStatus.FORBIDDEN,
        "INVITE_EMAIL_MISMATCH"
      )
    await this.prisma.companyInvite.update({
      where: { id: invite.id },
      data: { declinedAt: new Date() },
    })
    await this.notify(
      [invite.invitedById],
      `${user?.name ?? invite.email} declined your invite to ${invite.company.name}.`
    )
    return { declined: true }
  }

  // ─── join requests by verified domain ──────────────────────────────────────

  /** Verified, active company whose domain matches the e-mail (free-mail domains never match). */
  async domainMatch(email: string) {
    const domain = registrableDomain(email)
    if (!domain || isFreeMailDomain(domain)) return null
    const company = await this.prisma.company.findFirst({
      where: { verified: true, verifiedDomain: domain, status: { not: CompanyStatus.SUSPENDED } },
      select: { id: true, name: true, logo: true },
      orderBy: { joinedAt: "asc" },
    })
    return company
  }

  private async assertDomainMatches(email: string, companyId: string) {
    const match = await this.domainMatch(email)
    if (!match || match.id !== companyId)
      throw fail(
        "You can only ask to join a verified company that uses your e-mail domain.",
        HttpStatus.FORBIDDEN,
        "DOMAIN_MISMATCH"
      )
    return match
  }

  /** Creates the PENDING request inside `tx` (sign-up) and returns the owners to notify. */
  async createJoinRequest(tx: Tx, user: { id: string; email: string }, companyId: string) {
    await this.assertDomainMatches(user.email, companyId)
    const pending = await tx.companyJoinRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
    })
    if (pending)
      throw fail("You already have a pending request", HttpStatus.CONFLICT, "JOIN_REQUEST_PENDING")
    return tx.companyJoinRequest.create({ data: { userId: user.id, companyId } })
  }

  async notifyJoinRequest(companyId: string, requesterName: string) {
    await this.notify(
      await this.ownerIds(companyId),
      `${requesterName} asked to join your team. Open Team to approve or decline.`
    )
  }

  async requestToJoin(actor: TeamActor, companyId: string) {
    this.requireRecruiter(actor)
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, email: true, name: true },
    })
    if (!user) throw fail("Account not found", HttpStatus.NOT_FOUND, "USER_NOT_FOUND")
    await this.assertCanMove(this.prisma, user.id, companyId)
    const request = await this.prisma.$transaction((tx) =>
      this.createJoinRequest(tx, user, companyId)
    )
    await this.notifyJoinRequest(companyId, user.name)
    return this.myJoinRequest(actor).then((r) => r ?? { id: request.id })
  }

  async myJoinRequest(actor: TeamActor) {
    const request = await this.prisma.companyJoinRequest.findFirst({
      where: { userId: actor.userId, status: "PENDING" },
      include: { company: { select: { id: true, name: true, logo: true } } },
      orderBy: { createdAt: "desc" },
    })
    return request
      ? { id: request.id, createdAt: request.createdAt, company: request.company }
      : null
  }

  async cancelMyJoinRequest(actor: TeamActor) {
    const { count } = await this.prisma.companyJoinRequest.updateMany({
      where: { userId: actor.userId, status: "PENDING" },
      data: { status: "CANCELED", decidedAt: new Date() },
    })
    return { canceled: count > 0 }
  }

  async listJoinRequests(actor: TeamActor) {
    const companyId = await this.requireOwner(actor)
    const rows = await this.prisma.companyJoinRequest.findMany({
      where: { companyId, status: "PENDING" },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    })
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.user }))
  }

  private async pendingRequest(companyId: string, requestId: string) {
    const request = await this.prisma.companyJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        company: { select: { name: true } },
      },
    })
    if (!request || request.companyId !== companyId || request.status !== "PENDING")
      throw fail("Join request not found", HttpStatus.NOT_FOUND, "JOIN_REQUEST_NOT_FOUND")
    return request
  }

  async approveJoinRequest(actor: TeamActor, requestId: string, role: AssignableRole) {
    const companyId = await this.requireOwner(actor)
    if (!ASSIGNABLE.includes(role))
      throw fail(
        "Role must be Recruiter, Hiring Manager or Viewer",
        HttpStatus.BAD_REQUEST,
        "INVALID_ROLE"
      )
    const request = await this.pendingRequest(companyId, requestId)
    await this.assertCanMove(this.prisma, request.userId, companyId)
    await assertSeatAvailable(this.prisma, companyId)
    await this.prisma.$transaction(async (tx) => {
      await this.moveIntoCompany(tx, request.userId, companyId, role as CompanyMemberRole)
      await tx.companyJoinRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", decidedById: actor.userId, decidedAt: new Date() },
      })
      await this.log(
        actor.userId,
        "team.join_approve",
        companyId,
        `Approved ${request.user.email} as ${ROLE_LABEL[role]}`,
        { requestId },
        tx
      )
    })
    await this.notify(
      [request.userId],
      `You're in! ${request.company.name} approved your request to join.`
    )
    return { id: request.id, status: "APPROVED" }
  }

  async declineJoinRequest(actor: TeamActor, requestId: string) {
    const companyId = await this.requireOwner(actor)
    const request = await this.pendingRequest(companyId, requestId)
    await this.prisma.companyJoinRequest.update({
      where: { id: request.id },
      data: { status: "DECLINED", decidedById: actor.userId, decidedAt: new Date() },
    })
    await this.log(actor.userId, "team.join_decline", companyId, `Declined ${request.user.email}`, {
      requestId,
    })
    await this.notify(
      [request.userId],
      `${request.company.name} declined your request to join. You can set up your own company instead.`
    )
    return { id: request.id, status: "DECLINED" }
  }

  // ─── ownership and leaving ──────────────────────────────────────────────────

  async transferOwnership(actor: TeamActor, memberId: string) {
    const companyId = await this.requireOwner(actor)
    const target = await this.prisma.companyMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true } }, company: { select: { name: true } } },
    })
    if (!target || target.companyId !== companyId)
      throw fail("Team member not found", HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND")
    if (target.userId === actor.userId)
      throw fail("You already own this company", HttpStatus.BAD_REQUEST, "ALREADY_OWNER")
    await this.prisma.$transaction(async (tx) => {
      await tx.companyMember.update({
        where: { id: target.id },
        data: { role: CompanyMemberRole.OWNER },
      })
      await tx.companyMember.updateMany({
        where: { companyId, userId: actor.userId },
        data: { role: CompanyMemberRole.RECRUITER },
      })
      await this.log(
        actor.userId,
        "team.transfer_owner",
        companyId,
        `Transferred ownership to ${target.user.name}`,
        { toUserId: target.userId },
        tx
      )
    })
    await this.notify([target.userId], `You're now the owner of ${target.company.name}.`)
    await this.notify(
      [actor.userId],
      `You transferred ownership of ${target.company.name} to ${target.user.name}. You're now a Recruiter.`
    )
    return { ownerUserId: target.userId }
  }

  /** Members leave; the owner must transfer ownership first. */
  async leave(actor: TeamActor) {
    const { companyId, role } = await resolveCompanyMembership(this.prisma, actor)
    if (role === CompanyMemberRole.OWNER)
      throw fail(
        "Transfer ownership to a teammate before leaving the company.",
        HttpStatus.CONFLICT,
        "OWNER_MUST_TRANSFER"
      )
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { name: true },
    })
    await this.prisma.$transaction(async (tx) => {
      await tx.companyMember.deleteMany({ where: { companyId, userId: actor.userId } })
      await tx.user.update({ where: { id: actor.userId }, data: { companyId: null } })
      await this.log(
        actor.userId,
        "team.leave",
        companyId,
        `${user?.name ?? "A member"} left the team`,
        undefined,
        tx
      )
    })
    await this.notify(await this.ownerIds(companyId), `${user?.name ?? "A member"} left your team.`)
    return { left: true }
  }
}
