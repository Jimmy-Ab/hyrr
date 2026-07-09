import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Get current seeker profile details' })
  @ApiResponse({ status: 200, description: 'Returns seeker profile details' })
  getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Put()
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Update seeker profile fields' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  updateProfile(@Req() req: any, @Body() body: any) {
    return this.profileService.updateProfile(req.user.userId, body);
  }

  @Post('experience')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Add work experience to seeker profile' })
  @ApiResponse({ status: 201, description: 'Experience added' })
  addExperience(
    @Req() req: any,
    @Body() body: { role: string; company: string; duration: string; desc?: string },
  ) {
    return this.profileService.addExperience(req.user.userId, body);
  }

  @Delete('experience/:id')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Delete work experience from seeker profile' })
  @ApiResponse({ status: 200, description: 'Experience deleted' })
  deleteExperience(@Param('id') id: string, @Req() req: any) {
    return this.profileService.deleteExperience(id, req.user.userId);
  }

  @Post('education')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Add education history to seeker profile' })
  @ApiResponse({ status: 201, description: 'Education history added' })
  addEducation(
    @Req() req: any,
    @Body() body: { school: string; degree: string; duration: string },
  ) {
    return this.profileService.addEducation(req.user.userId, body);
  }

  @Delete('education/:id')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Delete education history from seeker profile' })
  @ApiResponse({ status: 200, description: 'Education history deleted' })
  deleteEducation(@Param('id') id: string, @Req() req: any) {
    return this.profileService.deleteEducation(id, req.user.userId);
  }
}
