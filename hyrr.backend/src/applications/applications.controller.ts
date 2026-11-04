import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { ApplicationsService } from "./applications.service"
import { CreateApplicationDto } from "./dtos/create-application.dto"
import { CreateCandidateDto } from "./dtos/create-candidate.dto"
import { UpdateApplicationDto } from "./dtos/update-application.dto"

@ApiTags("Applications")
@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // ─── Public: tracker by email (no auth required) ──────────────────
  @Get("tracker")
  @ApiOperation({ summary: "Track application status by email (public tracker page)" })
  @ApiQuery({ name: "token", required: true, description: "Tracking token returned when applying" })
  @ApiResponse({ status: 200, description: "Returns the tracked application" })
  getByEmail(@Query("token") token: string) {
    return this.applicationsService.getApplicationsByTrackingToken(token)
  }

  // ─── Public/Logged-in: apply to a job (career site or logged-in seeker) ──────
  @Post("jobs/:jobId/apply")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Submit a job application (public career site or logged-in seeker)" })
  @ApiResponse({ status: 201, description: "Application submitted successfully" })
  @ApiResponse({ status: 404, description: "JOB_NOT_FOUND (missing or not ACTIVE)" })
  @ApiResponse({ status: 409, description: "ALREADY_APPLIED" })
  applyToJob(@Param("jobId") jobId: string, @Body() dto: CreateApplicationDto, @Req() req: any) {
    // AI scoring is triggered inside the service (fire-and-forget)
    return this.applicationsService.applyToJob(jobId, dto, req.user || null)
  }

  // ─── Recruiter: add a candidate manually ──────────────────────────
  @Post("jobs/:jobId/candidates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add a candidate to a job pipeline (Recruiter only)" })
  @ApiResponse({ status: 201, description: "Candidate created (same shape as GET /candidates)" })
  @ApiResponse({ status: 409, description: "ALREADY_APPLIED" })
  createCandidate(
    @Param("jobId") jobId: string,
    @Body() dto: CreateCandidateDto,
    @Req() req: any
  ) {
    return this.applicationsService.createCandidate(jobId, dto, req.user)
  }

  // ─── Seeker: save a job ───────────────────────────────────────────
  @Post("jobs/:jobId/save")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SEEKER")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Save (bookmark) a job without applying (Seeker only)" })
  @ApiResponse({ status: 201, description: "Job saved to applications board" })
  saveJob(@Param("jobId") jobId: string, @Body() dto: CreateApplicationDto, @Req() req: any) {
    return this.applicationsService.saveJob(jobId, dto, req.user.userId)
  }

  // ─── Seeker: get my applications ─────────────────────────────────
  @Get("my")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SEEKER")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all applications for the logged-in seeker" })
  @ApiResponse({ status: 200, description: "Returns seeker application board" })
  getMyApplications(@Req() req: any) {
    return this.applicationsService.getSeekerApplications(req.user.userId)
  }

  // ─── Recruiter: get Kanban board for a specific job ───────────────
  @Get("jobs/:jobId/candidates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all candidates in Kanban pipeline for a job (Recruiter only)" })
  @ApiQuery({ name: "take", required: false, description: "Page size (default 200, max 500)" })
  @ApiQuery({ name: "skip", required: false })
  @ApiResponse({ status: 200, description: "Returns candidate pipeline columns" })
  getCandidatesForJob(
    @Param("jobId") jobId: string,
    @Req() req: any,
    @Query("take") take?: string,
    @Query("skip") skip?: string
  ) {
    return this.applicationsService.getCandidatesForJob(jobId, req.user, {
      take: take as any,
      skip: skip as any,
    })
  }

  // ─── Recruiter: get all company candidates ────────────────────────
  @Get("candidates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all candidates across the company (Recruiter only)" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "take", required: false, description: "Page size (default 200, max 500)" })
  @ApiQuery({ name: "skip", required: false })
  @ApiResponse({ status: 200, description: "Returns all company candidates" })
  getAllCandidates(
    @Req() req: any,
    @Query("search") search?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string
  ) {
    return this.applicationsService.getAllCompanyCandidates(req.user, search, {
      take: take as any,
      skip: skip as any,
    })
  }

  // ─── Shared: update application status / move Kanban ─────────────
  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update application (move pipeline column, bookmark, add notes)" })
  @ApiResponse({ status: 200, description: "Application updated" })
  @ApiResponse({ status: 409, description: "APPLICATION_WITHDRAWN" })
  updateApplication(@Param("id") id: string, @Body() dto: UpdateApplicationDto, @Req() req: any) {
    return this.applicationsService.updateApplication(id, dto, req.user)
  }

  // ─── Recruiter: delete candidate · Seeker: unsave / withdraw ─────
  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Recruiter: delete candidate. Seeker: unsave (SAVED) or withdraw (any other status)",
  })
  @ApiResponse({ status: 200, description: "{ id, deleted: true } or { id, status: WITHDRAWN }" })
  deleteApplication(@Param("id") id: string, @Req() req: any) {
    return this.applicationsService.deleteApplication(id, req.user)
  }

  // ─── Recruiter: (re-)run AI analysis ──────────────────────────────
  @Post(":id/analyze")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Start (or retry) the AI analysis of a candidate (manage access)" })
  @ApiResponse({ status: 202, description: "{ applicationId, aiStatus: PENDING }" })
  @ApiResponse({ status: 409, description: "AI_ALREADY_RUNNING" })
  @ApiResponse({ status: 503, description: "AI_DISABLED (no AI provider key configured)" })
  analyzeApplication(@Param("id") id: string, @Req() req: any) {
    return this.applicationsService.analyzeApplication(id, req.user)
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a single application by ID" })
  getApplication(@Param("id") id: string, @Req() req: any) {
    return this.applicationsService.getApplicationById(id, req.user)
  }
}
