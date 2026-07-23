import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user settings & notification preferences' })
  @ApiResponse({ status: 200, description: 'Returns user settings' })
  getSettings(@Req() req: any) {
    return this.settingsService.getSettings(req.user.userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update user settings & notification preferences' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  updateSettings(@Req() req: any, @Body() body: any) {
    return this.settingsService.updateSettings(req.user.userId, body);
  }
}
