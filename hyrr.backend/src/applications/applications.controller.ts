import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger"
import { AiService } from "../ai/ai.service"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { ApplicationStatus } from "@prisma/client"
import { ApplicationsService } from "./applications.service"
import { CreateApplicationDto } from "./dtos/create-application.dto"
import { UpdateApplicationDto } from "./dtos/update-application.dto"

@ApiTags("Applications")
@Controller("applications")
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly aiService: AiService
  ) {}

  // ─── Public: tracker by email (no auth required) ──────────────────
  @Get("tracker")
  @ApiOperation({ summary: "Track application status by email (public tracker page)" })
  @ApiQuery({ name: "email", required: true, description: "Email used when applying" })
  @ApiResponse({ status: 200, description: "Returns applications matching the email" })
  getByEmail(@Query("token") token: string) {
    return this.applicationsService.getApplicationsByTrackingToken(token)
  }

  // ─── Public/Logged-in: apply to a job (career site or logged-in seeker) ──────
  @Post("jobs/:jobId/apply")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Submit a job application (public career site or logged-in seeker)" })
  @ApiResponse({ status: 201, description: "Application submitted successfully" })
  async applyToJob(
    @Param("jobId") jobId: string,
    @Body() dto: CreateApplicationDto,
    @Req() req: any
  ) {
    const userId = req.user?.userId
    const application = await this.applicationsService.applyToJob(jobId, dto, userId)
    // Trigger AI scoring asynchronously (fire-and-forget)
    this.aiService.scoreApplication(application.id).catch(() => {})
    return application
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
  @ApiResponse({ status: 200, description: "Returns candidate pipeline columns" })
  getCandidatesForJob(@Param("jobId") jobId: string, @Req() req: any) {
    return this.applicationsService.getCandidatesForJob(jobId, req.user)
  }

  // ─── Recruiter: get all company candidates ────────────────────────
  @Get("candidates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all candidates across the company (Recruiter only)" })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Returns all company candidates" })
  getAllCandidates(@Req() req: any, @Query("search") search?: string) {
    return this.applicationsService.getAllCompanyCandidates(
      req.user.companyId,
      req.user.userId,
      search
    )
  }

  // ─── Shared: update application status / move Kanban ─────────────
  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update application (move pipeline column, bookmark, add notes)" })
  @ApiResponse({ status: 200, description: "Application updated" })
  async updateApplication(
    @Param("id") id: string,
    @Body() dto: UpdateApplicationDto,
    @Req() req: any
  ) {
    const updated = await this.applicationsService.updateApplication(id, dto, req.user)
    // Re-score on significant status changes
    if (dto.status && dto.status !== ApplicationStatus.SAVED) {
      this.aiService.scoreApplication(id).catch(() => {})
    }
    return updated
  }

  // ─── Recruiter: delete candidate ─────────────────────────────────
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a candidate application (Recruiter only)" })
  @ApiResponse({ status: 200, description: "Application deleted" })
  deleteApplication(@Param("id") id: string, @Req() req: any) {
    return this.applicationsService.deleteApplication(id, req.user)
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a single application by ID" })
  getApplication(@Param("id") id: string, @Req() req: any) {
    return this.applicationsService.getApplicationById(id, req.user)
  }
}
