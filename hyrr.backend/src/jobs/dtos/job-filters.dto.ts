import { EmploymentType, SalaryPeriod } from "@prisma/client"
import { Type } from "class-transformer"
import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator"
import { CURRENCIES, IsGreaterOrEqualTo, SALARY_MAX_VALUE } from "../../core/validation/structured"

export const POSTED_WITHIN_DAYS = [1, 3, 7, 14, 30] as const

/**
 * Discover filters shared by Hyrr jobs (GET /matching/jobs) and jobs from the web
 * (GET /external-jobs). Mirrored by `jobFiltersSchema` in hyrr.shared/src/lib/validation.ts.
 */
export class JobFiltersDto {
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: "Pick a category from the list" })
  categoryId?: string

  @IsOptional()
  @IsBooleanString({ message: "Remote must be true or false" })
  remote?: "true" | "false"

  @IsOptional()
  @IsEnum(EmploymentType, { message: "Pick an employment type from the list" })
  type?: EmploymentType

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Minimum salary must be a whole number" })
  @Min(0, { message: "Minimum salary can't be negative" })
  @Max(SALARY_MAX_VALUE, { message: "Minimum salary is too large" })
  salaryMin?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Maximum salary must be a whole number" })
  @Min(0, { message: "Maximum salary can't be negative" })
  @Max(SALARY_MAX_VALUE, { message: "Maximum salary is too large" })
  @IsGreaterOrEqualTo("salaryMin", { message: "Maximum must be at least the minimum" })
  salaryMax?: number

  @ValidateIf((o) => o.salaryMin != null || o.salaryMax != null)
  @IsIn(CURRENCIES as readonly string[], { message: "Pick a currency for the salary filter" })
  salaryCurrency?: string

  @ValidateIf((o) => o.salaryMin != null || o.salaryMax != null)
  @IsEnum(SalaryPeriod, { message: "Pick a period for the salary filter" })
  salaryPeriod?: SalaryPeriod

  @IsOptional()
  @Type(() => Number)
  @IsIn(POSTED_WITHIN_DAYS as readonly number[], { message: "Pick how recent the jobs should be" })
  postedWithin?: number
}

/** Parsed filters with defaults removed (undefined = not filtered). */
export type JobFilters = {
  categoryId?: string
  remote?: boolean
  type?: EmploymentType
  salary?: { min?: number; max?: number; currency: string; period: SalaryPeriod }
  postedWithin?: number
}

export function toJobFilters(dto: JobFiltersDto): JobFilters {
  const hasSalary = dto.salaryMin != null || dto.salaryMax != null
  return {
    categoryId: dto.categoryId || undefined,
    remote: dto.remote === "true" ? true : undefined,
    type: dto.type,
    salary:
      hasSalary && dto.salaryCurrency && dto.salaryPeriod
        ? {
            min: dto.salaryMin ?? undefined,
            max: dto.salaryMax ?? undefined,
            currency: dto.salaryCurrency,
            period: dto.salaryPeriod,
          }
        : undefined,
    postedWithin: dto.postedWithin,
  }
}

/** Stable text of the active filters (cache keys). */
export const jobFiltersKey = (f: JobFilters) => JSON.stringify(f)
