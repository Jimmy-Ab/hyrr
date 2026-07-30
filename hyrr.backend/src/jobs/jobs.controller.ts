import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dtos/create-job.dto';
import { UpdateJobDto } from './dtos/update-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ─── Public Endpoints ──────────────────────────────────────────────
  @Get('public')
  @ApiOperation({ summary: 'Search and filter active public job listings' })
  @ApiQuery({ name: 'q', required: false, description: 'Full-text search query' })
  @ApiQuery({ name: 'type', required: false, description: 'Job type filter (Full Time, Remote, etc.)' })
  @ApiQuery({ name: 'category', required: false, description: 'Category slug filter' })
  @ApiQuery({ name: 'remote', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Returns list of matching job listings' })
  searchPublicJobs(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('remote') remote?: string,
  ) {
    return this.jobsService.searchPublicJobs(q, type, category, remote === 'true');
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all job field categories' })
  @ApiResponse({ status: 200, description: 'Returns list of job categories' })
  getCategories() {
    return this.jobsService.getCategories();
  }

  @Get('public/:id')
  @ApiOperation({ summary: 'Get a single job listing by ID' })
  @ApiResponse({ status: 200, description: 'Returns job details' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  getJobById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }

  // ─── Recruiter Protected Endpoints ────────────────────────────────
  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get real-time hiring funnel analytics for the recruiter' })
  @ApiResponse({ status: 200, description: 'Returns pipeline statistics' })
  getAnalytics(@Req() req: any) {
    return this.jobsService.getAnalytics(req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all jobs posted by the recruiter (Recruiter only)' })
  @ApiResponse({ status: 200, description: 'Returns list of posted jobs with candidate counts' })
  getMyJobs(@Req() req: any) {
    return this.jobsService.getRecruiterJobs(req.user.userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new job posting (Recruiter only)' })
  @ApiResponse({ status: 201, description: 'Job created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createJob(@Req() req: any, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(req.user.userId, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a job posting status or details' })
  @ApiResponse({ status: 200, description: 'Job updated' })
  updateJob(@Param('id') id: string, @Body() dto: UpdateJobDto, @Req() req: any) {
    return this.jobsService.updateJob(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a job posting' })
  @ApiResponse({ status: 200, description: 'Job deleted' })
  deleteJob(@Param('id') id: string, @Req() req: any) {
    return this.jobsService.deleteJob(id, req.user);
  }
}
