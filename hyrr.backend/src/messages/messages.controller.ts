import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations (threads) for the logged-in user' })
  @ApiResponse({ status: 200, description: 'Returns list of conversation threads' })
  getConversations(@Req() req: any) {
    return this.messagesService.getConversations(req.user.userId, req.user.role);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread message count for sidebar badge' })
  @ApiResponse({ status: 200, description: 'Returns unread count' })
  getUnreadCount(@Req() req: any) {
    return this.messagesService.getUnreadCount(req.user.userId, req.user.role);
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Get total unread message count (legacy alias)' })
  getUnreadCountLegacy(@Req() req: any) {
    return this.messagesService.getUnreadCount(req.user.userId, req.user.role);
  }

  @Get(':applicationId')
  @ApiOperation({ summary: 'Get all messages in a conversation thread' })
  @ApiResponse({ status: 200, description: 'Returns message history' })
  getMessages(@Param('applicationId') applicationId: string, @Req() req: any) {
    return this.messagesService.getMessages(applicationId, req.user.role);
  }

  @Post(':applicationId')
  @ApiOperation({ summary: 'Send a message in a thread (REST fallback, prefer WebSocket)' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  sendMessage(
    @Param('applicationId') applicationId: string,
    @Body() body: { text: string },
    @Req() req: any,
  ) {
    return this.messagesService.createMessage(applicationId, req.user.userId, req.user.role, body.text);
  }

  @Delete('conversations/:applicationId')
  @ApiOperation({ summary: 'Delete a conversation for the logged-in user only' })
  @ApiResponse({ status: 200, description: 'Conversation deleted for this user' })
  deleteConversation(@Param('applicationId') applicationId: string, @Req() req: any) {
    return this.messagesService.deleteConversation(applicationId, req.user.userId, req.user.role);
  }
}
