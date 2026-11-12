/** Pure maths for company responsiveness (unit-tested). */

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type AppActivity = {
  appliedAt: Date
  status: string
  /** First status change by the team or first recruiter message, null when never answered. */
  firstResponseAt: Date | null
}

export const FAST_RESPONDER = { minApplications: 10, maxMedianHours: 48, minReviewRate: 0.8 }
export const GHOST_AFTER_DAYS = 21

function median(values: number[]) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function computeStats(apps: AppActivity[], now = new Date()) {
  const t = now.getTime()
  const responded = apps.filter((a) => a.firstResponseAt)
  const hours = responded.map((a) =>
    Math.max(0, (a.firstResponseAt!.getTime() - a.appliedAt.getTime()) / HOUR)
  )
  // Only applications older than 48 h are fair to judge for "reviewed".
  const eligible = apps.filter((a) => t - a.appliedAt.getTime() >= 48 * HOUR)
  const reviewRate = eligible.length
    ? eligible.filter((a) => a.firstResponseAt).length / eligible.length
    : null
  const old = apps.filter((a) => t - a.appliedAt.getTime() >= GHOST_AFTER_DAYS * DAY)
  const ghostRate = old.length
    ? old.filter((a) => !a.firstResponseAt && a.status === "APPLIED").length / old.length
    : null
  const medianHours = median(hours)
  const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100)
  return {
    applications30d: apps.length,
    medianFirstResponseHours: round(medianHours),
    reviewRate30d: round(reviewRate),
    ghostRate30d: round(ghostRate),
    fastResponder:
      apps.length >= FAST_RESPONDER.minApplications &&
      medianHours !== null &&
      medianHours < FAST_RESPONDER.maxMedianHours &&
      (reviewRate ?? 0) >= FAST_RESPONDER.minReviewRate,
  }
}

/** Monday–Friday days elapsed between two dates (whole days, UTC). */
export function businessDaysBetween(from: Date, to: Date) {
  let days = 0
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  while (d.getTime() < end) {
    d.setUTCDate(d.getUTCDate() + 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) days++
  }
  return days
}
