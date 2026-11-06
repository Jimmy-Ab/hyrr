import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CalendarService } from "./calendar.service"
import { CreateCalendarEventDto } from "./dtos/create-calendar-event.dto"

@ApiTags("Calendar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @ApiOperation({ summary: "Get calendar events for the logged-in user (Seeker or Recruiter)" })
  @ApiResponse({ status: 200, description: "Returns list of calendar events" })
  getEvents(@Req() req: any) {
    return this.calendarService.getEvents(req.user)
  }

  @Post()
  @ApiOperation({ summary: "Schedule a new calendar event / interview slot" })
  @ApiResponse({ status: 201, description: "Event scheduled successfully" })
  createEvent(
    @Req() req: any,
    @Body()
    body: CreateCalendarEventDto
  ) {
    return this.calendarService.createEvent(
      {
        ...body,
        userId: req.user.userId,
      },
      req.user
    )
  }

  @Delete(":id")
  @ApiOperation({ summary: "Cancel/delete a calendar event" })
  @ApiResponse({ status: 200, description: "Event deleted" })
  deleteEvent(@Param("id") id: string, @Req() req: any) {
    return this.calendarService.deleteEvent(id, req.user)
  }
}
