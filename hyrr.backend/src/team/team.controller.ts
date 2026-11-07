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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import {
  ApproveJoinRequestDto,
  CompanySetupDto,
  DomainMatchQueryDto,
  InviteMemberDto,
  JoinRequestDto,
  TransferOwnershipDto,
} from "./dtos/team.dto"
import { TeamService } from "./team.service"

const uuid = new ParseUUIDPipe({ version: undefined })

/** Owner/member team management (the member list itself stays at GET /talent/team). */
@ApiTags("Team")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("talent/team")
export class TeamManageController {
  constructor(private readonly team: TeamService) {}

  @Get("invites") invites(@Req() req: any) {
    return this.team.listInvites(req.user)
  }
  @Post("invites") invite(@Req() req: any, @Body() dto: InviteMemberDto) {
    return this.team.invite(req.user, dto)
  }
  @Post("invites/:id/resend") @HttpCode(HttpStatus.OK) resend(
    @Req() req: any,
    @Param("id", uuid) id: string
  ) {
    return this.team.resendInvite(req.user, id)
  }
  @Delete("invites/:id") revoke(@Req() req: any, @Param("id", uuid) id: string) {
    return this.team.revokeInvite(req.user, id)
  }

  @Get("join-requests") joinRequests(@Req() req: any) {
    return this.team.listJoinRequests(req.user)
  }
  @Post("join-requests/:id/approve") @HttpCode(HttpStatus.OK) approve(
    @Req() req: any,
    @Param("id", uuid) id: string,
    @Body() dto: ApproveJoinRequestDto
  ) {
    return this.team.approveJoinRequest(req.user, id, dto.role)
  }
  @Post("join-requests/:id/decline") @HttpCode(HttpStatus.OK) decline(
    @Req() req: any,
    @Param("id", uuid) id: string
  ) {
    return this.team.declineJoinRequest(req.user, id)
  }

  @Post("transfer") @HttpCode(HttpStatus.OK) transfer(
    @Req() req: any,
    @Body() dto: TransferOwnershipDto
  ) {
    return this.team.transferOwnership(req.user, dto.memberId)
  }
  @Post("leave") @HttpCode(HttpStatus.OK) leave(@Req() req: any) {
    return this.team.leave(req.user)
  }
}

/** Joining: invite links, domain match, join requests and company setup. */
@ApiTags("Team")
@Controller("team")
export class TeamJoinController {
  constructor(private readonly team: TeamService) {}

  /** Public: what the invite link is for (company, role, masked e-mail). */
  @Get("invites/:token") preview(@Param("token") token: string) {
    return this.team.previewInvite(token)
  }

  /** Public: a verified company on the e-mail's domain (offered at recruiter sign-up). */
  @Get("domain-match") async domainMatch(@Query() q: DomainMatchQueryDto) {
    return { company: await this.team.domainMatch(q.email) }
  }

  @Post("invites/:token/accept")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  accept(@Req() req: any, @Param("token") token: string) {
    return this.team.acceptInvite(req.user, token)
  }
  @Post("invites/:token/decline")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  declineInvite(@Req() req: any, @Param("token") token: string) {
    return this.team.declineInvite(req.user, token)
  }

  @Post("company")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setup(@Req() req: any, @Body() dto: CompanySetupDto) {
    return this.team.setupCompany(req.user, dto)
  }

  @Get("join-request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async mine(@Req() req: any) {
    return { request: await this.team.myJoinRequest(req.user) }
  }
  @Post("join-request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  request(@Req() req: any, @Body() dto: JoinRequestDto) {
    return this.team.requestToJoin(req.user, dto.companyId)
  }
  @Delete("join-request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  cancel(@Req() req: any) {
    return this.team.cancelMyJoinRequest(req.user)
  }
}
