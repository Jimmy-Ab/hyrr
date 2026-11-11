import {
  registerDecorator,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
} from "class-validator"

/**
 * Structured form values shared by job postings and seeker profiles. The frontend mirrors these
 * rules in hyrr.shared/src/lib/validation.ts — keep both in sync (see the hyrr-validation skill).
 */

/** ISO 4217 codes offered in the currency pickers. */
export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "ETB",
  "KES",
  "NGN",
  "ZAR",
  "EGP",
  "GHS",
  "UGX",
  "TZS",
  "RWF",
  "AED",
  "SAR",
  "QAR",
  "INR",
  "PKR",
  "CNY",
  "JPY",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "TRY",
  "BRL",
  "MXN",
] as const
export type Currency = (typeof CURRENCIES)[number]

export const SALARY_PERIODS = ["YEAR", "MONTH", "HOUR"] as const
export type SalaryPeriodCode = (typeof SALARY_PERIODS)[number]

export const SALARY_MAX_VALUE = 100_000_000

/**
 * Approximate USD value of one unit, for pricing rules only (e.g. the "high salary" multiplier).
 * Deliberately coarse and static; never shown to users as an exchange rate.
 */
export const APPROX_USD_PER_UNIT: Partial<Record<Currency, number>> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CHF: 1.12,
  CAD: 0.73,
  AUD: 0.66,
  SGD: 0.74,
  AED: 0.27,
  SAR: 0.27,
  QAR: 0.27,
  SEK: 0.095,
  NOK: 0.093,
  DKK: 0.145,
  PLN: 0.25,
  JPY: 0.0067,
  CNY: 0.14,
  INR: 0.012,
  BRL: 0.18,
  MXN: 0.055,
  TRY: 0.03,
  ZAR: 0.054,
  ETB: 0.0071,
  KES: 0.0077,
  NGN: 0.00065,
  EGP: 0.02,
  GHS: 0.065,
  UGX: 0.00027,
  TZS: 0.00038,
  RWF: 0.00075,
  PKR: 0.0036,
}

const PERIOD_LABEL: Record<SalaryPeriodCode, string> = {
  YEAR: "year",
  MONTH: "month",
  HOUR: "hour",
}
const PERIODS_PER_YEAR: Record<SalaryPeriodCode, number> = { YEAR: 1, MONTH: 12, HOUR: 2080 }

/** "USD 120,000 – 150,000 / year" */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  period: string | null | undefined
): string | null {
  if (min == null || max == null || !currency) return null
  const n = (v: number) => v.toLocaleString("en-US")
  const range = min === max ? n(min) : `${n(min)} – ${n(max)}`
  const per =
    period && period in PERIOD_LABEL ? ` / ${PERIOD_LABEL[period as SalaryPeriodCode]}` : ""
  return `${currency} ${range}${per}`
}

/** Yearly USD equivalent of a salary amount (null when the currency is unknown). */
export function approxYearlyUsd(
  amount: number | null | undefined,
  currency: string | null | undefined,
  period: string | null | undefined
): number | null {
  if (amount == null || !currency) return null
  const rate = APPROX_USD_PER_UNIT[currency as Currency]
  if (!rate) return null
  const perYear = PERIODS_PER_YEAR[(period as SalaryPeriodCode) || "YEAR"] ?? 1
  return Math.round(amount * rate * perYear)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2021-03" → Date(2021-03-01 UTC); null for anything else. */
export function parseMonth(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "")
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) : null
}

export function toMonthString(date: Date | null | undefined): string | null {
  if (!date) return null
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

/** "Mar 2021 – Present" */
export function formatMonthRange(start: Date | null, end: Date | null, current: boolean): string {
  const f = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  if (!start) return ""
  return `${f(start)} – ${current || !end ? "Present" : f(end)}`
}

/** "2015 – 2019" */
export function formatYearRange(
  start: number | null | undefined,
  end: number | null | undefined
): string {
  if (!start) return ""
  return end ? (end === start ? String(start) : `${start} – ${end}`) : `${start} – Present`
}

export const currentMonth = () => {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

// ─── Cross-field validators ─────────────────────────────────────────────────

/** Value must be >= the sibling property `field` (skipped when either side is empty). */
export function IsGreaterOrEqualTo(field: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isGreaterOrEqualTo",
      target: object.constructor,
      propertyName,
      constraints: [field],
      options: { message: `${propertyName} must be greater than or equal to ${field}`, ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as any)[args.constraints[0]]
          if (value == null || other == null || value === "" || other === "") return true
          // Numbers numerically; "YYYY-MM" strings compare correctly as text.
          if (typeof value === "number" && typeof other === "number") return value >= other
          return String(value) >= String(other)
        },
      },
    })
}

/** When any of `fields` is set, this property is required too (all-or-nothing groups). */
export function RequiredWith(fields: string[], options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "requiredWith",
      target: object.constructor,
      propertyName,
      constraints: fields,
      options: {
        message: `${propertyName} is required together with ${fields.join(", ")}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const anySet = args.constraints.some((f) => (args.object as any)[f] != null)
          return !anySet || (value != null && value !== "")
        },
      },
    })
}

/** "YYYY-MM" not after the current month. */
export function IsNotFutureMonth(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isNotFutureMonth",
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} can't be in the future`, ...options },
      validator: {
        validate: (value: unknown) => typeof value !== "string" || value <= currentMonth(),
      },
    })
}

/** Validate the property when it, or any field of its all-or-nothing group, is set. */
export function IfGroupPresent(group: string[]) {
  return ValidateIf(
    (o: any, v: unknown) => (v !== undefined && v !== null) || group.some((f) => o[f] != null)
  )
}
