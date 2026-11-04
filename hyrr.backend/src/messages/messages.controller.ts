import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CreateMessageDto } from "./dtos/create-message.dto"
import { MessagesService } from "./messages.service"

@ApiTags("Messages")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("conversations")
  @ApiOperation({ summary: "Conversations with at least one visible message, newest first" })
  @ApiResponse({ status: 200, description: "Returns list of conversation threads" })
  getConversations(@Req() req: any) {
    return this.messagesService.getConversations(req.user)
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get total unread message count for sidebar badge" })
  @ApiResponse({ status: 200, description: "Returns { count }" })
  getUnreadCount(@Req() req: any) {
    return this.messagesService.getUnreadCount(req.user)
  }

  @Delete("conversations/:applicationId")
  @ApiOperation({ summary: "Delete a conversation for the logged-in user only" })
  @ApiResponse({ status: 200, description: "Conversation cleared for this user" })
  deleteConversation(@Param("applicationId") applicationId: string, @Req() req: any) {
    return this.messagesService.clearConversation(applicationId, req.user)
  }

  // Sub-routes are declared before `GET :applicationId` so they are matched first.
  @Get(":applicationId/meta")
  @ApiOperation({ summary: "Thread header (works before the first message exists)" })
  getMeta(@Param("applicationId") applicationId: string, @Req() req: any) {
    return this.messagesService.getMeta(applicationId, req.user)
  }

  @Post(":applicationId/read")
  @ApiOperation({ summary: "Mark the thread read for the logged-in user" })
  @ApiResponse({ status: 201, description: "Returns { unreadCount } (new total)" })
  markRead(@Param("applicationId") applicationId: string, @Req() req: any) {
    return this.messagesService.markThreadRead(applicationId, req.user)
  }

  @Get(":applicationId")
  @ApiOperation({ summary: "Get the messages of a thread visible to the logged-in user" })
  @ApiResponse({ status: 200, description: "Returns message history (ascending)" })
  getMessages(@Param("applicationId") applicationId: string, @Req() req: any) {
    return this.messagesService.getMessages(applicationId, req.user)
  }

  @Post(":applicationId")
  @ApiOperation({ summary: "Send a message in a thread (REST fallback, prefer WebSocket)" })
  @ApiResponse({
    status: 201,
    description: "Message sent (or the existing one for a repeated clientId)",
  })
  @ApiResponse({ status: 409, description: "CONVERSATION_CLOSED" })
  sendMessage(
    @Param("applicationId") applicationId: string,
    @Body() body: CreateMessageDto,
    @Req() req: any
  ) {
    return this.messagesService.createMessage(applicationId, req.user, body.text, {
      clientId: body.clientId,
    })
  }
}
