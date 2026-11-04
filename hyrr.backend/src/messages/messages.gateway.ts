import { Inject, Logger, forwardRef } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { Server, Socket } from "socket.io"
import { verifyAccessTokenForSession } from "../auth/jwt.config"
import { AccessService, Actor } from "../core/access/access.service"
import { getAllowedOrigins } from "../core/config/origins"
import { normalizeException } from "../core/filters/all-exceptions.filter"
import { PrismaService } from "../prisma/prisma.service"
import { CreateMessageDto } from "./dtos/create-message.dto"
import { MessagesService } from "./messages.service"

type ChatPayload = { applicationId: string } | string

const chatId = (data: ChatPayload): string | undefined =>
  typeof data === "string" ? data : data?.applicationId

const errorMessage = (err: any) => {
  const message = err?.response?.message || err?.message
  return (
    (Array.isArray(message) ? message.join(", ") : message) ||
    "Something went wrong. Please try again."
  )
}

/** `{ error, errorCode }` ack for a failed socket request (same codes as the REST API). */
const errorAck = (err: any) => {
  const normalized = normalizeException(err)
  return {
    error: normalized.statusCode >= 500 ? errorMessage(err) : normalized.message,
    errorCode: normalized.errorCode,
  }
}

@WebSocketGateway({
  cors: {
    // Evaluated per handshake so CORS_ORIGINS loaded from .env is always honoured.
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
      callback(null, !origin || getAllowedOrigins().includes(origin)),
    credentials: true,
  },
  namespace: "/",
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagesGateway.name)

  @WebSocketServer()
  server: Server

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => MessagesService)) private messagesService: MessagesService,
    private access: AccessService,
    private prisma: PrismaService
  ) {}

  private actorOf(client: Socket): Actor {
    return {
      userId: (client as any).userId,
      role: (client as any).userRole,
      email: (client as any).userEmail,
    }
  }

  // ─── Connection Handling ──────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const raw =
        client.handshake.auth?.token || client.handshake.headers?.authorization?.split(" ")[1]
      const token = typeof raw === "string" ? raw.replace(/^Bearer\s+/i, "") : undefined
      if (!token) {
        client.disconnect()
        return
      }

      // Rejects expired/invalid/typed (refresh, mfa) tokens and revoked sessions (tokenVersion).
      const payload = await verifyAccessTokenForSession(this.jwtService, this.prisma, token)

      ;(client as any).userId = payload.sub
      ;(client as any).userRole = payload.role
      ;(client as any).userEmail = payload.email
      // `data` survives fetchSockets() (RemoteSocket), custom props may not.
      client.data = { ...(client.data || {}), userId: payload.sub }

      client.join(`user_${payload.sub}`)
      // Kept on the socket for typing indicators.
      ;(client as any).userName = await this.messagesService
        .displayName(payload.sub)
        .catch(() => null)

      // Recruiters join every company room they are a member of (DB is the source of truth,
      // the companyId claim in the token may be stale).
      if (payload.role === "RECRUITER" || payload.role === "ADMIN") {
        const { companyIds } = await this.access.companyScope(payload.sub)
        for (const companyId of companyIds) client.join(`company_${companyId}`)
      }

      client.emit("connected", { userId: payload.sub, role: payload.role })
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(_client: Socket) {
    // socket.io removes a disconnected socket from all rooms automatically
  }

  // ─── Chat Room Join / Leave ───────────────────────────────────────
  @SubscribeMessage("join_chat")
  async handleJoinChat(@MessageBody() data: ChatPayload, @ConnectedSocket() client: Socket) {
    const applicationId = chatId(data)
    if (!applicationId) return { error: "applicationId is required" }
    try {
      await this.messagesService.assertParticipant(applicationId, this.actorOf(client))
      client.join(`chat_${applicationId}`)
      return { room: `chat_${applicationId}` }
    } catch (err) {
      return errorAck(err)
    }
  }

  @SubscribeMessage("leave_chat")
  handleLeaveChat(@MessageBody() data: ChatPayload, @ConnectedSocket() client: Socket) {
    const applicationId = chatId(data)
    if (!applicationId) return { error: "applicationId is required" }
    client.leave(`chat_${applicationId}`)
    return { left: `chat_${applicationId}` }
  }

  // ─── Send Message ─────────────────────────────────────────────────
  // Persistence and broadcasting live in MessagesService.createMessage (shared with the REST
  // endpoint) so every event is emitted exactly once. The sender's socket receives the message
  // through this ack only.
  @SubscribeMessage("send_message")
  async handleSendMessage(
    @MessageBody() data: { applicationId: string; text: string; clientId?: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const actor = this.actorOf(client)
      if (!data?.applicationId || typeof data.applicationId !== "string") {
        return { error: "applicationId is required", errorCode: "VALIDATION_FAILED" }
      }
      const dto = plainToInstance(CreateMessageDto, {
        text: data.text,
        ...(data.clientId !== undefined && data.clientId !== null
          ? { clientId: data.clientId }
          : {}),
      })
      const errors = await validate(dto)
      if (errors.length) {
        const message = errors.flatMap((e) => Object.values(e.constraints || {})).join(", ")
        return { error: message || "Invalid message", errorCode: "VALIDATION_FAILED" }
      }
      return await this.messagesService.createMessage(data.applicationId, actor, dto.text, {
        clientId: dto.clientId,
        excludeSocketId: client.id,
      })
    } catch (err) {
      this.logger.warn(`send_message failed: ${errorMessage(err)}`)
      return errorAck(err)
    }
  }

  // ─── Typing Indicator ─────────────────────────────────────────────
  @SubscribeMessage("typing")
  async handleTyping(
    @MessageBody() data: { applicationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const applicationId = data?.applicationId
    // Only sockets that passed join_chat's participant check are in the room.
    if (!applicationId || !client.rooms.has(`chat_${applicationId}`)) return
    client.to(`chat_${applicationId}`).emit("user_typing", {
      applicationId,
      userId: (client as any).userId,
      name: (client as any).userName || null,
      isTyping: !!data.isTyping,
    })
  }

  // ─── Server-side emitters ─────────────────────────────────────────
  /** new_message to every given room (chat, seeker, company, poster); once per socket, never to the sender's socket. */
  emitNewMessage(message: Record<string, any>, rooms: string[], excludeSocketId?: string) {
    if (!this.server || !rooms.length) return
    const target = this.server.to([...new Set(rooms)])
    ;(excludeSocketId ? target.except(excludeSocketId) : target).emit("new_message", message)
  }

  /** Emits once per socket to the union of the given rooms. */
  emitToRooms(rooms: string[], event: string, data: Record<string, any>) {
    if (!this.server || !rooms.length) return
    this.server.to([...new Set(rooms)]).emit(event, data)
  }

  emitUnreadUpdate(userId: string, data: { applicationId: string }) {
    this.server?.to(`user_${userId}`).emit("unread_update", data)
  }

  /** True when one of the user's sockets is currently in `room` (e.g. viewing a thread). */
  async isUserInRoom(userId: string, room: string): Promise<boolean> {
    if (!this.server) return false
    const sockets = await this.server.in(room).fetchSockets()
    return sockets.some((s) => ((s as any).userId ?? s.data?.userId) === userId)
  }

  emitApplicationUpdate(seekerUserId: string, data: Record<string, any>) {
    this.server?.to(`user_${seekerUserId}`).emit("application_status_updated", data)
  }

  /** candidate_ai_scored to every recruiter of the company (+ the job poster), once per socket. */
  emitAiScoreUpdate(companyId: string, data: Record<string, any>, recruiterId?: string) {
    if (!this.server) return
    const rooms = [`company_${companyId}`]
    if (recruiterId) rooms.push(`user_${recruiterId}`)
    this.server.to(rooms).emit("candidate_ai_scored", data)
  }

  /** candidate_ai_status (PENDING / FAILED / DISABLED) to the company's recruiters, once per socket. */
  emitAiStatus(companyId: string, data: Record<string, any>, recruiterId?: string) {
    if (!this.server) return
    const rooms = [`company_${companyId}`]
    if (recruiterId) rooms.push(`user_${recruiterId}`)
    this.server.to(rooms).emit("candidate_ai_status", data)
  }

  emitNotification(userId: string, notification: Record<string, any>) {
    this.server?.to(`user_${userId}`).emit("notification", notification)
  }
}
