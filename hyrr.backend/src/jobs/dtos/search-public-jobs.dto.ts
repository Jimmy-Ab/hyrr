import { ApiPropertyOptional } from "@nestjs/swagger"
import { EmploymentType } from "@prisma/client"
import { IsBooleanString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator"

/** Query contract for public listings. API consumers use enum codes, not display labels. */
export class SearchPublicJobsDto {
  @ApiPropertyOptional({ description: "Full-text job, company, or skill search" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  type?: EmploymentType

  @ApiPropertyOptional({ description: "Job category slug" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string

  @ApiPropertyOptional({ enum: ["true", "false"] })
  @IsOptional()
  @IsBooleanString()
  remote?: "true" | "false"
}
