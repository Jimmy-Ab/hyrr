import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from "@nestjs/common"
import {
  ApplicationStatus,
  NotificationAction,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { EmailService } from "../core/delivery/email.service"
import { newMessage } from "../core/delivery/templates"
import { AppException } from "../core/exceptions/app-exception"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { MessagesGateway } from "./messages.gateway"

/** Upper bound on conversations returned in one listing. */
const CONVERSATION_LIMIT = 500

/** A thread has two sides: the applicant, and the hiring team (recruiters + admins). */
export type Side = "SEEKER" | "RECRUITER"
export type ClosedReason = "WITHDRAWN" | "SAVED" | null

export const sideOf = (role: string): Side => (role === "SEEKER" ? "SEEKER" : "RECRUITER")

/** Sender types belonging to the side opposite to `side` (i.e. messages that count as unread). */
const otherSenderTypes = (side: Side): UserRole[] =>
  side === "SEEKER" ? [UserRole.RECRUITER, UserRole.ADMIN] : [UserRole.SEEKER]

const SENDER_SELECT = { select: { id: true, name: true, avatar: true, role: true } } as const

const THREAD_INCLUDE = {
  job: {
    select: {
      id: true,
      title: true,
      companyId: true,
      recruiterId: true,
      company: { select: { id: true, name: true, logo: true, color: true } },
      postedBy: { select: { id: true, name: true, avatar: true } },
    },
  },
  user: { select: { id: true, name: true, avatar: true } },
} as const

const fallbackAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`

export const closedReasonFor = (status: string): ClosedReason =>
  status === ApplicationStatus.WITHDRAWN
    ? "WITHDRAWN"
    : status === ApplicationStatus.SAVED
      ? "SAVED"
      : null

/** Public message shape (REST responses, socket acks and `new_message`). */
export const toMessagePayload = (m: any) => ({
  id: m.id,
  applicationId: m.applicationId,
  senderId: m.senderId ?? null,
  receiverId: m.receiverId ?? null,
  senderType: m.senderType,
  text: m.text,
  createdAt: m.createdAt,
  read: !!m.read,
  clientId: m.clientId ?? null,
  sender: m.sender
    ? { id: m.sender.id, name: m.sender.name, avatar: m.sender.avatar, role: m.sender.role }
    : null,
})

const isUniqueViolation = (err: any) => err?.code === "P2002"

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name)

  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    @Optional()
    @Inject(forwardRef(() => MessagesGateway))
    private messagesGateway?: MessagesGateway,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private notifications?: NotificationsService,
    @Optional() private email?: EmailService
  ) {}

  // ─── Scope & per-user state helpers ───────────────────────────────

  /** Application filter for the conversations visible to this user (SAVED never has a thread). */
  private async scopeWhere(actor: Actor): Promise<Prisma.ApplicationWhereInput> {
    if (sideOf(actor.role) === "SEEKER") {
      let email = actor.email
      if (!email) {
        const me = await this.prisma.user.findUnique({
          where: { id: actor.userId },
          select: { email: true },
        })
        email = me?.email
      }
      return {
        status: { not: ApplicationStatus.SAVED },
        // Same ownership rule as AccessService.isApplicationOwner (guest applications by email).
        OR: [{ userId: actor.userId }, ...(email ? [{ userId: null, email }] : [])],
      }
    }
    const jobWhere = await this.access.jobScopeWhere(actor)
    return { status: { not: ApplicationStatus.SAVED }, job: jobWhere }
  }

  /** Upserts the viewer's ConversationState (read position / "delete for me"). */
  private touchState(
    applicationId: string,
    userId: string,
    data: { lastReadAt?: Date; clearedAt?: Date }
  ) {
    return this.prisma.conversationState.upsert({
      where: { applicationId_userId: { applicationId, userId } },
      create: { applicationId, userId, ...data },
      update: data,
    })
  }

  /** Timestamp that is never earlier than the newest message (guards against clock skew). */
  private async markerTime(applicationId: string) {
    const now = new Date()
    const latest = await this.prisma.message.findFirst({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    return latest?.createdAt && latest.createdAt > now ? latest.createdAt : now
  }

  /** Latest message visible to `userId` (after their clearedAt) per application. */
  private async lastVisibleMessages(
    userId: string,
    ids: string[]
  ): Promise<{ id: string; applicationId: string; createdAt: Date }[]> {
    if (!ids.length) return []
    const rows = await this.prisma.$queryRaw<
      { id: string; applicationId: string; createdAt: Date }[]
    >(Prisma.sql`
      SELECT DISTINCT ON (m."applicationId") m."id", m."applicationId", m."createdAt"
      FROM "Message" m
      LEFT JOIN "ConversationState" cs
        ON cs."applicationId" = m."applicationId" AND cs."userId" = ${userId}
      WHERE m."applicationId" = ANY(${ids}::text[])
        AND (cs."clearedAt" IS NULL OR m."createdAt" > cs."clearedAt")
      ORDER BY m."applicationId", m."createdAt" DESC, m."id" DESC
    `)
    return rows || []
  }

  /**
   * Unread messages per application for this viewer: sent by the other side, newer than both
   * the viewer's lastReadAt and clearedAt.
   */
  private async unreadCounts(actor: Actor, ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map()
    const types = otherSenderTypes(sideOf(actor.role)).map(String)
    const rows = await this.prisma.$queryRaw<{ applicationId: string; count: number }[]>(
      Prisma.sql`
      SELECT m."applicationId", COUNT(*)::int AS "count"
      FROM "Message" m
      LEFT JOIN "ConversationState" cs
        ON cs."applicationId" = m."applicationId" AND cs."userId" = ${actor.userId}
      WHERE m."applicationId" = ANY(${ids}::text[])
        AND m."senderType"::text = ANY(${types}::text[])
        AND (m."senderId" IS NULL OR m."senderId" <> ${actor.userId})
        AND (cs."lastReadAt" IS NULL OR m."createdAt" > cs."lastReadAt")
        AND (cs."clearedAt" IS NULL OR m."createdAt" > cs."clearedAt")
      GROUP BY m."applicationId"
    `
    )
    return new Map((rows || []).map((r) => [r.applicationId, Number(r.count) || 0]))
  }

  /** The applicant's user id: the linked account, or a seeker account matching a guest's email. */
  private async seekerUserIdOf(app: { userId: string | null; email?: string | null }) {
    if (app.userId) return app.userId
    if (!app.email) return null
    const user = await this.prisma.user.findUnique({
      where: { email: app.email },
      select: { id: true, role: true },
    })
    return user?.role === UserRole.SEEKER ? user.id : null
  }

  /** Socket rooms of one side of a thread. */
  private sideRooms(
    side: Side,
    t: { seekerUserId: string | null; companyId?: string | null; posterId?: string | null }
  ) {
    if (side === "SEEKER") return t.seekerUserId ? [`user_${t.seekerUserId}`] : []
    return [
      ...(t.companyId ? [`company_${t.companyId}`] : []),
      ...(t.posterId ? [`user_${t.posterId}`] : []),
    ]
  }

  private buildItem(app: any, actor: Actor, last: any | null, unreadCount: number) {
    const job = app.job
    const company = job?.company
      ? {
          id: job.company.id,
          name: job.company.name,
          logo: job.company.logo,
          color: job.company.color,
        }
      : null
    let candidateName: string
    let avatar: string
    if (sideOf(actor.role) === "SEEKER") {
      candidateName = job?.postedBy?.name || company?.name || "Recruiter"
      avatar = job?.postedBy?.avatar || fallbackAvatar(company?.name || "Recruiter")
    } else {
      // Guest applicants have no user record: the application's own name is authoritative.
      candidateName = app.name || app.user?.name || "Applicant"
      avatar = app.user?.avatar || fallbackAvatar(candidateName)
    }
    const closedReason = closedReasonFor(app.status)
    const lastMessage = last ? toMessagePayload(last) : null
    return {
      applicationId: app.id,
      id: app.id,
      candidateName,
      avatar,
      jobId: app.jobId ?? job?.id ?? null,
      jobTitle: job?.title || app.title || null,
      company,
      status: app.status,
      isGuest: !app.userId,
      canSend: !closedReason,
      closedReason,
      lastMessage,
      lastMessageAt: lastMessage?.createdAt ?? null,
      unreadCount,
    }
  }

  // ─── M1: conversations ────────────────────────────────────────────

  async getConversations(actor: Actor) {
    const where = await this.scopeWhere(actor)
    const withMessages =
      (await this.prisma.application.findMany({
        where: { AND: [where, { messages: { some: {} } }] },
        select: { id: true },
      })) || []
    const visible = await this.lastVisibleMessages(
      actor.userId,
      withMessages.map((a) => a.id)
    )
    const page = [...visible]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, CONVERSATION_LIMIT)
    if (!page.length) return []

    const appIds = page.map((p) => p.applicationId)
    const [apps, messages, unread] = await Promise.all([
      this.prisma.application.findMany({
        where: { id: { in: appIds } },
        include: THREAD_INCLUDE,
      }),
      this.prisma.message.findMany({
        where: { id: { in: page.map((p) => p.id) } },
        include: { sender: SENDER_SELECT },
      }),
      this.unreadCounts(actor, appIds),
    ])
    const appById = new Map<string, any>((apps || []).map((a: any) => [a.id, a]))
    const msgById = new Map<string, any>((messages || []).map((m: any) => [m.id, m]))

    return page
      .filter((p) => appById.has(p.applicationId))
      .map((p) =>
        this.buildItem(
          appById.get(p.applicationId),
          actor,
          msgById.get(p.id) || null,
          unread.get(p.applicationId) || 0
        )
      )
  }

  // ─── M2: thread header ────────────────────────────────────────────

  async getMeta(applicationId: string, actor: Actor) {
    await this.access.applicationFor(actor, applicationId, "view")
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: THREAD_INCLUDE,
    })
    if (!app) throw new NotFoundException("Application not found")
    const [last] = await this.lastVisibleMessages(actor.userId, [applicationId])
    const [message, unread] = await Promise.all([
      last
        ? this.prisma.message.findUnique({
            where: { id: last.id },
            include: { sender: SENDER_SELECT },
          })
        : null,
      this.unreadCounts(actor, [applicationId]),
    ])
    return this.buildItem(app, actor, message || null, unread.get(applicationId) || 0)
  }

  // ─── M3: history (no side effects) ────────────────────────────────

  async getMessages(applicationId: string, actor: Actor) {
    await this.access.applicationFor(actor, applicationId, "view")
    const state = await this.prisma.conversationState.findUnique({
      where: { applicationId_userId: { applicationId, userId: actor.userId } },
    })
    const messages = await this.prisma.message.findMany({
      where: {
        applicationId,
        ...(state?.clearedAt ? { createdAt: { gt: state.clearedAt } } : {}),
      },
      include: { sender: SENDER_SELECT },
      orderBy: { createdAt: "asc" },
    })
    return (messages || []).map(toMessagePayload)
  }

  // ─── Send rules ───────────────────────────────────────────────────

  /** Throws 409 CONVERSATION_CLOSED / 403 when the actor may not post in this thread. */
  private assertOpen(actor: Actor, app: { status: string; userId: string | null; email: string }) {
    if (actor.role === "SEEKER" && !this.access.isApplicationOwner(actor, app)) {
      throw new ForbiddenException("You do not have access to this application")
    }
    const reason = closedReasonFor(app.status)
    if (reason === "WITHDRAWN") {
      throw new AppException(
        "This application was withdrawn, so the conversation is read-only.",
        HttpStatus.CONFLICT,
        "CONVERSATION_CLOSED"
      )
    }
    if (reason === "SAVED") {
      throw new AppException(
        "Apply to this job before messaging the recruiter.",
        HttpStatus.CONFLICT,
        "CONVERSATION_CLOSED"
      )
    }
  }

  async assertCanSend(actor: Actor, applicationId: string) {
    const app = await this.access.applicationFor(actor, applicationId, "view")
    this.assertOpen(actor, app)
    return app
  }

  private async findByClientId(senderId: string, clientId: string) {
    return this.prisma.message.findUnique({
      where: { senderId_clientId: { senderId, clientId } },
      include: { sender: SENDER_SELECT },
    })
  }

  // ─── M4: send ─────────────────────────────────────────────────────

  async createMessage(
    applicationId: string,
    actor: Actor,
    text: string,
    options: { clientId?: string | null; excludeSocketId?: string } = {}
  ) {
    const clientId = options.clientId || null
    const accessible: any = await this.access.applicationFor(actor, applicationId, "view")

    // Idempotent retry (socket timeout → REST with the same clientId).
    if (clientId) {
      const existing = await this.findByClientId(actor.userId, clientId)
      if (existing && existing.applicationId === applicationId) return toMessagePayload(existing)
    }
    this.assertOpen(actor, accessible)

    const app: any = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            title: true,
            companyId: true,
            recruiterId: true,
            company: { select: { name: true } },
          },
        },
        user: { select: { name: true } },
      },
    })
    if (!app) throw new NotFoundException("Application not found")

    const side = sideOf(actor.role)
    const seekerUserId = side === "SEEKER" ? actor.userId : await this.seekerUserIdOf(app)
    const posterId: string | null = app.job?.recruiterId || null
    const companyId: string | null = app.job?.companyId || null
    const receiverId = side === "SEEKER" ? posterId : seekerUserId

    let message: any
    try {
      message = await this.prisma.message.create({
        data: {
          applicationId,
          senderId: actor.userId,
          receiverId,
          senderType: actor.role as UserRole,
          text,
          clientId,
        },
        include: { sender: SENDER_SELECT },
      })
    } catch (err) {
      // Concurrent retry with the same clientId won the race: return the stored message.
      if (clientId && isUniqueViolation(err)) {
        const existing = await this.findByClientId(actor.userId, clientId)
        if (existing) return toMessagePayload(existing)
      }
      throw err
    }

    // Replying implies the sender has read the thread.
    await this.touchState(applicationId, actor.userId, { lastReadAt: message.createdAt })
    const marked = await this.prisma.message.updateMany({
      where: {
        applicationId,
        read: false,
        senderType: { in: otherSenderTypes(side) },
        createdAt: { lte: message.createdAt },
      },
      data: { read: true },
    })
    const payload = toMessagePayload(message)

    const targets = { seekerUserId, companyId, posterId }
    const otherSide: Side = side === "SEEKER" ? "RECRUITER" : "SEEKER"
    const recipientRooms = this.sideRooms(otherSide, targets)

    // Single emission point for new messages (REST and socket both go through here).
    if (this.messagesGateway) {
      const rooms = [
        `chat_${applicationId}`,
        ...this.sideRooms("SEEKER", targets),
        ...this.sideRooms("RECRUITER", targets),
      ]
      this.messagesGateway.emitNewMessage(payload, rooms, options.excludeSocketId)
      this.messagesGateway.emitToRooms(
        [...recipientRooms, `user_${actor.userId}`],
        "unread_update",
        { applicationId }
      )
      if ((marked?.count || 0) > 0) {
        this.messagesGateway.emitToRooms(
          [`chat_${applicationId}`, ...recipientRooms],
          "messages_read",
          { applicationId, readerSide: side, readAt: message.createdAt }
        )
      }
    }

    await this.notifyReceiver(app, actor, side, receiverId, payload)
    return payload
  }

  /** In-app notification for the receiver (skipped while they view the thread); e-mail for guests. */
  private async notifyReceiver(
    app: any,
    actor: Actor,
    side: Side,
    receiverId: string | null,
    payload: ReturnType<typeof toMessagePayload>
  ) {
    const applicationId = app.id
    const jobTitle = app.job?.title || app.title || "your application"
    try {
      if (receiverId && receiverId !== actor.userId) {
        const viewing = this.messagesGateway
          ? await this.messagesGateway
              .isUserInRoom(receiverId, `chat_${applicationId}`)
              .catch(() => false)
          : false
        if (!viewing) {
          const senderName =
            side === "SEEKER"
              ? app.name || app.user?.name || "An applicant"
              : app.job?.company?.name || payload.sender?.name || "Your recruiter"
          await this.notifications
            ?.createNotification(
              receiverId,
              `New message from ${senderName} about ${jobTitle}`,
              NotificationType.MESSAGE,
              NotificationAction.MESSAGES,
              applicationId,
              // Messages have their own unread badge: e-mail copy only, no bell notification.
              { inApp: false }
            )
            .catch(() => undefined)
        }
      }

      // Guest applicant without an account: the message is also delivered by e-mail.
      if (side === "RECRUITER" && !receiverId && app.email && this.email) {
        const companyName = app.job?.company?.name || "The hiring team"
        const content = newMessage({
          name: app.name,
          fromName: companyName,
          jobTitle,
          excerpt: payload.text || "",
        })
        await this.email
          .send({ to: app.email, ...content })
          .catch((err) => this.logger.warn(`Guest message e-mail failed: ${err?.message || err}`))
      }
    } catch (err: any) {
      this.logger.warn(`Message notification failed: ${err?.message || err}`)
    }
  }

  // ─── M5: mark read ────────────────────────────────────────────────

  async markThreadRead(applicationId: string, actor: Actor) {
    const app: any = await this.access.applicationFor(actor, applicationId, "view")
    const side = sideOf(actor.role)
    const readAt = await this.markerTime(applicationId)
    await this.touchState(applicationId, actor.userId, { lastReadAt: readAt })
    await this.prisma.message.updateMany({
      where: {
        applicationId,
        read: false,
        senderType: { in: otherSenderTypes(side) },
        createdAt: { lte: readAt },
      },
      data: { read: true },
    })

    if (this.messagesGateway) {
      const seekerUserId = side === "SEEKER" ? actor.userId : await this.seekerUserIdOf(app)
      const otherRooms = this.sideRooms(side === "SEEKER" ? "RECRUITER" : "SEEKER", {
        seekerUserId,
        companyId: app.job?.companyId,
        posterId: app.job?.recruiterId,
      })
      this.messagesGateway.emitUnreadUpdate(actor.userId, { applicationId })
      this.messagesGateway.emitToRooms([`chat_${applicationId}`, ...otherRooms], "messages_read", {
        applicationId,
        readerSide: side,
        readAt,
      })
    }

    const { count } = await this.getUnreadCount(actor)
    return { unreadCount: count }
  }

  // ─── M6: delete for me ────────────────────────────────────────────

  async clearConversation(applicationId: string, actor: Actor) {
    await this.access.applicationFor(actor, applicationId, "view")
    const clearedAt = await this.markerTime(applicationId)
    await this.touchState(applicationId, actor.userId, { clearedAt })
    this.messagesGateway?.emitUnreadUpdate(actor.userId, { applicationId })
    return { applicationId, cleared: true as const }
  }

  // ─── M7: unread total ─────────────────────────────────────────────

  async getUnreadCount(actor: Actor) {
    const where = await this.scopeWhere(actor)
    const apps =
      (await this.prisma.application.findMany({
        where: {
          AND: [
            where,
            { messages: { some: { senderType: { in: otherSenderTypes(sideOf(actor.role)) } } } },
          ],
        },
        select: { id: true },
      })) || []
    const counts = await this.unreadCounts(
      actor,
      apps.map((a) => a.id)
    )
    let count = 0
    for (const n of counts.values()) count += n
    return { count }
  }

  // ─── Socket helpers ───────────────────────────────────────────────

  async assertParticipant(applicationId: string, actor: Actor) {
    await this.access.applicationFor(actor, applicationId, "view")
  }

  async displayName(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })
    return user?.name || null
  }
}
