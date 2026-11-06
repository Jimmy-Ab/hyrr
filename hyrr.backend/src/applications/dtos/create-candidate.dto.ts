import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { ApplicationStatus } from "@prisma/client"
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator"
import { UPLOAD_URL_MESSAGE, UPLOAD_URL_PATTERN } from "./create-application.dto"

/** Pipeline statuses a recruiter may assign (never SAVED or WITHDRAWN). */
export const RECRUITER_STATUSES = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.IN_PROCESS,
  ApplicationStatus.INTERVIEWING,
  ApplicationStatus.OFFER,
  ApplicationStatus.ARCHIVED,
] as const
export type RecruiterStatus = (typeof RECRUITER_STATUSES)[number]

/** Recruiter adds a candidate to a job pipeline manually (no seeker account is linked). */
export class CreateCandidateDto {
  @ApiProperty({ example: "Emily Carter" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  candidateName: string

  @ApiProperty({ example: "emily@example.com" })
  @IsEmail()
  email: string

  @ApiPropertyOptional({ example: "+1 555 123 4567" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @ApiPropertyOptional({ example: "Senior Frontend Engineer" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string

  @ApiPropertyOptional({ example: "Berlin, DE" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(UPLOAD_URL_PATTERN, { message: UPLOAD_URL_MESSAGE })
  resumeUrl?: string

  @ApiPropertyOptional({ enum: RECRUITER_STATUSES, default: ApplicationStatus.APPLIED })
  @IsOptional()
  @IsIn(RECRUITER_STATUSES)
  status?: RecruiterStatus
}
