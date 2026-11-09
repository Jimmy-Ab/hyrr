import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { CalendarService } from "./calendar.service"
import { CreateCalendarEventDto } from "./dtos/create-calendar-event.dto"
import { BookInterviewSlotDto, CreateInterviewInviteDto } from "./dtos/interview-invite.dto"
import { InterviewInvitesService } from "./interview-invites.service"

const uuid = new ParseUUIDPipe({ version: undefined })

@ApiTags("Calendar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("calendar")
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly invites: InterviewInvitesService
  ) {}

  // ─── Interview invites (candidate picks a time) ─── declared before :id routes
  @Get("invites")
  @ApiOperation({ summary: "Seeker: my interview invites. Recruiter: ?applicationId=" })
  listInvites(@Req() req: any, @Query("applicationId") applicationId?: string) {
    return this.invites.list(req.user, applicationId)
  }

  @Post("invites")
  @ApiOperation({ summary: "Recruiter offers interview times" })
  createInvite(@Req() req: any, @Body() dto: CreateInterviewInviteDto) {
    return this.invites.create(req.user, dto)
  }

  @Post("invites/:id/book")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Candidate books one of the offered times" })
  bookInvite(@Req() req: any, @Param("id", uuid) id: string, @Body() dto: BookInterviewSlotDto) {
    return this.invites.book(req.user, id, dto.slotId)
  }

  @Post("invites/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Recruiter withdraws open interview times" })
  cancelInvite(@Req() req: any, @Param("id", uuid) id: string) {
    return this.invites.cancel(req.user, id)
  }

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
