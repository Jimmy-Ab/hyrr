import { Prisma } from "@prisma/client"

/**
 * Timestamp parameter for raw SQL. Columns are `timestamp(3)` (UTC, no zone), so the value is bound
 * as zone-less text and cast: a bound JS Date would be converted through the session time zone.
 */
export const ts = (date: Date) => Prisma.sql`CAST(${date.toISOString().slice(0, 23)} AS timestamp)`

/** ISO-8601 UTC text of a zone-less timestamp expression (avoids driver time-zone conversions). */
export const isoText = (expr: Prisma.Sql) =>
  Prisma.sql`to_char(${expr}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

/** Numbers from raw SQL (bigint, numeric or null) as plain JS numbers. */
export const n = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  const num = typeof value === "bigint" ? Number(value) : Number(value as any)
  return Number.isFinite(num) ? num : 0
}

/**
 * A metric source: rows of `table` timestamped by `ts`, aggregated with `agg`, filtered by `where`.
 * All parts are static SQL written in this file (never user input).
 */
export type MetricSource = { table: string; ts: string; agg: string; where?: string }

export const src = (s: MetricSource) => ({
  table: Prisma.raw(s.table),
  ts: Prisma.raw(s.ts),
  agg: Prisma.raw(s.agg),
  where: Prisma.raw(s.where || "TRUE"),
})

const USER_ROLES = `"role" IN ('SEEKER', 'RECRUITER')`

/** Dashboard metrics (MetricKey → source). */
export const DASHBOARD_SOURCES = {
  newUsers: { table: `"User"`, ts: `"joinedAt"`, agg: "COUNT(*)", where: USER_ROLES },
  newSeekers: { table: `"User"`, ts: `"joinedAt"`, agg: "COUNT(*)", where: `"role" = 'SEEKER'` },
  newRecruiters: {
    table: `"User"`,
    ts: `"joinedAt"`,
    agg: "COUNT(*)",
    where: `"role" = 'RECRUITER'`,
  },
  newCompanies: { table: `"Company"`, ts: `"joinedAt"`, agg: "COUNT(*)" },
  jobsPublished: { table: `"Job"`, ts: `"publishedAt"`, agg: "COUNT(*)" },
  applications: {
    table: `"Application"`,
    ts: `"appliedAt"`,
    agg: "COUNT(*)",
    where: `"status" <> 'SAVED'`,
  },
  offers: {
    table: `"ApplicationStageEvent"`,
    ts: `"createdAt"`,
    agg: "COUNT(*)",
    where: `"toStatus" = 'OFFER'`,
  },
  messages: { table: `"Message"`, ts: `"createdAt"`, agg: "COUNT(*)" },
  revenueUsdCents: {
    table: `"Payment"`,
    ts: `"paidAt"`,
    agg: `SUM("amount")`,
    where: `"status" = 'SUCCEEDED' AND upper("currency") = 'USD'`,
  },
  revenueEtbCents: {
    table: `"Payment"`,
    ts: `"paidAt"`,
    agg: `SUM("amount")`,
    where: `"status" = 'SUCCEEDED' AND upper("currency") = 'ETB'`,
  },
  creditsSpent: {
    table: `"CreditTransaction"`,
    ts: `"createdAt"`,
    agg: `SUM(-"amount")`,
    where: `"amount" < 0`,
  },
  activeUsers: { table: `"User"`, ts: `"lastActiveAt"`, agg: "COUNT(*)", where: USER_ROLES },
} satisfies Record<string, MetricSource>

export type MetricKey = keyof typeof DASHBOARD_SOURCES
export const METRIC_KEYS = Object.keys(DASHBOARD_SOURCES) as MetricKey[]

/** Analytics series (SeriesKey → source). */
export const SERIES_SOURCES = {
  signupsSeekers: DASHBOARD_SOURCES.newSeekers,
  signupsRecruiters: DASHBOARD_SOURCES.newRecruiters,
  companies: DASHBOARD_SOURCES.newCompanies,
  jobsPublished: DASHBOARD_SOURCES.jobsPublished,
  applications: DASHBOARD_SOURCES.applications,
  revenueUsdCents: DASHBOARD_SOURCES.revenueUsdCents,
  revenueEtbCents: DASHBOARD_SOURCES.revenueEtbCents,
  creditsBought: {
    table: `"CreditTransaction"`,
    ts: `"createdAt"`,
    agg: `SUM("amount")`,
    where: `"type" = 'PURCHASE'`,
  },
  creditsSpent: DASHBOARD_SOURCES.creditsSpent,
  activeUsers: DASHBOARD_SOURCES.activeUsers,
} satisfies Record<string, MetricSource>

export type SeriesKey = keyof typeof SERIES_SOURCES
export const SERIES_KEYS = Object.keys(SERIES_SOURCES) as SeriesKey[]

/** CSV cell: quoted, with formula-looking values neutralised (CSV injection). */
export function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",")
