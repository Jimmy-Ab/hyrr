import { z } from "zod"
import { isApiError } from "./api"

/**
 * Form validation shared by the apps. Mirrors the backend DTO rules
 * (hyrr.backend/src/core/validation/structured.ts + the DTOs) — keep both in sync
 * (see the hyrr-validation skill).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

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

export const CURRENCY_NAME: Record<Currency, string> = {
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  ETB: "Ethiopian birr",
  KES: "Kenyan shilling",
  NGN: "Nigerian naira",
  ZAR: "South African rand",
  EGP: "Egyptian pound",
  GHS: "Ghanaian cedi",
  UGX: "Ugandan shilling",
  TZS: "Tanzanian shilling",
  RWF: "Rwandan franc",
  AED: "UAE dirham",
  SAR: "Saudi riyal",
  QAR: "Qatari riyal",
  INR: "Indian rupee",
  PKR: "Pakistani rupee",
  CNY: "Chinese yuan",
  JPY: "Japanese yen",
  SGD: "Singapore dollar",
  AUD: "Australian dollar",
  CAD: "Canadian dollar",
  CHF: "Swiss franc",
  SEK: "Swedish krona",
  NOK: "Norwegian krone",
  DKK: "Danish krone",
  PLN: "Polish złoty",
  TRY: "Turkish lira",
  BRL: "Brazilian real",
  MXN: "Mexican peso",
}

export const SALARY_PERIODS = ["YEAR", "MONTH", "HOUR"] as const
export type SalaryPeriod = (typeof SALARY_PERIODS)[number]
export const SALARY_PERIOD_LABEL: Record<SalaryPeriod, string> = {
  YEAR: "per year",
  MONTH: "per month",
  HOUR: "per hour",
}
export const SALARY_MAX_VALUE = 100_000_000

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export const thisYear = () => new Date().getFullYear()
export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ─── Value types ─────────────────────────────────────────────────────────────

/** A salary range being edited; `min`/`max` null = empty input. */
export interface SalaryRangeValue {
  min: number | null
  max: number | null
  currency: Currency | ""
  period: SalaryPeriod
}
export const emptySalaryRange = (currency: Currency | "" = ""): SalaryRangeValue => ({
  min: null,
  max: null,
  currency,
  period: "YEAR",
})
export const isSalaryRangeEmpty = (v: SalaryRangeValue) => v.min == null && v.max == null

/** "USD 120,000 – 150,000 / year" (same text the backend stores). */
export function formatSalaryRange(v: {
  min?: number | null
  max?: number | null
  currency?: string | null
  period?: string | null
}): string {
  if (v.min == null || v.max == null || !v.currency) return ""
  const n = (x: number) => x.toLocaleString("en-US")
  const per = v.period === "MONTH" ? " / month" : v.period === "HOUR" ? " / hour" : " / year"
  return `${v.currency} ${v.min === v.max ? n(v.min) : `${n(v.min)} – ${n(v.max)}`}${per}`
}

/** "120,000" → 120000; "" → null; anything with letters → NaN (reported as invalid). */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "")
  if (!cleaned) return null
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN
}

export const formatAmount = (n: number | null) =>
  n == null || Number.isNaN(n) ? "" : n.toLocaleString("en-US")

// ─── Schemas ─────────────────────────────────────────────────────────────────

const amount = (label: string) =>
  z
    .number({ message: `Enter the ${label} salary` })
    .refine((n) => !Number.isNaN(n), { message: "Use digits only" })
    .refine((n) => Number.isInteger(n), { message: "Use a whole number" })
    .refine((n) => n >= 0, { message: "Can't be negative" })
    .refine((n) => n <= SALARY_MAX_VALUE, { message: "That amount is too large" })

/** Optional range: empty is fine; otherwise min, max and currency are all required and max ≥ min. */
export const salaryRangeSchema = z
  .object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string(),
    period: z.enum(SALARY_PERIODS),
  })
  .superRefine((v, ctx) => {
    if (v.min == null && v.max == null) return
    const check = (key: "min" | "max", label: string) => {
      const r = amount(label).safeParse(v[key] ?? undefined)
      if (!r.success)
        ctx.addIssue({ code: "custom", path: [key], message: r.error.issues[0].message })
    }
    check("min", "minimum")
    check("max", "maximum")
    if (!v.currency)
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Choose a currency" })
    else if (!(CURRENCIES as readonly string[]).includes(v.currency))
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Choose a supported currency" })
    if (
      v.min != null &&
      v.max != null &&
      !Number.isNaN(v.min) &&
      !Number.isNaN(v.max) &&
      v.max < v.min
    )
      ctx.addIssue({
        code: "custom",
        path: ["max"],
        message: "Maximum must be at least the minimum",
      })
  })

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export const experienceSchema = z
  .object({
    role: z.string().trim().min(1, "Job title is required").max(120, "At most 120 characters"),
    company: z.string().trim().min(1, "Company is required").max(120, "At most 120 characters"),
    startDate: z.string().regex(MONTH, "Choose a start month and year"),
    endDate: z.string().nullable(),
    current: z.boolean(),
    desc: z.string().max(2000, "At most 2,000 characters").optional(),
  })
  .superRefine((v, ctx) => {
    if (MONTH.test(v.startDate) && v.startDate > currentMonth())
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Start can't be in the future" })
    if (v.current) return
    if (!v.endDate || !MONTH.test(v.endDate))
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: 'Choose an end month and year, or tick "I currently work here"',
      })
    else if (v.endDate < v.startDate)
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End can't be before the start" })
    else if (v.endDate > currentMonth())
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End can't be in the future" })
  })
export type ExperienceInput = z.infer<typeof experienceSchema>

export const educationSchema = z
  .object({
    school: z.string().trim().min(1, "School is required").max(160, "At most 160 characters"),
    degree: z.string().trim().min(1, "Degree is required").max(160, "At most 160 characters"),
    startYear: z
      .number({ message: "Choose a start year" })
      .int()
      .min(1950, "Start year must be 1950 or later"),
    endYear: z.number().int().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.startYear > thisYear())
      ctx.addIssue({
        code: "custom",
        path: ["startYear"],
        message: "Start year can't be in the future",
      })
    if (v.endYear == null) return
    if (v.endYear < v.startYear)
      ctx.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "End year can't be before the start year",
      })
    if (v.endYear > thisYear() + 8)
      ctx.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "End year is too far in the future",
      })
  })
export type EducationInput = z.infer<typeof educationSchema>

const optionalUrl = z
  .string()
  .trim()
  .max(500, "At most 500 characters")
  .refine((v) => !v || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v), {
    message: "Enter a valid link, e.g. https://example.com",
  })

export const PHONE_PATTERN = /^\+?[0-9 ()\-.]{6,25}$/

export const profileBasicsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "At most 120 characters"),
  title: z
    .string()
    .trim()
    .min(2, "Add a headline, e.g. Frontend Developer")
    .max(120, "At most 120 characters"),
  location: z.string().trim().min(2, "Add your city or region").max(160, "At most 160 characters"),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || PHONE_PATTERN.test(v), {
      message: "Use digits, spaces and + ( ) - . only (6–25 characters)",
    }),
  bio: z.string().max(4000, "At most 4,000 characters"),
  website: optionalUrl,
  github: optionalUrl,
  linkedin: optionalUrl,
  skills: z.array(z.string()).max(50, "At most 50 skills"),
  languages: z.array(z.string()).max(20, "At most 20 languages"),
  preferredLocations: z.array(z.string()).max(10, "At most 10 locations"),
})

export const jobBasicsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Job title must be at least 3 characters")
    .max(200, "At most 200 characters"),
  location: z.string().trim().min(2, "Location is required").max(200, "At most 200 characters"),
  categoryId: z.string().min(1, "Choose a category"),
})

// ─── Error helpers ───────────────────────────────────────────────────────────

/** Field path ("experiences.0.endDate") → first message. */
export type FieldErrors = Record<string, string>

/** Validates and returns field errors (empty object = valid). Paths are joined with ".". */
export function validate(schema: z.ZodType, value: unknown, prefix = ""): FieldErrors {
  const result = schema.safeParse(value)
  if (result.success) return {}
  const out: FieldErrors = {}
  for (const issue of result.error.issues) {
    const path = [prefix, ...issue.path.map(String)].filter(Boolean).join(".")
    if (!out[path]) out[path] = issue.message
  }
  return out
}

/** Per-field messages from a 400 VALIDATION_FAILED API error (empty when there are none). */
export function fieldErrorsOf(err: unknown): FieldErrors {
  return isApiError(err) && err.fields ? err.fields : {}
}

/** Errors under `prefix.` with the prefix removed (e.g. one salary range or one list item). */
export function scopeErrors(errors: FieldErrors, prefix: string): FieldErrors {
  const out: FieldErrors = {}
  for (const [k, v] of Object.entries(errors))
    if (k.startsWith(`${prefix}.`)) out[k.slice(prefix.length + 1)] = v
  return out
}

/** Month value helpers for "YYYY-MM". */
export const monthOf = (value: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "")
  return m ? { year: Number(m[1]), month: Number(m[2]) } : { year: null, month: null }
}
export const toMonth = (year: number | null, month: number | null) =>
  year && month ? `${year}-${String(month).padStart(2, "0")}` : ""

// ─── Reason / note / credit adjustment (admin actions, confirm dialogs) ───

export const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Give a reason of at least 3 characters")
    .max(500, "Keep the reason under 500 characters"),
})

export const noteSchema = z.object({
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
})

export const creditAdjustmentSchema = z.object({
  amount: z
    .number({ error: "Enter a whole number of credits" })
    .int("Enter a whole number of credits")
    .min(-100000, "At most 100,000 credits at a time")
    .max(100000, "At most 100,000 credits at a time")
    .refine((n) => n !== 0, "Amount can't be zero"),
  reason: reasonSchema.shape.reason,
})

// ─── Company setup (recruiter sign-up, "Set up your company") ───

export const companySetupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your company name")
    .max(120, "Company name can be at most 120 characters"),
  website: optionalUrl,
})
export type CompanySetupInput = z.infer<typeof companySetupSchema>

// ─── Interview times offered to the candidate ───

export const INTERVIEW_DURATIONS = [15, 30, 45, 60, 90, 120] as const

export const interviewInviteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Give the interview a title")
    .max(120, "The title can be at most 120 characters"),
  durationMin: z.number().refine((v) => (INTERVIEW_DURATIONS as readonly number[]).includes(v), {
    message: "Duration must be 15, 30, 45, 60, 90 or 120 minutes",
  }),
  slots: z
    .array(
      z
        .string()
        .refine((v) => !Number.isNaN(Date.parse(v)), "Pick a date and time")
        .refine(
          (v) => Date.parse(v) >= Date.now() + 15 * 60_000,
          "Pick a time at least 15 minutes from now"
        )
    )
    .min(1, "Offer at least one time")
    .max(10, "Offer at most 10 times"),
  location: z.string().trim().max(200, "Location can be at most 200 characters").optional(),
  meetingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/i.test(v), {
      message: "Enter a valid meeting link, e.g. https://meet.google.com/…",
    })
    .optional(),
  note: z.string().trim().max(1000, "The note can be at most 1000 characters").optional(),
})

// ─── Interview scorecards ───

export const scorecardSchema = z.object({
  recommendation: z.enum(["STRONG_YES", "YES", "NEUTRAL", "NO", "STRONG_NO"], {
    message: "Choose a recommendation",
  }),
  overallNotes: z
    .string()
    .trim()
    .min(10, "Write at least a sentence of overall feedback")
    .max(4000, "Overall feedback can be at most 4000 characters"),
  ratings: z
    .array(
      z.object({
        competency: z.string(),
        score: z.number().int().min(1, "Rate this from 1 to 5").max(5, "Rate this from 1 to 5"),
        notes: z.string().max(1000, "Notes can be at most 1000 characters").optional(),
      })
    )
    .min(1),
})

// ─── Job offers ───

export const offerSchema = z
  .object({
    baseSalary: z
      .number({ message: "Enter the base salary" })
      .int("Base salary must be a whole number")
      .min(1, "Base salary must be more than 0")
      .max(SALARY_MAX_VALUE, "Base salary is too large"),
    salaryCurrency: z.enum(CURRENCIES, { message: "Choose a supported currency" }),
    salaryPeriod: z.enum(SALARY_PERIODS, { message: "Choose per year, month or hour" }),
    bonusAmount: z
      .number()
      .int("Bonus must be a whole number")
      .min(0, "Bonus can't be negative")
      .optional(),
    equityPercentage: z
      .number()
      .min(0, "Equity can't be negative")
      .max(100, "Equity is a percentage (0–100)")
      .optional(),
    startDate: z.string().min(1, "Choose a start date"),
    expiresAt: z.string().min(1, "Choose when the offer expires"),
    benefits: z
      .array(z.string().trim().max(80, "Each benefit can be at most 80 characters"))
      .max(15)
      .optional(),
    message: z.string().max(4000, "The message can be at most 4000 characters").optional(),
  })
  .refine((o) => Date.parse(o.expiresAt) >= Date.now() + 3_600_000, {
    path: ["expiresAt"],
    message: "Give the candidate at least an hour to respond",
  })
  .refine((o) => Date.parse(o.expiresAt) <= Date.now() + 60 * 86_400_000, {
    path: ["expiresAt"],
    message: "An offer can stay open for at most 60 days",
  })

export const acceptOfferSchema = z.object({
  signatureName: z.string().trim().min(2, "Type your full name to sign").max(120),
  agree: z.literal(true, { message: "Confirm that you accept the terms" }),
})
