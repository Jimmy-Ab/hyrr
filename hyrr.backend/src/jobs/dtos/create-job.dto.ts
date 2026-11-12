import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { EmploymentType, JobStatus } from "@prisma/client"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator"
import { JobSalaryFields } from "./job-salary.dto"

/** Statuses a job may be created with; DRAFT skips the publish gate (e-mail verification). */
export const CREATE_JOB_STATUSES = [JobStatus.ACTIVE, JobStatus.DRAFT] as const

export class CreateJobDto extends JobSalaryFields {
  @ApiProperty({ example: "Senior Frontend Developer", description: "Job title" })
  @IsString()
  @IsNotEmpty({ message: "Job title is required" })
  @MinLength(3, { message: "Job title must be at least 3 characters" })
  @MaxLength(200, { message: "Job title must be at most 200 characters" })
  title: string

  @ApiProperty({ example: "San Francisco, CA", description: "Job location" })
  @IsString()
  @IsNotEmpty({ message: "Location is required" })
  @MaxLength(200, { message: "Location must be at most 200 characters" })
  location: string

  @ApiProperty({ example: EmploymentType.FULL_TIME, enum: EmploymentType })
  @IsEnum(EmploymentType)
  @IsNotEmpty()
  type: EmploymentType

  @ApiProperty({ example: "We are looking for a...", description: "Full job description" })
  @IsString()
  @IsNotEmpty({ message: "Description is required" })
  @MinLength(20, { message: "Description must be at least 20 characters" })
  @MaxLength(20000, { message: "Description must be at most 20,000 characters" })
  description: string

  @ApiProperty({ example: ["5+ years React experience", "TypeScript proficiency"], type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: "Add at least one requirement" })
  @ArrayMaxSize(30, { message: "At most 30 requirements" })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: "Requirements can't be empty" })
  @MaxLength(300, { each: true, message: "Each requirement must be at most 300 characters" })
  requirements: string[]

  @ApiProperty({ example: ["React", "TypeScript", "Next.js"], type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: "Add at least one skill" })
  @ArrayMaxSize(30, { message: "At most 30 skills" })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: "Skills can't be empty" })
  @MaxLength(60, { each: true, message: "Each skill must be at most 60 characters" })
  skills: string[]

  @ApiPropertyOptional({ example: ["English", "Amharic"], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: "Add at least one language" })
  @ArrayMaxSize(5, { message: "At most 5 languages" })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: "Languages can't be empty" })
  @MaxLength(40, { each: true, message: "Each language must be at most 40 characters" })
  languages?: string[]

  @ApiPropertyOptional({ example: ["Unlimited PTO", "Equity"], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: "At most 30 benefits" })
  @IsString({ each: true })
  @MaxLength(200, { each: true, message: "Each benefit must be at most 200 characters" })
  benefits?: string[]

  @ApiProperty({ example: "cat-uuid-123", description: "Category ID from /categories" })
  @IsString()
  @IsNotEmpty({ message: "Choose a category" })
  categoryId: string

  /** Deprecated and ignored: featuring is bought via POST /jobs/:id/feature (Momentum). */
  @ApiPropertyOptional({ deprecated: true, description: "Ignored; use POST /jobs/:id/feature" })
  @IsOptional()
  @IsBoolean()
  featured?: boolean

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  remote?: boolean

  @ApiPropertyOptional({ enum: CREATE_JOB_STATUSES, default: JobStatus.ACTIVE })
  @IsOptional()
  @IsIn(CREATE_JOB_STATUSES as unknown as string[])
  status?: "ACTIVE" | "DRAFT"
}
