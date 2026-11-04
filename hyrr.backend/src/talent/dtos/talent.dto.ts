import { AlertFrequency, CompanyMemberRole } from "@prisma/client"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator"

export class CreateScreeningQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question: string
  @IsOptional()
  @IsBoolean()
  required?: boolean
}

export class SubmitScreeningAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  answer: string
}

export class CreateCandidateLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string
}

export class CreateApplicationNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string
}

export const ASSIGNABLE_TEAM_ROLES = [
  CompanyMemberRole.RECRUITER,
  CompanyMemberRole.HIRING_MANAGER,
  CompanyMemberRole.VIEWER,
] as const

export class AddTeamMemberDto {
  @IsEmail()
  @MaxLength(254)
  email: string
  @IsIn(ASSIGNABLE_TEAM_ROLES as unknown as string[])
  role: "RECRUITER" | "HIRING_MANAGER" | "VIEWER"
}

export class CreateJobAlertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keywords?: string[]
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  locations?: string[]
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  jobTypes?: string[]
  @IsOptional()
  @IsString()
  minSalary?: string
  @IsOptional()
  @IsBoolean()
  remoteOnly?: boolean
  @IsOptional()
  @IsEnum(AlertFrequency)
  frequency?: AlertFrequency
}

export class CreateSavedSearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string
  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string
  @IsObject()
  filters: Record<string, unknown>
}

export const JOB_REPORT_REASONS = [
  "SCAM",
  "MISLEADING",
  "DISCRIMINATORY",
  "DUPLICATE",
  "OTHER",
] as const
export type JobReportReason = (typeof JOB_REPORT_REASONS)[number]

export class ReportJobDto {
  @IsIn(JOB_REPORT_REASONS as unknown as string[])
  reason: JobReportReason
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string
}
