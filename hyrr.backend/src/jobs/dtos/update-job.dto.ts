import { ApiPropertyOptional } from "@nestjs/swagger"
import { EmploymentType, JobStatus } from "@prisma/client"
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator"

/** Partial job update. Recruiters may set status ACTIVE|CLOSED|DRAFT; FLAGGED is admin-only. */
export class UpdateJobDto {
  @ApiPropertyOptional({ example: JobStatus.CLOSED, enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus

  @ApiPropertyOptional({ example: "Updated job title" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional({ example: "New description..." })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ example: "Remote, EU" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string

  @ApiPropertyOptional({ example: "$120k – $180k" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  salary?: string

  @ApiPropertyOptional({ description: "Composed into `salary` when `salary` is not sent" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number

  @ApiPropertyOptional({ description: "Composed into `salary` when `salary` is not sent" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  type?: EmploymentType

  @ApiPropertyOptional({ enum: EmploymentType, description: "Alias of `type`" })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  remote?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string
}
