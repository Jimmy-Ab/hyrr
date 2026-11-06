import { ApiPropertyOptional } from "@nestjs/swagger"
import { EmploymentType } from "@prisma/client"
import { Type } from "class-transformer"
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator"

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

  @ApiPropertyOptional({ description: "Page size (default 50, max 100)", minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ description: "Results to skip (total in X-Total-Count)", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset?: number
}
