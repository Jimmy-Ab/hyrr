import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"
import { CURRENCIES, SALARY_MAX_VALUE, SALARY_PERIODS } from "../../core/validation/structured"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

export class CreateOfferDto {
  @IsUUID(undefined, { message: "Choose an application" })
  applicationId: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Enter the job title" })
  @MaxLength(120)
  jobTitle?: string

  @Type(() => Number)
  @IsInt({ message: "Base salary must be a whole number" })
  @Min(1, { message: "Base salary must be more than 0" })
  @Max(SALARY_MAX_VALUE, { message: "Base salary is too large" })
  baseSalary: number

  @IsIn(CURRENCIES as unknown as string[], { message: "Choose a supported currency" })
  salaryCurrency: string

  @IsIn(SALARY_PERIODS as unknown as string[], { message: "Choose per year, month or hour" })
  salaryPeriod: "YEAR" | "MONTH" | "HOUR"

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Bonus must be a whole number" })
  @Min(0, { message: "Bonus can't be negative" })
  @Max(SALARY_MAX_VALUE)
  bonusAmount?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: "Equity must be a number" })
  @Min(0, { message: "Equity can't be negative" })
  @Max(100, { message: "Equity is a percentage (0–100)" })
  equityPercentage?: number

  @IsISO8601({ strict: true }, { message: "Choose a start date" })
  startDate: string

  @IsISO8601({ strict: true }, { message: "Choose when the offer expires" })
  expiresAt: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15, { message: "List at most 15 benefits" })
  @IsString({ each: true })
  @MaxLength(80, { each: true, message: "Each benefit can be at most 80 characters" })
  benefits?: string[]

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000, { message: "The message can be at most 4000 characters" })
  message?: string
}

export class AcceptOfferDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Type your full name to sign" })
  @MaxLength(120)
  signatureName: string

  @Equals(true, { message: "Confirm that you accept the terms" })
  agree: boolean
}

export class DeclineOfferDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: "The reason can be at most 1000 characters" })
  reason?: string
}
