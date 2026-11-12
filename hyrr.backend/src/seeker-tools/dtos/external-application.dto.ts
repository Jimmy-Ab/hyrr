import { PartialType } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsIn, IsISO8601, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)
export const EXTERNAL_STAGES = [
  "BOOKMARKED",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
] as const

export class CreateExternalApplicationDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: "Enter the company" })
  @MaxLength(120)
  company: string

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: "Enter the job title" })
  @MaxLength(160)
  title: string

  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { require_protocol: true, protocols: ["http", "https"] },
    { message: "Enter a valid link, e.g. https://…" }
  )
  @MaxLength(500)
  url?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  location?: string

  @IsOptional()
  @IsIn(EXTERNAL_STAGES as unknown as string[], { message: "Choose a stage" })
  stage?: (typeof EXTERNAL_STAGES)[number]

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000, { message: "Notes can be at most 2000 characters" })
  notes?: string

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "Choose a valid date" })
  appliedAt?: string
}

export class UpdateExternalApplicationDto extends PartialType(CreateExternalApplicationDto) {}
