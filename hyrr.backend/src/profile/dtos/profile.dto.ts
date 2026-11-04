import { Transform, Type } from "class-transformer"
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator"

/**
 * Link normalisation: `""`/whitespace/null → `null` (clears the stored link), a bare domain gets
 * `https://`, anything that is not a string is left untouched for the validator to reject.
 */
export const sanitizeUrl = ({ value }: { value: any }) => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const trimToNull = ({ value }: { value: any }) => {
  if (value === null) return null
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Validate only when a non-null value is present (null means "clear"). */
const IfPresent = () => ValidateIf((_o, value) => value !== undefined && value !== null)

export class ExperienceDto {
  @IsString() @MaxLength(120) role: string
  @IsString() @MaxLength(120) company: string
  @IsString() @MaxLength(80) duration: string
  @IsOptional() @IsString() @MaxLength(2000) desc?: string
}

export class EducationDto {
  @IsString() @MaxLength(160) school: string
  @IsString() @MaxLength(160) degree: string
  @IsString() @MaxLength(80) duration: string
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string
  @IsOptional() @IsString() @MaxLength(120) title?: string
  @IsOptional() @IsString() @MaxLength(160) location?: string

  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(500)
  website?: string | null

  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(500)
  github?: string | null

  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(500)
  linkedin?: string | null

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? sanitizeUrl({ value }) ?? undefined : value))
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(1000)
  avatar?: string

  @IsOptional() @IsString() @MaxLength(4000) bio?: string
  @IsOptional() @IsString() @MaxLength(100) expectedSalary?: string
  @IsOptional() @IsString() @MaxLength(60) preferredType?: string
  @IsOptional() @IsString() @MaxLength(120) availability?: string
  @IsOptional() @IsIn(["public", "private"]) visibility?: string
  @Transform(trimToNull)
  @IfPresent()
  @IsString()
  @Matches(/^\+?[0-9 ()\-.]{6,25}$/, {
    message: "phone must contain only digits, spaces and + ( ) - . (6-25 characters)",
  })
  phone?: string | null

  @Transform(({ value }) => (typeof value === "number" ? String(value) : trimToNull({ value })))
  @IfPresent()
  @IsString()
  @Matches(/^(\d{1,2}(\.\d)?\+?|\d{1,2}\s*-\s*\d{1,2})$/, {
    message: 'yearsOfExperience must be a number of years such as "3", "5+" or "2-4"',
  })
  yearsOfExperience?: string | null
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  skills?: string[]
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  languages?: string[]
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  preferredLocations?: string[]
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[]
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences?: ExperienceDto[]
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations?: EducationDto[]
}
