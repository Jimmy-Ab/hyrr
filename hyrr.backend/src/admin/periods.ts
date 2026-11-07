/** Calendar periods and bucket math for the admin dashboard and analytics (all UTC). */

export type DashboardPeriod = "today" | "week" | "month" | "year"
export const DASHBOARD_PERIODS: DashboardPeriod[] = ["today", "week", "month", "year"]

export type AnalyticsInterval = "day" | "week" | "month"
export const ANALYTICS_INTERVALS: AnalyticsInterval[] = ["day", "week", "month"]

export type Range = { from: Date; to: Date }

const DAY_MS = 24 * 60 * 60 * 1000
/** Upper bound of analytics buckets, so a long range with interval=day stays cheap. */
export const MAX_ANALYTICS_BUCKETS = 400
/** Longest analytics range (about three years). */
export const MAX_ANALYTICS_DAYS = 1100

/** Start of the calendar period containing `now` (week = Monday 00:00 UTC). */
export function periodStart(period: DashboardPeriod, now: Date): Date {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  if (period === "today") return new Date(Date.UTC(y, m, d))
  if (period === "week") {
    const sinceMonday = (now.getUTCDay() + 6) % 7
    return new Date(Date.UTC(y, m, d - sinceMonday))
  }
  if (period === "month") return new Date(Date.UTC(y, m, 1))
  return new Date(Date.UTC(y, 0, 1))
}

/** Start of the calendar period right before the one starting at `start`. */
function previousPeriodStart(period: DashboardPeriod, start: Date): Date {
  const y = start.getUTCFullYear()
  const m = start.getUTCMonth()
  const d = start.getUTCDate()
  if (period === "today") return new Date(Date.UTC(y, m, d - 1))
  if (period === "week") return new Date(Date.UTC(y, m, d - 7))
  if (period === "month") return new Date(Date.UTC(y, m - 1, 1))
  return new Date(Date.UTC(y - 1, 0, 1))
}

/**
 * Current period so far and the same elapsed length of the previous period. The previous range
 * never runs into the current period (e.g. March 31 compares with all of February).
 */
export function dashboardRanges(
  period: DashboardPeriod,
  now: Date
): { range: Range; previousRange: Range } {
  const from = periodStart(period, now)
  const elapsed = now.getTime() - from.getTime()
  const prevFrom = previousPeriodStart(period, from)
  const prevTo = new Date(Math.min(prevFrom.getTime() + elapsed, from.getTime()))
  return { range: { from, to: now }, previousRange: { from: prevFrom, to: prevTo } }
}

/** Day for up to 45 days, week up to 200 days, else month. */
export function pickInterval(range: Range): AnalyticsInterval {
  const days = (range.to.getTime() - range.from.getTime()) / DAY_MS
  if (days <= 45) return "day"
  if (days <= 200) return "week"
  return "month"
}

/** The equal-length range right before `range`. */
export function previousRangeOf(range: Range): Range {
  const length = range.to.getTime() - range.from.getTime()
  return { from: new Date(range.from.getTime() - length), to: new Date(range.from) }
}

/** Postgres `date_trunc` semantics in UTC (week starts on Monday). */
export function truncate(date: Date, interval: AnalyticsInterval): Date {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  if (interval === "month") return new Date(Date.UTC(y, m, 1))
  const day = new Date(Date.UTC(y, m, date.getUTCDate()))
  if (interval === "day") return day
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS)
}

/** Bucket starts covering [from, to), as produced by the SQL `generate_series`. */
export function bucketStarts(range: Range, interval: AnalyticsInterval): Date[] {
  const out: Date[] = []
  let t = truncate(range.from, interval)
  while (t.getTime() < range.to.getTime()) {
    out.push(t)
    if (interval === "day") t = new Date(t.getTime() + DAY_MS)
    else if (interval === "week") t = new Date(t.getTime() + 7 * DAY_MS)
    else t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1))
  }
  return out
}

/** "YYYY-MM" of the last `count` months up to and including the month of `now`. */
export function lastMonths(now: Date, count: number): { month: string; from: Date; to: Date }[] {
  const out: { month: string; from: Date; to: Date }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
    const month = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`
    out.push({ month, from, to })
  }
  return out
}

/** Percentage with one decimal; 0 when the denominator is 0. */
export const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0
