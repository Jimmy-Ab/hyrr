import { CompanyStatus, PaymentProvider, PaymentStatus, UserRole, UserStatus } from "@prisma/client"
import { Transform, Type } from "class-transformer"
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
  ValidateIf,
  ValidateNested,
} from "class-validator"
import {
  ANALYTICS_INTERVALS,
  AnalyticsInterval,
  DASHBOARD_PERIODS,
  DashboardPeriod,
} from "../periods"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

// ─── Queries ─────────────────────────────────────────────────────────
export class PageQueryDto {
  @IsOptional()
  @IsString({ message: "Cursor must be text" })
  @MaxLength(64, { message: "Cursor is too long" })
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Limit must be a whole number" })
  @Min(1, { message: "Limit must be at least 1" })
  @Max(100, { message: "Limit can be at most 100" })
  limit?: number
}

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS, { message: "Period must be today, week, month or year" })
  period?: DashboardPeriod
}

export class AnalyticsQueryDto {
  @IsISO8601({ strict: true }, { message: "From must be an ISO date" })
  from: string

  @IsISO8601({ strict: true }, { message: "To must be an ISO date" })
  to: string

  @IsOptional()
  @IsIn(ANALYTICS_INTERVALS, { message: "Interval must be day, week or month" })
  interval?: AnalyticsInterval
}

export class ModerationQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["open", "all"], { message: "Status must be open or all" })
  status?: "open" | "all"
}

export class UsersQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Search must be text" })
  @MaxLength(200, { message: "Search can be at most 200 characters" })
  q?: string

  @IsOptional()
  @IsIn(Object.values(UserRole), { message: "Role must be SEEKER, RECRUITER or ADMIN" })
  role?: UserRole

  @IsOptional()
  @IsIn(Object.values(UserStatus), { message: "Status must be ACTIVE, SUSPENDED or PENDING" })
  status?: UserStatus
}

export class CompaniesQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Search must be text" })
  @MaxLength(200, { message: "Search can be at most 200 characters" })
  q?: string

  @IsOptional()
  @IsIn(Object.values(CompanyStatus), { message: "Status must be VERIFIED, PENDING or SUSPENDED" })
  status?: CompanyStatus
}

export class PaymentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(Object.values(PaymentProvider), { message: "Provider must be STRIPE or CHAPA" })
  provider?: PaymentProvider

  @IsOptional()
  @IsIn(Object.values(PaymentStatus), {
    message: "Status must be PENDING, SUCCEEDED, FAILED or REFUNDED",
  })
  status?: PaymentStatus

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "From must be an ISO date" })
  from?: string

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "To must be an ISO date" })
  to?: string
}

export class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID("all", { message: "Admin id must be a valid id" })
  actorId?: string

  @IsOptional()
  @IsString({ message: "Action must be text" })
  @MaxLength(64, { message: "Action can be at most 64 characters" })
  action?: string

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "From must be an ISO date" })
  from?: string

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "To must be an ISO date" })
  to?: string
}

/** Same filters as the list, without paging (CSV export). */
export class AuditCsvQueryDto {
  @IsOptional()
  @IsUUID("all", { message: "Admin id must be a valid id" })
  actorId?: string

  @IsOptional()
  @IsString({ message: "Action must be text" })
  @MaxLength(64, { message: "Action can be at most 64 characters" })
  action?: string

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "From must be an ISO date" })
  from?: string

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "To must be an ISO date" })
  to?: string
}

// ─── Bodies ──────────────────────────────────────────────────────────
export const REASON_MIN = 3
export const REASON_MAX = 500

export class ReasonDto {
  @Transform(trim)
  @IsString({ message: "Reason must be text" })
  @IsNotEmpty({ message: "Please give a reason" })
  @MinLength(REASON_MIN, { message: `Reason must be at least ${REASON_MIN} characters` })
  @MaxLength(REASON_MAX, { message: `Reason can be at most ${REASON_MAX} characters` })
  reason: string
}

export class NoteDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Note must be text" })
  @MaxLength(REASON_MAX, { message: `Note can be at most ${REASON_MAX} characters` })
  note?: string
}

export const CREDIT_ADJUSTMENT_MAX = 100_000

export class TransferOwnerDto extends ReasonDto {
  @IsUUID(undefined, { message: "Choose a member" })
  userId: string
}

export class CreditAdjustmentDto extends ReasonDto {
  @IsInt({ message: "Amount must be a whole number of credits" })
  @NotEquals(0, { message: "Amount can't be 0" })
  @Min(-CREDIT_ADJUSTMENT_MAX, { message: `Amount must be at least -${CREDIT_ADJUSTMENT_MAX}` })
  @Max(CREDIT_ADJUSTMENT_MAX, { message: `Amount can be at most ${CREDIT_ADJUSTMENT_MAX}` })
  amount: number
}

const COST_MAX = 10_000
const costMsg = (label: string) => ({
  message: `${label} must be a whole number between 0 and ${COST_MAX}`,
})

export class MultipliersDto {
  @IsOptional()
  @IsNumber({}, { message: "Remote multiplier must be a number" })
  @Min(0.1, { message: "Remote multiplier must be between 0.1 and 5" })
  @Max(5, { message: "Remote multiplier must be between 0.1 and 5" })
  remote?: number

  @IsOptional()
  @IsNumber({}, { message: "High-salary multiplier must be a number" })
  @Min(0.1, { message: "High-salary multiplier must be between 0.1 and 5" })
  @Max(5, { message: "High-salary multiplier must be between 0.1 and 5" })
  highSalary?: number

  @IsOptional()
  @IsNumber({}, { message: "Featured-category multiplier must be a number" })
  @Min(0.1, { message: "Featured-category multiplier must be between 0.1 and 5" })
  @Max(5, { message: "Featured-category multiplier must be between 0.1 and 5" })
  featuredCategory?: number
}

export class PricingDto {
  @IsOptional()
  @IsInt(costMsg("Publish base"))
  @Min(0, costMsg("Publish base"))
  @Max(COST_MAX, costMsg("Publish base"))
  publishBase?: number

  @IsOptional()
  @ValidateNested()
  @Type(() => MultipliersDto)
  multipliers?: MultipliersDto

  @IsOptional()
  @IsInt({ message: "High-salary threshold must be a whole number of USD" })
  @Min(0, { message: "High-salary threshold can't be negative" })
  @Max(100_000_000, { message: "High-salary threshold can be at most 100,000,000" })
  highSalaryThresholdUsd?: number

  @IsOptional()
  @IsInt(costMsg("Feature cost"))
  @Min(0, costMsg("Feature cost"))
  @Max(COST_MAX, costMsg("Feature cost"))
  featureCost?: number

  @IsOptional()
  @IsInt({ message: "Feature days must be a whole number between 1 and 90" })
  @Min(1, { message: "Feature days must be a whole number between 1 and 90" })
  @Max(90, { message: "Feature days must be a whole number between 1 and 90" })
  featureDays?: number

  @IsOptional()
  @IsInt(costMsg("AI re-run cost"))
  @Min(0, costMsg("AI re-run cost"))
  @Max(COST_MAX, costMsg("AI re-run cost"))
  aiRerunCost?: number

  @IsOptional()
  @IsInt(costMsg("Recruiter sign-up bonus"))
  @Min(0, costMsg("Recruiter sign-up bonus"))
  @Max(COST_MAX, costMsg("Recruiter sign-up bonus"))
  signupBonus?: number

  @IsOptional()
  @IsInt(costMsg("Apply cost"))
  @Min(0, costMsg("Apply cost"))
  @Max(COST_MAX, costMsg("Apply cost"))
  applyCost?: number

  @IsOptional()
  @IsInt(costMsg("Outreach cost"))
  @Min(0, costMsg("Outreach cost"))
  @Max(COST_MAX, costMsg("Outreach cost"))
  outreachCost?: number

  @IsOptional()
  @IsInt(costMsg("External apply cost"))
  @Min(0, costMsg("External apply cost"))
  @Max(COST_MAX, costMsg("External apply cost"))
  externalApplyCost?: number

  @IsOptional()
  @IsInt(costMsg("Resume tailor cost"))
  @Min(0, costMsg("Resume tailor cost"))
  @Max(COST_MAX, costMsg("Resume tailor cost"))
  resumeTailorCost?: number

  @IsOptional()
  @IsInt(costMsg("Mock interview cost"))
  @Min(0, costMsg("Mock interview cost"))
  @Max(COST_MAX, costMsg("Mock interview cost"))
  mockInterviewCost?: number

  @IsOptional()
  @IsInt(costMsg("Negotiation advice cost"))
  @Min(0, costMsg("Negotiation advice cost"))
  @Max(COST_MAX, costMsg("Negotiation advice cost"))
  negotiationAdviceCost?: number

  @IsOptional()
  @IsInt(costMsg("Seeker sign-up bonus"))
  @Min(0, costMsg("Seeker sign-up bonus"))
  @Max(COST_MAX, costMsg("Seeker sign-up bonus"))
  seekerSignupBonus?: number
}

const PRICE_MAX = 100_000_000
const CREDITS_MAX = 1_000_000

export class PackageUpdateDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Name must be text" })
  @IsNotEmpty({ message: "Name can't be empty" })
  @MaxLength(80, { message: "Name can be at most 80 characters" })
  name?: string

  @IsOptional()
  @IsInt({ message: "Credits must be a whole number" })
  @Min(1, { message: "Credits must be at least 1" })
  @Max(CREDITS_MAX, { message: `Credits can be at most ${CREDITS_MAX}` })
  credits?: number

  @IsOptional()
  @IsInt({ message: "Bonus credits must be a whole number" })
  @Min(0, { message: "Bonus credits can't be negative" })
  @Max(CREDITS_MAX, { message: `Bonus credits can be at most ${CREDITS_MAX}` })
  bonusCredits?: number

  @IsOptional()
  @IsInt({ message: "USD price must be a whole number of cents" })
  @Min(0, { message: "USD price can't be negative" })
  @Max(PRICE_MAX, { message: `USD price can be at most ${PRICE_MAX} cents` })
  priceUsdCents?: number

  @IsOptional()
  @IsInt({ message: "ETB price must be a whole number of santim" })
  @Min(0, { message: "ETB price can't be negative" })
  @Max(PRICE_MAX, { message: `ETB price can be at most ${PRICE_MAX} santim` })
  priceEtbCents?: number

  @IsOptional()
  @IsBoolean({ message: "Active must be true or false" })
  active?: boolean
}

export class PlanUpdateDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Name must be text" })
  @IsNotEmpty({ message: "Name can't be empty" })
  @MaxLength(80, { message: "Name can be at most 80 characters" })
  name?: string

  @IsOptional()
  @IsInt({ message: "Monthly credits must be a whole number" })
  @Min(0, { message: "Monthly credits can't be negative" })
  @Max(CREDITS_MAX, { message: `Monthly credits can be at most ${CREDITS_MAX}` })
  monthlyCredits?: number

  /** null = unlimited seats. */
  @IsOptional()
  @ValidateIf((o) => o.seatLimit !== null)
  @IsInt({ message: "Seat limit must be a whole number (or empty for unlimited)" })
  @Min(1, { message: "Seat limit must be at least 1" })
  @Max(10_000, { message: "Seat limit can be at most 10000" })
  seatLimit?: number | null

  @IsOptional()
  @IsInt({ message: "USD price must be a whole number of cents" })
  @Min(0, { message: "USD price can't be negative" })
  @Max(PRICE_MAX, { message: `USD price can be at most ${PRICE_MAX} cents` })
  priceUsdCents?: number

  @IsOptional()
  @IsBoolean({ message: "Active must be true or false" })
  active?: boolean
}
