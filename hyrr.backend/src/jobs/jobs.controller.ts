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
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { ReplaceQuestionsDto } from "../pipeline/dtos/questions.dto"
import { ScreeningService } from "../pipeline/screening.service"
import { CreateJobDto } from "./dtos/create-job.dto"
import { FeatureJobDto, PublishCostQueryDto } from "./dtos/momentum.dto"
import { SearchPublicJobsDto } from "./dtos/search-public-jobs.dto"
import { UpdateJobDto } from "./dtos/update-job.dto"
import { JobsService } from "./jobs.service"

@ApiTags("Jobs")
@Controller("jobs")
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly screening: ScreeningService
  ) {}

  // ─── Public Endpoints ──────────────────────────────────────────────
  @Get("public")
  @ApiOperation({ summary: "Search and filter active public job listings" })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Case-insensitive search on title, description, location and company name",
  })
  @ApiQuery({ name: "type", required: false, description: "Employment type enum code" })
  @ApiQuery({ name: "category", required: false, description: "Category slug filter" })
  @ApiQuery({ name: "remote", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Returns list of matching job listings" })
  searchPublicJobs(@Query() query: SearchPublicJobsDto) {
    return this.jobsService.searchPublicJobs(
      query.q,
      query.type,
      query.category,
      query.remote === "true"
    )
  }

  @Get("categories")
  @ApiOperation({ summary: "Get all job field categories" })
  @ApiResponse({ status: 200, description: "Returns list of job categories" })
  getCategories() {
    return this.jobsService.getCategories()
  }

  @Get("public/:id")
  @ApiOperation({ summary: "Get a single job listing by ID" })
  @ApiResponse({ status: 200, description: "Returns job details" })
  @ApiResponse({ status: 404, description: "Job not found" })
  getJobById(@Param("id") id: string) {
    return this.jobsService.getJobById(id)
  }

  // ─── Recruiter Protected Endpoints ────────────────────────────────
  @Get("analytics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get real-time hiring funnel analytics for the recruiter" })
  @ApiQuery({ name: "jobId", required: false, description: "Limit the analytics to one job" })
  @ApiResponse({ status: 200, description: "Returns pipeline statistics" })
  getAnalytics(@Req() req: any, @Query("jobId") jobId?: string) {
    return this.jobsService.getAnalytics(
      req.user,
      typeof jobId === "string" && jobId ? jobId : undefined
    )
  }

  // ─── Momentum (credits) ───────────────────────────────────────────
  @Get("publish-cost")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Preview the Momentum cost of publishing a job" })
  @ApiResponse({
    status: 200,
    description: "{ cost, balance, breakdown: { base, multipliers: [{ name, factor }] } }",
  })
  getPublishCost(@Req() req: any, @Query() query: PublishCostQueryDto) {
    return this.jobsService.getPublishCost(req.user, query)
  }

  @Post(":id/feature")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Feature an ACTIVE job for 7/14/30 days (charges Momentum, extends)" })
  @ApiResponse({ status: 201, description: "{ featuredUntil, balance }" })
  @ApiResponse({ status: 402, description: "INSUFFICIENT_CREDITS" })
  @ApiResponse({ status: 409, description: "JOB_NOT_ACTIVE" })
  featureJob(@Param("id") id: string, @Body() dto: FeatureJobDto, @Req() req: any) {
    return this.jobsService.featureJob(id, dto.days, req.user)
  }

  // ─── Screening questions (R1) ─────────────────────────────────────
  @Get(":jobId/questions")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Screening questions (public for ACTIVE jobs)" })
  @ApiResponse({ status: 200, description: "[{ id, question, required, position }]" })
  getQuestions(@Param("jobId") jobId: string, @Req() req: any) {
    return this.screening.list(jobId, req.user || null)
  }

  @Put(":jobId/questions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Replace the job's screening questions (max 10, manage access)" })
  replaceQuestions(
    @Param("jobId") jobId: string,
    @Body() dto: ReplaceQuestionsDto,
    @Req() req: any
  ) {
    return this.screening.replace(jobId, req.user, dto.questions)
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all jobs of the recruiter's company (Recruiter only)" })
  @ApiResponse({ status: 200, description: "Returns list of posted jobs with candidate counts" })
  getMyJobs(@Req() req: any) {
    return this.jobsService.getRecruiterJobs(req.user)
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new job posting (Recruiter only)" })
  @ApiResponse({ status: 201, description: "Job created successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 402, description: "INSUFFICIENT_CREDITS (publishing costs Momentum)" })
  createJob(@Req() req: any, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(req.user.userId, dto)
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a job posting status or details" })
  @ApiResponse({ status: 200, description: "Job updated" })
  updateJob(@Param("id") id: string, @Body() dto: UpdateJobDto, @Req() req: any) {
    return this.jobsService.updateJob(id, dto, req.user)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("RECRUITER", "ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a job posting" })
  @ApiResponse({ status: 200, description: "Job deleted" })
  deleteJob(@Param("id") id: string, @Req() req: any) {
    return this.jobsService.deleteJob(id, req.user)
  }
}
