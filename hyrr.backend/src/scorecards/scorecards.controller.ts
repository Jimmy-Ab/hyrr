import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { ScorecardCompetenciesDto, SubmitScorecardDto } from "./dtos/scorecard.dto"
import { ScorecardsService } from "./scorecards.service"

const uuid = new ParseUUIDPipe({ version: undefined })

@ApiTags("Scorecards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("scorecards")
export class ScorecardsController {
  constructor(private readonly scorecards: ScorecardsService) {}

  @Get("applications/:applicationId")
  list(@Req() req: any, @Param("applicationId", uuid) applicationId: string) {
    return this.scorecards.list(req.user, applicationId)
  }

  @Put("applications/:applicationId")
  submit(
    @Req() req: any,
    @Param("applicationId", uuid) applicationId: string,
    @Body() dto: SubmitScorecardDto
  ) {
    return this.scorecards.submit(req.user, applicationId, dto)
  }

  @Put("jobs/:jobId/competencies")
  setCompetencies(
    @Req() req: any,
    @Param("jobId", uuid) jobId: string,
    @Body() dto: ScorecardCompetenciesDto
  ) {
    return this.scorecards.setCompetencies(req.user, jobId, dto.competencies)
  }
}
