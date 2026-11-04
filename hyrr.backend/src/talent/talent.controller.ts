import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { AddTeamMemberDto, ReportJobDto } from "./dtos/talent.dto"
import { TalentService } from "./talent.service"

@ApiTags("Talent workflow")
@Controller("talent")
export class TalentController {
  constructor(private readonly talent: TalentService) {}
  @Get("team") @UseGuards(JwtAuthGuard) @ApiBearerAuth() team(@Req() req: any) {
    return this.talent.listTeam(req.user)
  }
  @Post("team") @UseGuards(JwtAuthGuard) @ApiBearerAuth() addTeamMember(
    @Req() req: any,
    @Body() dto: AddTeamMemberDto
  ) {
    return this.talent.addTeamMember(req.user, dto)
  }
  @Delete("team/:memberId") @UseGuards(JwtAuthGuard) @ApiBearerAuth() removeTeamMember(
    @Req() req: any,
    @Param("memberId") memberId: string
  ) {
    return this.talent.removeTeamMember(req.user, memberId)
  }
  @Post("jobs/:jobId/report") @UseGuards(JwtAuthGuard) @ApiBearerAuth() report(
    @Req() req: any,
    @Param("jobId") jobId: string,
    @Body() dto: ReportJobDto
  ) {
    return this.talent.reportJob(req.user, jobId, dto)
  }
}
