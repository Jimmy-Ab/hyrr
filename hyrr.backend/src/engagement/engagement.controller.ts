import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import {
  CreateAvailabilityDto,
  CreateEmailTemplateDto,
  ReserveAvailabilityDto,
} from "./dtos/engagement.dto"
import { EngagementService } from "./engagement.service"

@ApiTags("Engagement")
@Controller("engagement")
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}
  @Get("templates") @UseGuards(JwtAuthGuard) @ApiBearerAuth() templates(@Req() req: any) {
    return this.engagement.templates(req.user)
  }
  @Post("templates") @UseGuards(JwtAuthGuard) @ApiBearerAuth() createTemplate(
    @Req() req: any,
    @Body() dto: CreateEmailTemplateDto
  ) {
    return this.engagement.createTemplate(req.user, dto)
  }
  @Post("templates/:id/preview") @UseGuards(JwtAuthGuard) @ApiBearerAuth() preview(
    @Req() req: any,
    @Param("id") id: string,
    @Body() context: Record<string, string>
  ) {
    return this.engagement.previewTemplate(req.user, id, context)
  }
  @Post("templates/:id/send/:applicationId") @UseGuards(JwtAuthGuard) @ApiBearerAuth() send(
    @Req() req: any,
    @Param("id") id: string,
    @Param("applicationId") applicationId: string
  ) {
    return this.engagement.sendTemplate(req.user, id, applicationId)
  }
  @Get("jobs/:jobId/availability") slots(@Param("jobId") jobId: string) {
    return this.engagement.availableSlots(jobId)
  }
  @Post("jobs/:jobId/availability") @UseGuards(JwtAuthGuard) @ApiBearerAuth() addSlot(
    @Req() req: any,
    @Param("jobId") jobId: string,
    @Body() dto: CreateAvailabilityDto
  ) {
    return this.engagement.createAvailability(req.user, jobId, dto)
  }
  @Post("availability/:id/reserve") @UseGuards(JwtAuthGuard) @ApiBearerAuth() reserve(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ReserveAvailabilityDto
  ) {
    return this.engagement.reserveSlot(req.user, id, dto.applicationId)
  }
}
