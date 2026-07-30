import { IsBoolean, IsIn, IsOptional } from 'class-validator';
export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() emailNotifications?: boolean;
  @IsOptional() @IsBoolean() smsNotifications?: boolean;
  @IsOptional() @IsBoolean() marketingEmails?: boolean;
  @IsOptional() @IsBoolean() applicationUpdates?: boolean;
  @IsOptional() @IsBoolean() interviewReminders?: boolean;
  @IsOptional() @IsBoolean() offerNotifications?: boolean;
  @IsOptional() @IsBoolean() messageNotifications?: boolean;
  @IsOptional() @IsBoolean() jobRecommendations?: boolean;
  @IsOptional() @IsBoolean() weeklyDigest?: boolean;
  @IsOptional() @IsBoolean() profilePublic?: boolean;
  @IsOptional() @IsBoolean() resumeVisible?: boolean;
  @IsOptional() @IsBoolean() showActivity?: boolean;
  @IsOptional() @IsIn(['light', 'dark', 'system']) theme?: string;
}
