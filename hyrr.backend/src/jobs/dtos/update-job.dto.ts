import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsEnum, IsOptional, IsString } from "class-validator"
import { JobStatus } from "@prisma/client"

export class UpdateJobDto {
  @ApiPropertyOptional({ example: JobStatus.CLOSED, enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus

  @ApiPropertyOptional({ example: "Updated job title" })
  @IsOptional()
  @IsString()
  title?: string

  @ApiPropertyOptional({ example: "New description..." })
  @IsOptional()
  @IsString()
  description?: string
}
