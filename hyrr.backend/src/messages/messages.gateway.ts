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
import { Server, Socket } from "socket.io"
import { jwtSecret } from "../auth/jwt.config"
import { MessagesService } from "./messages.service"

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174").split(","),
    credentials: true,
  },
  namespace: "/",
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService
  ) {}

  // ─── Connection Handling ──────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization?.split(" ")[1]
      if (!token) {
        client.disconnect()
        return
      }

      const payload = this.jwtService.verify(token, {
        secret: jwtSecret(),
      })

      // Attach user info to the socket
      ;(client as any).userId = payload.sub
      ;(client as any).userRole = payload.role
      ;(client as any).userEmail = payload.email

      // Join private user room
      client.join(`user_${payload.sub}`)

      // Recruiters also join company room
      if (payload.role === "RECRUITER" && payload.companyId) {
        client.join(`company_${payload.companyId}`)
      }

      client.emit("connected", { userId: payload.sub, role: payload.role })
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId
    if (userId) client.leave(`user_${userId}`)
  }

  // ─── Chat Room Join ───────────────────────────────────────────────
  @SubscribeMessage("join_chat")
  async handleJoinChat(
    @MessageBody() data: { applicationId: string },
    @ConnectedSocket() client: Socket
  ) {
    await this.messagesService.assertParticipant(data.applicationId, {
      userId: (client as any).userId,
      role: (client as any).userRole,
      email: (client as any).userEmail,
    })
    client.join(`chat_${data.applicationId}`)
    return { event: "joined_chat", data: { room: `chat_${data.applicationId}` } }
  }

  @SubscribeMessage("leave_chat")
  handleLeaveChat(
    @MessageBody() data: { applicationId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.leave(`chat_${data.applicationId}`)
  }

  // ─── Send Message ─────────────────────────────────────────────────
  @SubscribeMessage("send_message")
  async handleSendMessage(
    @MessageBody() data: { applicationId: string; text: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = (client as any).userId
    const role = (client as any).userRole

    const message = await this.messagesService.createMessage(
      data.applicationId,
      userId,
      role,
      data.text,
      { userId, role, email: (client as any).userEmail }
    )

    // Broadcast to all OTHER clients in the chat room (exclude sender to avoid duplicate)
    client.to(`chat_${data.applicationId}`).emit("new_message", message)

    // Notify the receiver's private room for badge update (in case they're not in this chat)
    if ((message as any).receiverId) {
      this.server.to(`user_${(message as any).receiverId}`).emit("new_message", message)
      this.server.to(`user_${(message as any).receiverId}`).emit("unread_update", {
        applicationId: data.applicationId,
      })
    }

    return message
  }

  // ─── Typing Indicator ─────────────────────────────────────────────
  @SubscribeMessage("typing")
  async handleTyping(
    @MessageBody() data: { applicationId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const userId = (client as any).userId
    await this.messagesService.assertParticipant(data.applicationId, {
      userId,
      role: (client as any).userRole,
      email: (client as any).userEmail,
    })
    client.to(`chat_${data.applicationId}`).emit("user_typing", {
      userId,
      isTyping: data.isTyping,
    })
  }

  // ─── Server-side: emit pipeline update to seeker ─────────────────
  emitApplicationUpdate(seekerUserId: string, data: Record<string, any>) {
    this.server.to(`user_${seekerUserId}`).emit("application_status_updated", data)
  }

  // ─── Server-side: emit AI score to recruiter company room ─────────
  emitAiScoreUpdate(companyId: string, data: Record<string, any>) {
    this.server.to(`company_${companyId}`).emit("candidate_ai_scored", data)
  }

  // ─── Server-side: emit notification to user ───────────────────────
  emitNotification(userId: string, notification: Record<string, any>) {
    this.server.to(`user_${userId}`).emit("notification", notification)
  }
}
