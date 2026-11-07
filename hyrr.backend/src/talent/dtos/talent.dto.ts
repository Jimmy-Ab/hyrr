import { CompanyMemberRole } from "@prisma/client"
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"

export const ASSIGNABLE_TEAM_ROLES = [
  CompanyMemberRole.RECRUITER,
  CompanyMemberRole.HIRING_MANAGER,
  CompanyMemberRole.VIEWER,
] as const

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
