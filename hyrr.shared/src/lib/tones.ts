/**
 * One meaning → one colour, everywhere. Components take a `Tone` and use the `tone-<name>` class
 * (styles/index.css), which sets --tone-fg / --tone-bg / --tone-ring / --tone-glow for light+dark.
 */
export type Tone = "violet" | "blue" | "sky" | "teal" | "emerald" | "amber" | "rose" | "slate"

export const toneClass = (tone: Tone) => `tone-${tone}`

/** Pipeline stages (API codes and display labels). */
const STAGE_TONE: Record<string, Tone> = {
  SAVED: "sky",
  APPLIED: "blue",
  IN_PROCESS: "amber",
  INTERVIEWING: "violet",
  OFFER: "emerald",
  ARCHIVED: "slate",
  WITHDRAWN: "slate",
  REJECTED: "rose",
  Saved: "sky",
  Applied: "blue",
  "In Process": "amber",
  Interviewing: "violet",
  Offer: "emerald",
  Offers: "emerald",
  Archived: "slate",
  Withdrawn: "slate",
  Rejected: "rose",
}
export const stageTone = (status?: string | null): Tone => STAGE_TONE[status ?? ""] ?? "slate"

/** Job status (labels or codes). */
const JOB_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "emerald",
  Active: "emerald",
  DRAFT: "slate",
  Draft: "slate",
  CLOSED: "rose",
  Closed: "rose",
  FLAGGED: "amber",
  Flagged: "amber",
  "Under review": "amber",
}
export const jobStatusTone = (status?: string | null): Tone =>
  JOB_STATUS_TONE[status ?? ""] ?? "slate"

/** Calendar event types. */
const EVENT_TONE: Record<string, Tone> = {
  interview: "violet",
  deadline: "rose",
  offer: "emerald",
  other: "sky",
}
export const eventTone = (type?: string | null): Tone =>
  EVENT_TONE[(type ?? "").toLowerCase()] ?? "sky"

/** Notification types. */
const NOTIFICATION_TONE: Record<string, Tone> = {
  APPLICATION: "blue",
  INTERVIEW: "violet",
  MESSAGE: "teal",
  OFFER: "emerald",
  JOB_ALERT: "amber",
  SYSTEM: "slate",
}
export const notificationTone = (type?: string | null): Tone =>
  NOTIFICATION_TONE[type ?? ""] ?? "slate"

/** Document types. */
const DOCUMENT_TONE: Record<string, Tone> = {
  resume: "blue",
  cover: "violet",
  cert: "emerald",
  portfolio: "amber",
  other: "slate",
}
export const documentTone = (type?: string | null): Tone => DOCUMENT_TONE[type ?? ""] ?? "slate"

/** AI match score bands. */
/** Match score bands used everywhere (seeker job matches and recruiter candidate scores). */
export const MATCH_THRESHOLDS = { high: 70, medium: 40 } as const
export type MatchLevel = "high" | "medium" | "low"
export const matchLevel = (score: number): MatchLevel =>
  score >= MATCH_THRESHOLDS.high ? "high" : score >= MATCH_THRESHOLDS.medium ? "medium" : "low"
const MATCH_LEVEL_TONE: Record<MatchLevel, Tone> = { high: "emerald", medium: "amber", low: "rose" }

/** High (>= 70) green, medium (40-69) yellow, low (< 40) red; slate when not scored. */
export const scoreTone = (score?: number | null): Tone =>
  score == null ? "slate" : MATCH_LEVEL_TONE[matchLevel(score)]

/** Job colour field (purple | blue | green | orange) → tone. */
const JOB_COLOR_TONE: Record<string, Tone> = {
  purple: "violet",
  blue: "blue",
  green: "emerald",
  orange: "amber",
}
export const jobColorTone = (color?: string | null): Tone => JOB_COLOR_TONE[color ?? ""] ?? "violet"

/** Rotating palette for lists of equal items (e.g. four stat cards). */
export const TONE_CYCLE: Tone[] = ["blue", "amber", "violet", "emerald", "teal", "rose", "sky"]
