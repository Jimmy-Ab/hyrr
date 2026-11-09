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
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import {
  OutreachDto,
  OutreachResponseDto,
  TalentSearchQueryDto,
  TalentVisibilityDto,
} from "./dtos/talent-search.dto"
import { TalentSearchService } from "./talent-search.service"

const uuid = new ParseUUIDPipe({ version: undefined })

@ApiTags("Talent search")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("talent-search")
export class TalentSearchController {
  constructor(private readonly talent: TalentSearchService) {}

  // Seeker settings (declared before :seekerId)
  @Get("visibility") visibility(@Req() req: any) {
    return this.talent.visibility(req.user)
  }
  @Put("visibility") setVisibility(@Req() req: any, @Body() dto: TalentVisibilityDto) {
    return this.talent.setVisibility(req.user, dto.open)
  }
  @Post("outreach/:applicationId/respond") @HttpCode(HttpStatus.OK) respond(
    @Req() req: any,
    @Param("applicationId", uuid) applicationId: string,
    @Body() dto: OutreachResponseDto
  ) {
    return this.talent.respond(req.user, applicationId, dto.interested)
  }
  @Post("outreach/:applicationId/block") @HttpCode(HttpStatus.OK) blockByApplication(
    @Req() req: any,
    @Param("applicationId", uuid) applicationId: string
  ) {
    return this.talent.blockByApplication(req.user, applicationId)
  }
  @Post("companies/:companyId/block") @HttpCode(HttpStatus.OK) block(
    @Req() req: any,
    @Param("companyId", uuid) companyId: string
  ) {
    return this.talent.block(req.user, companyId)
  }
  @Delete("companies/:companyId/block") unblock(
    @Req() req: any,
    @Param("companyId", uuid) companyId: string
  ) {
    return this.talent.unblock(req.user, companyId)
  }

  // Recruiters
  @Get() search(@Req() req: any, @Query() q: TalentSearchQueryDto) {
    return this.talent.search(req.user, q.q, q.location, q.limit)
  }
  @Get(":seekerId") profile(@Req() req: any, @Param("seekerId", uuid) seekerId: string) {
    return this.talent.profile(req.user, seekerId)
  }
  @Post(":seekerId/outreach") outreach(
    @Req() req: any,
    @Param("seekerId", uuid) seekerId: string,
    @Body() dto: OutreachDto
  ) {
    return this.talent.outreach(req.user, seekerId, dto.jobId, dto.message)
  }
}
