import { z } from "zod"

/** Mirrors the backend DTO: a reason of 3..500 characters for destructive / monetary actions. */
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

const cost = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} can't be negative`)
    .max(10000, `${label} must be 10,000 or less`)
const multiplier = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .min(0.1, `${label} must be between 0.1 and 5`)
    .max(5, `${label} must be between 0.1 and 5`)

export const pricingSchema = z.object({
  publishBase: cost("Publish base"),
  multipliers: z.object({
    remote: multiplier("Remote multiplier"),
    highSalary: multiplier("High-salary multiplier"),
    featuredCategory: multiplier("Featured-category multiplier"),
  }),
  highSalaryThresholdUsd: z
    .number({ error: "Threshold must be a number" })
    .int("Threshold must be a whole number")
    .min(0, "Threshold can't be negative")
    .max(100_000_000, "Threshold is too large"),
  featureCost: cost("Feature cost"),
  featureDays: z
    .number({ error: "Feature days must be a number" })
    .int("Feature days must be a whole number")
    .min(1, "Feature days must be between 1 and 90")
    .max(90, "Feature days must be between 1 and 90"),
  aiRerunCost: cost("AI re-run cost"),
  signupBonus: cost("Recruiter signup bonus"),
  applyCost: cost("Apply cost"),
  seekerSignupBonus: cost("Seeker signup bonus"),
})

const nonNegInt = (label: string, max = 100_000_000) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} can't be negative`)
    .max(max, `${label} is too large`)

export const packageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Keep the name under 80 characters"),
  credits: nonNegInt("Credits", 1_000_000),
  bonusCredits: nonNegInt("Bonus credits", 1_000_000),
  priceUsdCents: nonNegInt("USD price"),
  priceEtbCents: nonNegInt("ETB price"),
  active: z.boolean(),
})

export const planSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Keep the name under 80 characters"),
  monthlyCredits: nonNegInt("Monthly credits", 1_000_000),
  seatLimit: z
    .number()
    .int("Seat limit must be a whole number")
    .min(1, "Seat limit must be at least 1")
    .max(10000, "Seat limit is too large")
    .nullable(),
  priceUsdCents: nonNegInt("USD price"),
  active: z.boolean(),
})

export const aiSettingsSchema = z.object({
  activeModel: z.string().min(1, "Choose a model"),
  temperature: z
    .number({ error: "Temperature must be a number" })
    .min(0, "Temperature must be between 0 and 1")
    .max(1, "Temperature must be between 0 and 1"),
  systemPrompt: z
    .string()
    .trim()
    .min(1, "System prompt is required")
    .max(8000, "Keep the system prompt under 8,000 characters"),
})
