import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EducationDto, ExperienceDto, UpdateProfileDto } from './dtos/profile.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) { }

  // ─── Any authenticated role: get basic user + company info ──────────
  @Get('me')
  @ApiOperation({ summary: 'Get current user info + company (any role)' })
  @ApiResponse({ status: 200, description: 'Returns user + company data' })
  getMe(@Req() req: any) {
    return this.profileService.getMe(req.user.userId);
  }

  // ─── Seeker-only endpoints ───────────────────────────────────────────
  @Get()
  @UseGuards(RolesGuard)
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Get current seeker profile details' })
  @ApiResponse({ status: 200, description: 'Returns seeker profile details' })
  getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Update seeker profile fields' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  updateProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.userId, body);
  }

  @Post('experience')
  @UseGuards(RolesGuard)
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Add work experience to seeker profile' })
  @ApiResponse({ status: 201, description: 'Experience added' })
  addExperience(
    @Req() req: any,
    @Body() body: ExperienceDto,
  ) {
    return this.profileService.addExperience(req.user.userId, body);
  }

  @Delete('experience/:id')
  @UseGuards(RolesGuard)
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Delete work experience from seeker profile' })
  @ApiResponse({ status: 200, description: 'Experience deleted' })
  deleteExperience(@Param('id') id: string, @Req() req: any) {
    return this.profileService.deleteExperience(id, req.user.userId);
  }

  @Post('education')
  @UseGuards(RolesGuard)
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Add education history to seeker profile' })
  @ApiResponse({ status: 201, description: 'Education history added' })
  addEducation(
    @Req() req: any,
    @Body() body: EducationDto,
  ) {
    return this.profileService.addEducation(req.user.userId, body);
  }

  @Delete('education/:id')
  @UseGuards(RolesGuard)
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Delete education history from seeker profile' })
  @ApiResponse({ status: 200, description: 'Education history deleted' })
  deleteEducation(@Param('id') id: string, @Req() req: any) {
    return this.profileService.deleteEducation(id, req.user.userId);
  }
}
