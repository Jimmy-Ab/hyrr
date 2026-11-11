import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { MatchingQueryDto } from "./dtos/matching-query.dto"
import { MatchingService } from "./matching.service"

@ApiTags("Matching")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("matching")
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get("jobs")
  @Roles("SEEKER")
  @ApiOperation({ summary: "ACTIVE jobs with a rule-based match score for the seeker" })
  getJobs(@Req() req: any, @Query() query: MatchingQueryDto) {
    return this.matching.getMatchedJobs(
      req.user.userId,
      query.tab ?? "for-you",
      query.limit ?? 50,
      query.cursor
    )
  }
}
