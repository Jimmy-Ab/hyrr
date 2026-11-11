import { ApiPropertyOptional } from "@nestjs/swagger"
import { EmploymentType, JobStatus } from "@prisma/client"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator"
import { JobSalaryFields } from "./job-salary.dto"

/** Partial job update. Recruiters may set status ACTIVE|CLOSED|DRAFT; FLAGGED is admin-only. */
export class UpdateJobDto extends JobSalaryFields {
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

  @ApiPropertyOptional({ example: ["English", "Amharic"], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: "Add at least one language" })
  @ArrayMaxSize(5, { message: "At most 5 languages" })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: "Languages can't be empty" })
  @MaxLength(40, { each: true, message: "Each language must be at most 40 characters" })
  languages?: string[]

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
