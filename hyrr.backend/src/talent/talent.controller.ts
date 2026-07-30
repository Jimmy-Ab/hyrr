import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TalentService } from './talent.service';
import { AddTeamMemberDto, CreateApplicationNoteDto, CreateCandidateLabelDto, CreateJobAlertDto, CreateSavedSearchDto, CreateScreeningQuestionDto, ReportJobDto, ResumeSuggestionDto, SubmitScreeningAnswerDto } from './dtos/talent.dto';

@ApiTags('Talent workflow')
@Controller('talent')
export class TalentController {
  constructor(private readonly talent: TalentService) { }
  @Get('jobs/:jobId/questions') questions(@Param('jobId') jobId: string) { return this.talent.getScreeningQuestions(jobId); }
  @Post('jobs/:jobId/questions') @UseGuards(JwtAuthGuard) @ApiBearerAuth() addQuestion(@Req() req: any, @Param('jobId') jobId: string, @Body() dto: CreateScreeningQuestionDto) { return this.talent.addScreeningQuestion(req.user, jobId, dto); }
  @Post('applications/:id/answers/:questionId') @UseGuards(JwtAuthGuard) @ApiBearerAuth() answer(@Req() req: any, @Param('id') id: string, @Param('questionId') questionId: string, @Body() dto: SubmitScreeningAnswerDto) { return this.talent.submitAnswer(req.user, id, questionId, dto.answer); }
  @Get('labels') @UseGuards(JwtAuthGuard) @ApiBearerAuth() labels(@Req() req: any) { return this.talent.listLabels(req.user); }
  @Post('labels') @UseGuards(JwtAuthGuard) @ApiBearerAuth() label(@Req() req: any, @Body() dto: CreateCandidateLabelDto) { return this.talent.createLabel(req.user, dto); }
  @Post('applications/:id/labels/:labelId') @UseGuards(JwtAuthGuard) @ApiBearerAuth() attachLabel(@Req() req: any, @Param('id') id: string, @Param('labelId') labelId: string) { return this.talent.attachLabel(req.user, id, labelId); }
  @Get('applications/:id/notes') @UseGuards(JwtAuthGuard) @ApiBearerAuth() notes(@Req() req: any, @Param('id') id: string) { return this.talent.listNotes(req.user, id); }
  @Post('applications/:id/notes') @UseGuards(JwtAuthGuard) @ApiBearerAuth() note(@Req() req: any, @Param('id') id: string, @Body() dto: CreateApplicationNoteDto) { return this.talent.addNote(req.user, id, dto.body); }
  @Get('team') @UseGuards(JwtAuthGuard) @ApiBearerAuth() team(@Req() req: any) { return this.talent.listTeam(req.user); }
  @Post('team') @UseGuards(JwtAuthGuard) @ApiBearerAuth() addTeamMember(@Req() req: any, @Body() dto: AddTeamMemberDto) { return this.talent.addTeamMember(req.user, dto); }
  @Post('applications/:id/tracking-link') @UseGuards(JwtAuthGuard) @ApiBearerAuth() trackingLink(@Req() req: any, @Param('id') id: string) { return this.talent.createTrackingLink(req.user, id); }
  @Get('tracking/:token') tracking(@Param('token') token: string) { return this.talent.publicTrackingStatus(token); }
  @Get('alerts') @UseGuards(JwtAuthGuard) @ApiBearerAuth() alerts(@Req() req: any) { return this.talent.listAlerts(req.user); }
  @Post('alerts') @UseGuards(JwtAuthGuard) @ApiBearerAuth() alert(@Req() req: any, @Body() dto: CreateJobAlertDto) { return this.talent.createAlert(req.user, dto); }
  @Post('resume-suggestions') @UseGuards(JwtAuthGuard) @ApiBearerAuth() resumeSuggestions(@Req() req: any, @Body() dto: ResumeSuggestionDto) { return this.talent.resumeSuggestions(req.user, dto.resumeText); }
  @Get('saved-searches') @UseGuards(JwtAuthGuard) @ApiBearerAuth() searches(@Req() req: any) { return this.talent.listSavedSearches(req.user); }
  @Post('saved-searches') @UseGuards(JwtAuthGuard) @ApiBearerAuth() search(@Req() req: any, @Body() dto: CreateSavedSearchDto) { return this.talent.createSavedSearch(req.user, dto); }
  @Post('jobs/:jobId/report') @UseGuards(JwtAuthGuard) @ApiBearerAuth() report(@Req() req: any, @Param('jobId') jobId: string, @Body() dto: ReportJobDto) { return this.talent.reportJob(req.user, jobId, dto); }
  @Get('analytics') @UseGuards(JwtAuthGuard) @ApiBearerAuth() analytics(@Req() req: any) { return this.talent.analytics(req.user); }
  @Get('subscription') @UseGuards(JwtAuthGuard) @ApiBearerAuth() subscription(@Req() req: any) { return this.talent.subscription(req.user); }
}
