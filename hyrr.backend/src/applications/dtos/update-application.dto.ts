import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator"
import { ApplicationStatus } from "@prisma/client"

export class UpdateApplicationDto {
  @ApiPropertyOptional({
    enum: ApplicationStatus,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
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
