import { HttpStatus, Injectable, Optional } from "@nestjs/common"
import { ApplicationStatus, JobStatus, Prisma, UserRole } from "@prisma/client"
import { resolveActiveModel } from "../ai/ai.models"
import { CacheService } from "../cache/cache.service"
import { EmailService } from "../core/delivery/email.service"
import { AppException } from "../core/exceptions/app-exception"
import { HealthService } from "../health/health.service"
import { PrismaService } from "../prisma/prisma.service"
import { QueueService } from "../queue/queue.service"
import {
  AnalyticsInterval,
  bucketStarts,
  DashboardPeriod,
  dashboardRanges,
  lastMonths,
  MAX_ANALYTICS_BUCKETS,
  MAX_ANALYTICS_DAYS,
  pct,
  pickInterval,
  previousRangeOf,
  Range,
} from "./periods"
import {
  DASHBOARD_SOURCES,
  isoText,
  METRIC_KEYS,
  MetricKey,
  n,
  SERIES_KEYS,
  SERIES_SOURCES,
  SeriesKey,
  src,
  ts,
} from "./sql"

export const STATS_CACHE_SECONDS = 300
export const SPARKLINE_BUCKETS = 12
const DAY_MS = 24 * 60 * 60 * 1000

type HealthState = "ok" | "disabled" | "error"
export type Metric = { current: number; previous: number; sparkline: number[] }
type Point = { t: string; v: number }

const OPEN_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.IN_PROCESS,
  ApplicationStatus.INTERVIEWING,
  ApplicationStatus.OFFER,
]
const FUNNEL_STAGES = ["APPLIED", "IN_PROCESS", "INTERVIEWING", "OFFER"] as const

const iso = (range: Range) => ({ from: range.from.toISOString(), to: range.to.toISOString() })

/** Dashboard and analytics numbers: grouped SQL over the existing timestamps, cached 5 minutes. */
@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() private readonly health?: HealthService,
    @Optional() private readonly queue?: QueueService,
    @Optional() private readonly email?: EmailService
  ) {}

  // ─── Dashboard ───────────────────────────────────────────────────
  async dashboard(period: DashboardPeriod, now = new Date()) {
    const key = `admin:dashboard:${period}`
    let cached = await this.cache.get<{
      period: DashboardPeriod
      range: { from: string; to: string }
      previousRange: { from: string; to: string }
      metrics: Record<MetricKey, Metric>
    }>(key)
    if (!cached) {
      const { range, previousRange } = dashboardRanges(period, now)
      const entries = await Promise.all(
        METRIC_KEYS.map(
          async (k) => [k, await this.metric(DASHBOARD_SOURCES[k], range, previousRange)] as const
        )
      )
      cached = {
        period,
        range: iso(range),
        previousRange: iso(previousRange),
        metrics: Object.fromEntries(entries) as Record<MetricKey, Metric>,
      }
      await this.cache.set(key, cached, STATS_CACHE_SECONDS)
    }
    // Totals, attention items and health are live: they change with every admin action.
    const [totals, attention, health] = await Promise.all([
      this.totals(),
      this.attention(now),
      this.healthLine(),
    ])
    return { ...cached, totals, attention, health }
  }

  /** Current and previous values plus 12 equal-width buckets over the current range. */
  async metric(source: (typeof DASHBOARD_SOURCES)[MetricKey], range: Range, previous: Range) {
    const s = src(source)
    const widthSeconds = Math.max(
      0.001,
      (range.to.getTime() - range.from.getTime()) / 1000 / SPARKLINE_BUCKETS
    )
    const rows = await this.prisma.$queryRaw<{ b: number; v: unknown }[]>(Prisma.sql`
      SELECT CASE WHEN ${s.ts} >= ${ts(range.from)}
               THEN LEAST(${SPARKLINE_BUCKETS - 1}::int,
                 FLOOR(EXTRACT(EPOCH FROM (${s.ts} - ${ts(range.from)})) / ${widthSeconds}::float8)::int)
               ELSE -1 END AS b,
             (${s.agg})::float8 AS v
      FROM ${s.table}
      WHERE ${s.where}
        AND ((${s.ts} >= ${ts(range.from)} AND ${s.ts} < ${ts(range.to)})
          OR (${s.ts} >= ${ts(previous.from)} AND ${s.ts} < ${ts(previous.to)}))
      GROUP BY 1`)
    const sparkline = new Array<number>(SPARKLINE_BUCKETS).fill(0)
    let previousValue = 0
    for (const row of rows) {
      const b = n(row.b)
      if (b < 0) previousValue += n(row.v)
      else sparkline[Math.min(SPARKLINE_BUCKETS - 1, b)] += n(row.v)
    }
    const current = sparkline.reduce((a, v) => a + v, 0)
    return { current, previous: previousValue, sparkline }
  }

  private async totals() {
    const [liveJobs, seekers, recruiters, companies, openApplications] = await Promise.all([
      this.prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      this.prisma.user.count({ where: { role: UserRole.SEEKER } }),
      this.prisma.user.count({ where: { role: UserRole.RECRUITER } }),
      this.prisma.company.count(),
      this.prisma.application.count({ where: { status: { in: OPEN_APPLICATION_STATUSES } } }),
    ])
    return {
      liveJobs,
      users: seekers + recruiters,
      seekers,
      recruiters,
      companies,
      openApplications,
    }
  }

  private async attention(now: Date) {
    const [flaggedJobs, pendingReports, failedPayments24h, failedQueueJobs, setting] =
      await Promise.all([
        this.prisma.job.count({ where: { status: JobStatus.FLAGGED } }),
        this.prisma.jobReport.count({ where: { status: "PENDING" } }),
        this.prisma.payment.count({
          where: { status: "FAILED", updatedAt: { gte: new Date(now.getTime() - DAY_MS) } },
        }),
        this.failedQueueJobs(),
        this.prisma.systemSetting
          .findUnique({ where: { id: "global-settings" }, select: { activeModel: true } })
          .catch(() => null),
      ])
    const aiProvider: "ok" | "disabled" = resolveActiveModel(setting?.activeModel)
      ? "ok"
      : "disabled"
    return { flaggedJobs, pendingReports, failedPayments24h, failedQueueJobs, aiProvider }
  }

  private async failedQueueJobs(): Promise<number> {
    if (!this.queue) return 0
    try {
      const status = await Promise.resolve(this.queue.status())
      return Object.values(status.queues || {}).reduce(
        (sum, counts: any) => sum + (typeof counts?.failed === "number" ? counts.failed : 0),
        0
      )
    } catch {
      return 0
    }
  }

  private async healthLine(): Promise<
    Record<"db" | "redis" | "queues" | "search" | "email", HealthState>
  > {
    const email: HealthState = this.email?.isEnabled() ? "ok" : "disabled"
    if (!this.health)
      return { db: "ok", redis: "disabled", queues: "disabled", search: "disabled", email }
    const r = await this.health.readiness()
    const queues: HealthState =
      r.queues === "bullmq" || r.queues === "inline"
        ? "ok"
        : r.queues === "error"
          ? "error"
          : "disabled"
    return { db: r.db, redis: r.redis, queues, search: r.search, email }
  }

  // ─── Analytics ───────────────────────────────────────────────────
  /** Validates the range and resolves the interval (400 INVALID_RANGE / RANGE_TOO_LARGE). */
  resolveAnalyticsRange(from: Date, to: Date, interval?: AnalyticsInterval) {
    if (!(from.getTime() < to.getTime()))
      throw new AppException("`from` must be before `to`", HttpStatus.BAD_REQUEST, "INVALID_RANGE")
    if (to.getTime() - from.getTime() > MAX_ANALYTICS_DAYS * DAY_MS)
      throw new AppException(
        `The range can be at most ${MAX_ANALYTICS_DAYS} days`,
        HttpStatus.BAD_REQUEST,
        "RANGE_TOO_LARGE"
      )
    const range = { from, to }
    const resolved = interval ?? pickInterval(range)
    if (bucketStarts(range, resolved).length > MAX_ANALYTICS_BUCKETS)
      throw new AppException(
        `Too many ${resolved} buckets; pick a larger interval`,
        HttpStatus.BAD_REQUEST,
        "RANGE_TOO_LARGE"
      )
    return { range, interval: resolved }
  }

  async analytics(from: Date, to: Date, requested?: AnalyticsInterval, now = new Date()) {
    const { range, interval } = this.resolveAnalyticsRange(from, to, requested)
    const key = `admin:analytics:${range.from.toISOString()}:${range.to.toISOString()}:${interval}`
    const cached = await this.cache.get<any>(key)
    if (cached) return cached

    const previous = previousRangeOf(range)
    const [seriesEntries, previousEntries, health, breakdowns, money, cohorts] = await Promise.all([
      Promise.all(
        SERIES_KEYS.map(async (k) => [k, await this.series(k, range, interval)] as const)
      ),
      Promise.all(SERIES_KEYS.map(async (k) => [k, await this.total(k, previous)] as const)),
      this.marketplaceHealth(range, now),
      this.breakdowns(range),
      this.money(range),
      this.cohorts(now),
    ])
    const series = Object.fromEntries(seriesEntries) as Record<SeriesKey, Point[]>
    const totals = Object.fromEntries(
      SERIES_KEYS.map((k) => [k, series[k].reduce((sum, p) => sum + p.v, 0)])
    ) as Record<SeriesKey, number>
    const result = {
      range: iso(range),
      interval,
      series,
      previousTotals: Object.fromEntries(previousEntries) as Record<SeriesKey, number>,
      totals,
      health,
      breakdowns,
      money,
      cohorts,
    }
    await this.cache.set(key, result, STATS_CACHE_SECONDS)
    return result
  }

  /** Zero-filled series: one point per bucket start (`date_trunc`, UTC; weeks start Monday). */
  async series(key: SeriesKey, range: Range, interval: AnalyticsInterval): Promise<Point[]> {
    const s = src(SERIES_SOURCES[key])
    const step = `1 ${interval}`
    const rows = await this.prisma.$queryRaw<{ t: string; v: unknown }[]>(Prisma.sql`
      SELECT ${isoText(Prisma.sql`gs.t`)} AS t, COALESCE(x.v, 0)::float8 AS v
      FROM generate_series(
        date_trunc(CAST(${interval} AS text), ${ts(range.from)}),
        ${ts(range.to)} - interval '1 millisecond',
        CAST(${step} AS interval)
      ) AS gs(t)
      LEFT JOIN (
        SELECT date_trunc(CAST(${interval} AS text), ${s.ts}) AS t, (${s.agg})::float8 AS v
        FROM ${s.table}
        WHERE ${s.where} AND ${s.ts} >= ${ts(range.from)} AND ${s.ts} < ${ts(range.to)}
        GROUP BY 1
      ) x ON x.t = gs.t
      ORDER BY gs.t`)
    return rows.map((r) => ({ t: r.t, v: n(r.v) }))
  }

  async total(key: SeriesKey, range: Range): Promise<number> {
    const s = src(SERIES_SOURCES[key])
    const rows = await this.prisma.$queryRaw<{ v: unknown }[]>(Prisma.sql`
      SELECT COALESCE((${s.agg}), 0)::float8 AS v FROM ${s.table}
      WHERE ${s.where} AND ${s.ts} >= ${ts(range.from)} AND ${s.ts} < ${ts(range.to)}`)
    return n(rows[0]?.v)
  }

  private async marketplaceHealth(range: Range, now: Date) {
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
    const [jobsRow] = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      WITH j AS (
        SELECT j.id, j."publishedAt", COUNT(a.id) AS c, MIN(a."appliedAt") AS first_at
        FROM "Job" j
        LEFT JOIN "Application" a ON a."jobId" = j.id AND a."status" <> 'SAVED'
        WHERE j."publishedAt" >= ${ts(range.from)} AND j."publishedAt" < ${ts(range.to)}
        GROUP BY j.id
      )
      SELECT COUNT(*)::float8 AS jobs,
             COALESCE(AVG(c), 0)::float8 AS avg_apps,
             COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY c), 0)::float8 AS median_apps,
             COUNT(*) FILTER (WHERE "publishedAt" <= ${ts(weekAgo)})::float8 AS old_jobs,
             COUNT(*) FILTER (WHERE "publishedAt" <= ${ts(weekAgo)} AND c = 0)::float8 AS old_zero,
             (percentile_cont(0.5) WITHIN GROUP (
                ORDER BY GREATEST(0, EXTRACT(EPOCH FROM (first_at - "publishedAt")) / 3600))
              FILTER (WHERE first_at IS NOT NULL))::float8 AS median_hours
      FROM j`)
    const [funnelRow] = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      WITH apps AS (
        SELECT a.id,
          GREATEST(
            CASE a."status" WHEN 'IN_PROCESS' THEN 2 WHEN 'INTERVIEWING' THEN 3 WHEN 'OFFER' THEN 4
              ELSE 1 END,
            COALESCE((
              SELECT MAX(CASE e."toStatus" WHEN 'IN_PROCESS' THEN 2 WHEN 'INTERVIEWING' THEN 3
                WHEN 'OFFER' THEN 4 ELSE 1 END)
              FROM "ApplicationStageEvent" e WHERE e."applicationId" = a.id
            ), 1)
          ) AS r
        FROM "Application" a
        WHERE a."status" <> 'SAVED'
          AND a."appliedAt" >= ${ts(range.from)} AND a."appliedAt" < ${ts(range.to)}
      )
      SELECT COUNT(*)::float8 AS s1,
             COUNT(*) FILTER (WHERE r >= 2)::float8 AS s2,
             COUNT(*) FILTER (WHERE r >= 3)::float8 AS s3,
             COUNT(*) FILTER (WHERE r >= 4)::float8 AS s4
      FROM apps`)
    const reached = [n(funnelRow?.s1), n(funnelRow?.s2), n(funnelRow?.s3), n(funnelRow?.s4)]
    const medianHours =
      jobsRow?.median_hours === null || jobsRow?.median_hours === undefined
        ? null
        : Math.round(n(jobsRow.median_hours) * 10) / 10
    return {
      appsPerJobAvg: Math.round(n(jobsRow?.avg_apps) * 10) / 10,
      appsPerJobMedian: n(jobsRow?.median_apps),
      zeroApplicantJobsPct: pct(n(jobsRow?.old_zero), n(jobsRow?.old_jobs)),
      medianHoursToFirstApplication: medianHours,
      funnel: FUNNEL_STAGES.map((stage, i) => ({
        stage,
        reached: reached[i],
        conversion: i === 0 ? (reached[0] > 0 ? 100 : 0) : pct(reached[i], reached[i - 1]),
      })),
      offerRate: pct(reached[3], reached[0]),
    }
  }

  private async breakdowns(range: Range) {
    const jobsInRange = Prisma.sql`j."publishedAt" >= ${ts(range.from)} AND j."publishedAt" < ${ts(range.to)}`
    const appsInRange = Prisma.sql`a."status" <> 'SAVED' AND a."appliedAt" >= ${ts(range.from)} AND a."appliedAt" < ${ts(range.to)}`
    const [catJobs, catApps, locations, byApps, bySpend, remoteRow, types] = await Promise.all([
      this.prisma.$queryRaw<{ name: string; v: unknown }[]>(Prisma.sql`
        SELECT c."name" AS name, COUNT(*)::float8 AS v FROM "Job" j
        JOIN "JobCategory" c ON c.id = j."categoryId" WHERE ${jobsInRange} GROUP BY c."name"`),
      this.prisma.$queryRaw<{ name: string; v: unknown }[]>(Prisma.sql`
        SELECT c."name" AS name, COUNT(*)::float8 AS v FROM "Application" a
        JOIN "Job" j ON j.id = a."jobId" JOIN "JobCategory" c ON c.id = j."categoryId"
        WHERE ${appsInRange} GROUP BY c."name"`),
      this.prisma.$queryRaw<{ name: string; v: unknown }[]>(Prisma.sql`
        SELECT j."location" AS name, COUNT(*)::float8 AS v FROM "Job" j WHERE ${jobsInRange}
        GROUP BY j."location" ORDER BY v DESC, name ASC LIMIT 10`),
      this.prisma.$queryRaw<{ id: string; name: string; v: unknown }[]>(Prisma.sql`
        SELECT co.id, co."name" AS name, COUNT(*)::float8 AS v FROM "Application" a
        JOIN "Job" j ON j.id = a."jobId" JOIN "Company" co ON co.id = j."companyId"
        WHERE ${appsInRange} GROUP BY co.id, co."name" ORDER BY v DESC, name ASC LIMIT 10`),
      this.prisma.$queryRaw<{ id: string; name: string; v: unknown }[]>(Prisma.sql`
        SELECT co.id, co."name" AS name, SUM(-t."amount")::float8 AS v FROM "CreditTransaction" t
        JOIN "Company" co ON co.id = t."companyId"
        WHERE t."amount" < 0 AND t."createdAt" >= ${ts(range.from)} AND t."createdAt" < ${ts(range.to)}
        GROUP BY co.id, co."name" ORDER BY v DESC, name ASC LIMIT 10`),
      this.prisma.$queryRaw<{ remote: unknown; onsite: unknown }[]>(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE j."remote")::float8 AS remote,
               COUNT(*) FILTER (WHERE NOT j."remote")::float8 AS onsite
        FROM "Job" j WHERE ${jobsInRange}`),
      this.prisma.$queryRaw<{ type: string; v: unknown }[]>(Prisma.sql`
        SELECT j."type"::text AS type, COUNT(*)::float8 AS v FROM "Job" j WHERE ${jobsInRange}
        GROUP BY 1 ORDER BY v DESC, type ASC`),
    ])
    const categories = new Map<string, { name: string; jobs: number; applications: number }>()
    const cat = (name: string) => {
      if (!categories.has(name)) categories.set(name, { name, jobs: 0, applications: 0 })
      return categories.get(name)!
    }
    for (const r of catJobs) cat(r.name).jobs = n(r.v)
    for (const r of catApps) cat(r.name).applications = n(r.v)
    return {
      categories: [...categories.values()].sort(
        (a, b) => b.jobs - a.jobs || b.applications - a.applications || a.name.localeCompare(b.name)
      ),
      locations: locations.map((r) => ({ name: r.name, jobs: n(r.v) })),
      companiesByApplications: byApps.map((r) => ({ id: r.id, name: r.name, value: n(r.v) })),
      companiesBySpend: bySpend.map((r) => ({ id: r.id, name: r.name, value: n(r.v) })),
      remote: { remote: n(remoteRow[0]?.remote), onsite: n(remoteRow[0]?.onsite) },
      employmentTypes: types.map((r) => ({ type: r.type, jobs: n(r.v) })),
    }
  }

  private async money(range: Range) {
    const paid = Prisma.sql`"status" = 'SUCCEEDED' AND "paidAt" >= ${ts(range.from)} AND "paidAt" < ${ts(range.to)}`
    const split = Prisma.sql`
      COALESCE(SUM("amount") FILTER (WHERE upper("currency") = 'USD'), 0)::float8 AS usd,
      COALESCE(SUM("amount") FILTER (WHERE upper("currency") = 'ETB'), 0)::float8 AS etb,
      COUNT(*)::float8 AS count`
    const [byProvider, byKind, summary, spent] = await Promise.all([
      this.prisma.$queryRaw<{ k: string; usd: unknown; etb: unknown; count: unknown }[]>(
        Prisma.sql`SELECT "provider"::text AS k, ${split} FROM "Payment" WHERE ${paid} GROUP BY 1 ORDER BY 1`
      ),
      this.prisma.$queryRaw<{ k: string; usd: unknown; etb: unknown; count: unknown }[]>(
        Prisma.sql`SELECT "kind"::text AS k, ${split} FROM "Payment" WHERE ${paid} GROUP BY 1 ORDER BY 1`
      ),
      this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT COALESCE(AVG("amount") FILTER (WHERE upper("currency") = 'USD'), 0)::float8 AS avg_usd,
               COUNT(DISTINCT "companyId")::float8 AS companies,
               COUNT(DISTINCT "userId") FILTER (WHERE "companyId" IS NULL)::float8 AS seekers
        FROM "Payment" WHERE ${paid}`),
      this.prisma.$queryRaw<{ type: string; v: unknown }[]>(Prisma.sql`
        SELECT "type"::text AS type, SUM(-"amount")::float8 AS v FROM "CreditTransaction"
        WHERE "amount" < 0 AND "createdAt" >= ${ts(range.from)} AND "createdAt" < ${ts(range.to)}
        GROUP BY 1 ORDER BY v DESC, type ASC`),
    ])
    return {
      byProvider: byProvider.map((r) => ({
        provider: r.k,
        usdCents: n(r.usd),
        etbCents: n(r.etb),
        count: n(r.count),
      })),
      byKind: byKind.map((r) => ({
        kind: r.k,
        count: n(r.count),
        usdCents: n(r.usd),
        etbCents: n(r.etb),
      })),
      avgOrderUsdCents: Math.round(n(summary[0]?.avg_usd)),
      payingCompanies: n(summary[0]?.companies),
      payingSeekers: n(summary[0]?.seekers),
      spentByType: spent.map((r) => ({ type: r.type, credits: n(r.v) })),
    }
  }

  /** Users (seekers + recruiters) who joined in each of the last 6 months, and how many were active 30+ days later. */
  async cohorts(now: Date) {
    const months = lastMonths(now, 6)
    const rows = await this.prisma.$queryRaw<{ m: string; joined: unknown; active: unknown }[]>(
      Prisma.sql`
        SELECT to_char(date_trunc('month', "joinedAt"), 'YYYY-MM') AS m,
               COUNT(*)::float8 AS joined,
               COUNT(*) FILTER (WHERE "lastActiveAt" >= "joinedAt" + interval '30 days')::float8 AS active
        FROM "User"
        WHERE "role" IN ('SEEKER', 'RECRUITER')
          AND "joinedAt" >= ${ts(months[0].from)} AND "joinedAt" < ${ts(months[months.length - 1].to)}
        GROUP BY 1`
    )
    const byMonth = new Map(rows.map((r) => [r.m, r]))
    return months.map(({ month }) => {
      const row = byMonth.get(month)
      const joined = n(row?.joined)
      const activeAfter30d = n(row?.active)
      return { month, joined, activeAfter30d, pct: pct(activeAfter30d, joined) }
    })
  }
}
