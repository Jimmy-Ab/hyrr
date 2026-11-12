import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator"
import {
  CURRENCIES,
  IfGroupPresent,
  IsGreaterOrEqualTo,
  IsNotFutureMonth,
  RequiredWith,
  SALARY_MAX_VALUE,
  SALARY_PERIODS,
} from "../../core/validation/structured"

const LINK_MESSAGE = "Enter a valid link, e.g. https://example.com"

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const THIS_YEAR = new Date().getUTCFullYear()
const trimString = ({ value }: { value: any }) => (typeof value === "string" ? value.trim() : value)

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

/** Work experience: month precision ("YYYY-MM"); `current` replaces the end month. */
export class ExperienceDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: "Job title is required" })
  @MaxLength(120, { message: "Job title must be at most 120 characters" })
  role: string

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: "Company is required" })
  @MaxLength(120, { message: "Company must be at most 120 characters" })
  company: string

  @Matches(MONTH_PATTERN, { message: "Choose a start month" })
  @IsNotFutureMonth({ message: "Start month can't be in the future" })
  startDate: string

  @ValidateIf((o) => !o.current)
  @Matches(MONTH_PATTERN, { message: 'Choose an end month or tick "I currently work here"' })
  @IsGreaterOrEqualTo("startDate", { message: "End month can't be before the start month" })
  endDate?: string | null

  @IsOptional() @IsBoolean() current?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Description must be at most 2,000 characters" })
  desc?: string

  /** Legacy display text; ignored when dates are sent (the server generates it). */
  @IsOptional() @IsString() @MaxLength(80) duration?: string
}

/** Education: years; no end year = still studying. */
export class EducationDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: "School is required" })
  @MaxLength(160, { message: "School must be at most 160 characters" })
  school: string

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: "Degree is required" })
  @MaxLength(160, { message: "Degree must be at most 160 characters" })
  degree: string

  @IsInt({ message: "Choose a start year" })
  @Min(1950, { message: "Start year must be 1950 or later" })
  @Max(THIS_YEAR, { message: "Start year can't be in the future" })
  startYear: number

  @IfPresent()
  @IsInt({ message: "Choose an end year" })
  @Max(THIS_YEAR + 8, { message: "End year is too far in the future" })
  @IsGreaterOrEqualTo("startYear", { message: "End year can't be before the start year" })
  endYear?: number | null

  /** Legacy display text; ignored when years are sent. */
  @IsOptional() @IsString() @MaxLength(80) duration?: string
}

const SALARY_FIELDS = [
  "expectedSalaryMin",
  "expectedSalaryMax",
  "expectedSalaryCurrency",
  "expectedSalaryPeriod",
]
const otherSalary = (self: string) => SALARY_FIELDS.filter((f) => f !== self)

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: "Name must be at least 2 characters" })
  @MaxLength(120, { message: "Name must be at most 120 characters" })
  name?: string

  // Empty clears the field (Settings saves it blank); a value needs at least 2 characters.
  @ValidateIf((_, v) => v != null && v !== "")
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: "Add a headline, e.g. Frontend Developer" })
  @MaxLength(120, { message: "Headline must be at most 120 characters" })
  title?: string

  @ValidateIf((_, v) => v != null && v !== "")
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: "Add your city or region" })
  @MaxLength(160, { message: "Location must be at most 160 characters" })
  location?: string

  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] }, { message: LINK_MESSAGE })
  @MaxLength(500, { message: "Link must be at most 500 characters" })
  website?: string | null

  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] }, { message: LINK_MESSAGE })
  @MaxLength(500, { message: "Link must be at most 500 characters" })
  github?: string | null

  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] }, { message: LINK_MESSAGE })
  @MaxLength(500, { message: "Link must be at most 500 characters" })
  linkedin?: string | null

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? (sanitizeUrl({ value }) ?? undefined) : value
  )
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  @MaxLength(1000)
  avatar?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: "About must be at most 4,000 characters" })
  bio?: string
  /** Expected salary range: all four together, or all null to clear. */
  @RequiredWith(otherSalary("expectedSalaryMin"), { message: "Enter the minimum expected salary" })
  @IfGroupPresent(SALARY_FIELDS)
  @IsInt({ message: "Salary must be a whole number" })
  @Min(0, { message: "Salary can't be negative" })
  @Max(SALARY_MAX_VALUE, { message: "Salary is too large" })
  expectedSalaryMin?: number | null

  @RequiredWith(otherSalary("expectedSalaryMax"), { message: "Enter the maximum expected salary" })
  @IfGroupPresent(SALARY_FIELDS)
  @IsInt({ message: "Salary must be a whole number" })
  @Min(0, { message: "Salary can't be negative" })
  @Max(SALARY_MAX_VALUE, { message: "Salary is too large" })
  @IsGreaterOrEqualTo("expectedSalaryMin", { message: "Maximum must be at least the minimum" })
  expectedSalaryMax?: number | null

  @RequiredWith(otherSalary("expectedSalaryCurrency"), { message: "Choose a currency" })
  @IfGroupPresent(SALARY_FIELDS)
  @IsIn(CURRENCIES as unknown as string[], { message: "Choose a supported currency" })
  expectedSalaryCurrency?: string | null

  @RequiredWith(otherSalary("expectedSalaryPeriod"), { message: "Choose per year, month or hour" })
  @IfGroupPresent(SALARY_FIELDS)
  @IsIn(SALARY_PERIODS as unknown as string[], { message: "Choose per year, month or hour" })
  expectedSalaryPeriod?: "YEAR" | "MONTH" | "HOUR" | null
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
  @ArrayMaxSize(50, { message: "At most 50 skills" })
  @IsString({ each: true })
  @MaxLength(80, { each: true, message: "Each skill must be at most 80 characters" })
  skills?: string[]
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: "At most 20 languages" })
  @IsString({ each: true })
  @MaxLength(80, { each: true, message: "Each language must be at most 80 characters" })
  languages?: string[]
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: "At most 10 preferred locations" })
  @IsString({ each: true })
  @MaxLength(160, { each: true, message: "Each location must be at most 160 characters" })
  preferredLocations?: string[]
  /** Preferred job categories (JobCategory ids). */
  @IsOptional()
  @IsArray({ message: "Preferred categories must be a list" })
  @ArrayMaxSize(10, { message: "Pick at most 10 preferred categories" })
  @IsString({ each: true, message: "Each preferred category must be a category id" })
  @MaxLength(64, { each: true, message: "Each preferred category must be a category id" })
  interests?: string[]
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: "At most 30 experiences" })
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences?: ExperienceDto[]
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: "At most 20 education entries" })
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations?: EducationDto[]
}
