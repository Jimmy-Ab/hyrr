import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsBoolean, IsIn, IsOptional } from "class-validator"

export const THEMES = ["light", "dark", "system"] as const
export type Theme = (typeof THEMES)[number]

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() emailNotifications?: boolean
  @IsOptional() @IsBoolean() smsNotifications?: boolean
  @IsOptional() @IsBoolean() marketingEmails?: boolean
  @IsOptional() @IsBoolean() applicationUpdates?: boolean
  @IsOptional() @IsBoolean() interviewReminders?: boolean
  @IsOptional() @IsBoolean() offerNotifications?: boolean
  @IsOptional() @IsBoolean() messageNotifications?: boolean
  @IsOptional() @IsBoolean() jobRecommendations?: boolean
  @IsOptional() @IsBoolean() weeklyDigest?: boolean
  @IsOptional() @IsBoolean() profilePublic?: boolean
  @IsOptional() @IsBoolean() resumeVisible?: boolean
  @IsOptional() @IsBoolean() showActivity?: boolean

  @ApiPropertyOptional({ enum: THEMES })
  @IsOptional()
  @IsIn(THEMES as unknown as string[])
  theme?: Theme
}

export const SETTINGS_FIELDS: (keyof UpdateSettingsDto)[] = [
  "emailNotifications",
  "smsNotifications",
  "marketingEmails",
  "applicationUpdates",
  "interviewReminders",
  "offerNotifications",
  "messageNotifications",
  "jobRecommendations",
  "weeklyDigest",
  "profilePublic",
  "resumeVisible",
  "showActivity",
  "theme",
]
