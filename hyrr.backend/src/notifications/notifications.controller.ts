import { Controller, Delete, Get, Param, Patch, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { NotificationsService } from "./notifications.service"

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get user notifications" })
  @ApiResponse({ status: 200, description: "Returns user notifications list" })
  getNotifications(@Req() req: any) {
    return this.notificationsService.getNotifications(req.user.userId)
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark all user notifications as read" })
  @ApiResponse({ status: 200, description: "All notifications marked as read" })
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.userId)
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark single notification as read" })
  @ApiResponse({ status: 200, description: "Notification marked as read" })
  markRead(@Param("id") id: string, @Req() req: any) {
    return this.notificationsService.markRead(id, req.user.userId)
  }

  @Delete()
  @ApiOperation({ summary: "Clear all user notifications" })
  @ApiResponse({ status: 200, description: "Notifications cleared" })
  clearNotifications(@Req() req: any) {
    return this.notificationsService.clearNotifications(req.user.userId)
  }
}
