import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger"
import { IsBoolean } from "class-validator"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { SetLabelsDto } from "../pipeline/dtos/labels.dto"
import { NoteBodyDto } from "../pipeline/dtos/notes.dto"
import { LabelsService } from "../pipeline/labels.service"
import { NotesService } from "../pipeline/notes.service"
import { ApplicationsService } from "./applications.service"
import { BulkApplicationsDto } from "./dtos/bulk-applications.dto"
import { CreateApplicationDto } from "./dtos/create-application.dto"
import { CreateCandidateDto } from "./dtos/create-candidate.dto"
import { UpdateApplicationDto } from "./dtos/update-application.dto"

export class AiFeedbackDto {
  @IsBoolean({ message: "Choose helpful or not helpful" })
  helpful: boolean
}

@ApiTags("Applications")
@Controller("applications")
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly notes: NotesService,
    private readonly labels: LabelsService
  ) {}

  // ─── Public/Logged-in: apply to a job (career site or logged-in seeker) ──────
  @Post("jobs/:jobId/apply")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Submit a job application (public career site or logged-in seeker)" })
  @ApiResponse({ status: 201, description: "Application submitted successfully" })
  @ApiResponse({ status: 404, description: "JOB_NOT_FOUND (missing or not ACTIVE)" })
  @ApiResponse({ status: 409, description: "ALREADY_APPLIED" })
  applyToJob(@Param("jobId") jobId: string, @Body() dto: CreateApplicationDto, @Req() req: any) {
    // AI scoring is triggered inside the service (fire-and-forget)
    return this.applicationsService.applyToJob(jobId, dto, req.user || null, req.ip)
  }

  // ─── Recruiter: add a candidate manually ──────────────────────────
  @Post("jobs/:jobId/candidates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add a candidate to a job pipeline (Recruiter only)" })
  @ApiResponse({ status: 201, description: "Candidate created (same shape as GET /candidates)" })
  @ApiResponse({ status: 409, description: "ALREADY_APPLIED" })
  createCandidate(@Param("jobId") jobId: string, @Body() dto: CreateCandidateDto, @Req() req: any) {
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

  // ─── Recruiter: get all company candidates ────────────────────────
  @Get("candidates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all candidates across the company (Recruiter only)" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "take", required: false, description: "Page size (default 200, max 500)" })
  @ApiQuery({ name: "skip", required: false })
  @ApiQuery({ name: "labelId", required: false, description: "Only candidates with this label" })
  @ApiResponse({ status: 200, description: "Returns all company candidates" })
  getAllCandidates(
    @Req() req: any,
    @Query("search") search?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
    @Query("labelId") labelId?: string
  ) {
    return this.applicationsService.getAllCompanyCandidates(
      req.user,
      search,
      { take: take as any, skip: skip as any },
      typeof labelId === "string" && labelId ? labelId : undefined
    )
  }

  // ─── Recruiter: bulk actions (R4) ─────────────────────────────────
  @Post("bulk")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Apply MOVE/ADD_LABEL/REMOVE_LABEL/ARCHIVE/MESSAGE to many candidates" })
  @ApiResponse({ status: 200, description: "{ results: [{ applicationId, ok, error? }] }" })
  bulk(@Body() dto: BulkApplicationsDto, @Req() req: any) {
    return this.applicationsService.bulkUpdate(dto, req.user)
  }

  // ─── Recruiter: notes (R2) ────────────────────────────────────────
  @Patch("notes/:noteId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Edit a note (author only)" })
  updateNote(@Param("noteId") noteId: string, @Body() dto: NoteBodyDto, @Req() req: any) {
    return this.notes.update(noteId, req.user, dto.body)
  }

  @Delete("notes/:noteId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a note (author only)" })
  deleteNote(@Param("noteId") noteId: string, @Req() req: any) {
    return this.notes.remove(noteId, req.user)
  }

  @Get(":id/notes")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Private hiring-team notes on a candidate (newest first)" })
  listNotes(@Param("id") id: string, @Req() req: any) {
    return this.notes.list(id, req.user)
  }

  @Post(":id/notes")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add a note to a candidate (manage access)" })
  addNote(@Param("id") id: string, @Body() dto: NoteBodyDto, @Req() req: any) {
    return this.notes.create(id, req.user, dto.body)
  }

  // ─── Recruiter: labels on a candidate (R3) ────────────────────────
  @Put(":id/labels")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set the candidate's labels (company labels only)" })
  @ApiResponse({ status: 200, description: "{ labels: [{ id, name, color }] }" })
  setLabels(@Param("id") id: string, @Body() dto: SetLabelsDto, @Req() req: any) {
    return this.labels.setForApplication(req.user, id, dto.labelIds)
  }

  // ─── Seeker owner / hiring team: stage timeline (R5) ──────────────
  @Get(":id/timeline")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Stage history (actor names for the hiring team only)" })
  @ApiResponse({ status: 200, description: "[{ status, label, at, actor?: { name } }]" })
  timeline(@Param("id") id: string, @Req() req: any) {
    return this.applicationsService.getTimeline(id, req.user)
  }

  // ─── Recruiter: was the AI analysis helpful? (admin drift signal) ──
  @Post(":id/ai-feedback")
  @ApiOperation({ summary: "Thumbs up/down on the AI candidate analysis (one per recruiter)" })
  aiFeedback(@Param("id") id: string, @Body() body: AiFeedbackDto, @Req() req: any) {
    return this.applicationsService.aiFeedback(id, body.helpful, req.user)
  }

  // ─── Shared: update application status / move Kanban ─────────────
  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update application (move pipeline column, bookmark, offer)" })
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
    summary: "Recruiter: delete candidate. Seeker: unsave (SAVED) or withdraw (any other status)",
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
