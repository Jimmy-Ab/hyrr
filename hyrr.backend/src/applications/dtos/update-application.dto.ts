import { ApiPropertyOptional } from "@nestjs/swagger"
import { ApplicationStatus } from "@prisma/client"
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator"
import { RECRUITER_STATUSES } from "./create-candidate.dto"

export class UpdateApplicationDto {
  @ApiPropertyOptional({
    enum: RECRUITER_STATUSES,
    description: "Recruiter only. SAVED and WITHDRAWN cannot be set through this endpoint.",
  })
  @IsOptional()
  @IsIn(RECRUITER_STATUSES)
  status?: ApplicationStatus

  @ApiPropertyOptional({ example: "Technical Interview", description: "Pipeline sub-stage tag" })
  @IsOptional()
  @IsString()
  tag?: string

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  recruiterBookmarked?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  seekerBookmarked?: boolean

  @ApiPropertyOptional({ example: "$185,000 + equity" })
  @IsOptional()
  @IsString()
  offerAmount?: string

  @ApiPropertyOptional({ example: "Strong React skills..." })
  @IsOptional()
  @IsString()
  notes?: string
}
