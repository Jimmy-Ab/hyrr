import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { EmploymentType, JobStatus } from "@prisma/client"
import { IsArray, IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator"

/** Statuses a job may be created with; DRAFT skips the publish gate (e-mail verification). */
export const CREATE_JOB_STATUSES = [JobStatus.ACTIVE, JobStatus.DRAFT] as const

export class CreateJobDto {
  @ApiProperty({ example: "Senior Frontend Developer", description: "Job title" })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiProperty({ example: "San Francisco, CA", description: "Job location" })
  @IsString()
  @IsNotEmpty()
  location: string

  @ApiProperty({ example: EmploymentType.FULL_TIME, enum: EmploymentType })
  @IsEnum(EmploymentType)
  @IsNotEmpty()
  type: EmploymentType

  @ApiPropertyOptional({ example: "$120k – $180k", description: "Salary range" })
  @IsOptional()
  @IsString()
  salary?: string

  @ApiProperty({ example: "We are looking for a...", description: "Full job description" })
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({ example: ["5+ years React experience", "TypeScript proficiency"], type: [String] })
  @IsArray()
  requirements: string[]

  @ApiProperty({ example: ["React", "TypeScript", "Next.js"], type: [String] })
  @IsArray()
  skills: string[]

  @ApiPropertyOptional({ example: ["Unlimited PTO", "Equity"], type: [String] })
  @IsOptional()
  @IsArray()
  benefits?: string[]

  @ApiProperty({ example: "cat-uuid-123", description: "Category ID from /categories" })
  @IsString()
  @IsNotEmpty()
  categoryId: string

  @ApiPropertyOptional({ example: false })
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
