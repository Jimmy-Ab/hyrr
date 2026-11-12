import { yearlyMid } from "../seeker-ai/salary-benchmark"

/**
 * Grey-area scam signals. Clear-cut scams are rejected outright by job-content-policy; these only
 * add up to a risk score, and at JOB_RISK_THRESHOLD (default 3) the job goes to moderation as
 * FLAGGED with the reasons instead of going live.
 */
export type RiskInput = {
  title: string
  description: string
  salaryMin?: number | null
  salaryMax?: number | null
  salaryPeriod?: string | null
}
export type RiskContext = {
  /** Median yearly salary for similar roles in the same currency (null: not enough data). */
  marketMedianYearly: number | null
  companyAgeDays: number
  companyVerified: boolean
  /** Jobs this company published in the last 24 h, including this one. */
  companyJobsLast24h: number
}

export const riskThreshold = (env = process.env) => Math.max(1, Number(env.JOB_RISK_THRESHOLD) || 3)

const SHORTENER =
  /\b(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|goo\.gl|cutt\.ly|rb\.gy|is\.gd|shorturl\.at|tiny\.cc)\/\S+/i
const PERSONAL_EMAIL =
  /[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|live|aol|proton(?:mail)?|icloud)\.[a-z.]+/i
const HYPE =
  /\b(?:earn|make)\s+(?:up to\s+)?[$€£]?\s?\d[\d,.]*\s*(?:k\b)?[^.]{0,20}\b(?:per|a|each)\s+(?:day|week)\b|\bno experience (?:needed|required)\b[^.]{0,60}(?:earn|[$€£]\d)|\b(?:quick|easy|fast) money\b|\bget paid (?:daily|instantly)\b|\bwork from home and earn\b/i

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export function assessJobRisk(job: RiskInput, ctx: RiskContext) {
  const reasons: { reason: string; weight: number }[] = []
  const text = `${job.title}. ${plain(job.description)}`
  const yearly = yearlyMid(job)
  if (yearly && ctx.marketMedianYearly && yearly > ctx.marketMedianYearly * 3)
    reasons.push({
      reason: "Salary is more than 3× the market median for similar roles",
      weight: 2,
    })
  if (SHORTENER.test(text))
    reasons.push({
      reason: "Contains a link shortener or messenger link (bit.ly, t.me, wa.me…)",
      weight: 2,
    })
  if (PERSONAL_EMAIL.test(text))
    reasons.push({ reason: "Asks candidates to contact a personal e-mail address", weight: 1 })
  if (HYPE.test(text))
    reasons.push({
      reason: "Uses get-rich-quick wording (earn $X per day, easy money…)",
      weight: 1,
    })
  if (plain(job.description).length < 150)
    reasons.push({ reason: "Very short description (under 150 characters)", weight: 1 })
  if (!ctx.companyVerified && ctx.companyAgeDays < 7 && ctx.companyJobsLast24h >= 5)
    reasons.push({ reason: "New, unverified company posting many jobs at once", weight: 2 })
  const score = reasons.reduce((s, r) => s + r.weight, 0)
  return { score, reasons: reasons.map((r) => r.reason), flagged: score >= riskThreshold() }
}
