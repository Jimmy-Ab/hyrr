import {
  Card,
  FilterChips,
  PageHeader,
  Skeleton,
  StatCard,
  TonePill,
  cn,
  downloadCsv,
  toneClass,
} from "hyrr.shared"
import { BarChart3, Clock, Gauge, Percent, Target, Users } from "lucide-react"
import * as React from "react"
import { BarsChart, ChartCard, RankedBars, TrendChart } from "../components/ui/charts"
import { Delta, ErrorBlock } from "../components/ui/common"
import { useAdminQuery } from "../lib/api"
import { CHART } from "../lib/chart"
import { bucketLabel, humanize, money, num, pct, pct100, short } from "../lib/format"
import { useNav } from "../lib/nav"
import type { Analytics as AnalyticsData, Interval, SeriesKey } from "../lib/types"

type Preset = "7d" | "30d" | "90d" | "12m" | "custom"
const PRESETS: { value: Preset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
  { value: "custom", label: "Custom" },
]

const DAY = 86_400_000
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function presetRange(p: Exclude<Preset, "custom">): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  if (p === "12m") from.setUTCMonth(from.getUTCMonth() - 12)
  else from.setTime(to.getTime() - (p === "7d" ? 7 : p === "30d" ? 30 : 90) * DAY)
  return { from: from.toISOString(), to: to.toISOString() }
}

const dateInputCls =
  "h-10 rounded-input border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-heading focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 [color-scheme:light] dark:[color-scheme:dark]"

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 mt-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-txt-caption">
        {title}
      </h2>
      {hint && <p className="text-[12px] text-txt-caption">{hint}</p>}
    </div>
  )
}

/** One time-series chart with its previous period dashed and growth badge. */
function GrowthChart({
  title,
  hint,
  data,
  previous,
  keyName,
  format,
  tickFormat,
}: {
  title: string
  hint?: string
  data: AnalyticsData
  previous: AnalyticsData | undefined
  keyName: SeriesKey
  format?: (n: number) => string
  tickFormat?: (n: number) => string
}) {
  const series = data.series[keyName] ?? []
  const prev = previous?.series[keyName] ?? []
  const rows = series.map((p, i) => ({
    label: bucketLabel(p.t, data.interval),
    t: p.t,
    current: p.v,
    previous: prev[i]?.v ?? null,
  }))
  const fmt = format ?? ((n: number) => n.toLocaleString())
  return (
    <ChartCard
      title={title}
      hint={hint ?? `Total ${fmt(data.totals[keyName] ?? 0)}`}
      badge={
        <Delta current={data.totals[keyName] ?? 0} previous={data.previousTotals[keyName] ?? 0} />
      }
      legend={[
        { label: "This period", color: CHART[0] },
        { label: "Previous period", color: CHART[0], dashed: true },
      ]}
      csv={{
        name: title,
        rows: rows.map((r) => ({ bucket: r.t, current: r.current, previous: r.previous })),
        columns: [
          { key: "bucket", label: "Bucket start (UTC)" },
          { key: "current", label: title },
          { key: "previous", label: "Previous period" },
        ],
      }}
    >
      <TrendChart
        data={rows}
        format={fmt}
        tickFormat={tickFormat}
        minMax={tickFormat ? 400 : 4}
        series={[
          { key: "previous", name: "Previous", color: CHART[0], dashed: true },
          { key: "current", name: "This period", color: CHART[0] },
        ]}
      />
    </ChartCard>
  )
}

export function Analytics() {
  const go = useNav((s) => s.go)
  const [preset, setPreset] = React.useState<Preset>("30d")
  const [custom, setCustom] = React.useState(() => {
    const r = presetRange("30d")
    return { from: r.from.slice(0, 10), to: r.to.slice(0, 10) }
  })
  // Fixed per preset choice so refetches don't change the key every render.
  const range = React.useMemo(() => {
    if (preset !== "custom") return presetRange(preset)
    const from = new Date(`${custom.from}T00:00:00Z`)
    const to = new Date(`${custom.to}T23:59:59Z`)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [preset, custom])
  const customInvalid =
    preset === "custom" && (!custom.from || !custom.to || custom.from > custom.to)

  const current = useAdminQuery<AnalyticsData>("/analytics", range, { enabled: !customInvalid })
  const data = current.data
  const span = new Date(range.to).getTime() - new Date(range.from).getTime()
  const prevRange = {
    from: new Date(new Date(range.from).getTime() - span).toISOString(),
    to: range.from,
    interval: data?.interval as Interval | undefined,
  }
  const previous = useAdminQuery<AnalyticsData>("/analytics", prevRange, {
    enabled: !!data && !customInvalid,
  })

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Analytics"
        icon={BarChart3}
        tone="blue"
        subtitle={
          data
            ? `Grouped by ${data.interval} · compared with the previous ${Math.round(span / DAY)} days`
            : "Growth, marketplace health and money"
        }
        actions={
          <FilterChips
            id="analytics-range"
            label="Date range"
            options={PRESETS}
            value={preset}
            onChange={setPreset}
          />
        }
      />

      {preset === "custom" && (
        <Card className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <label
              htmlFor="range-from"
              className="mb-1 block text-[12px] font-semibold text-txt-heading"
            >
              From
            </label>
            <input
              id="range-from"
              type="date"
              value={custom.from}
              max={isoDay(new Date())}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              className={dateInputCls}
            />
          </div>
          <div>
            <label
              htmlFor="range-to"
              className="mb-1 block text-[12px] font-semibold text-txt-heading"
            >
              To
            </label>
            <input
              id="range-to"
              type="date"
              value={custom.to}
              max={isoDay(new Date())}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              aria-invalid={customInvalid || undefined}
              aria-describedby={customInvalid ? "range-error" : undefined}
              className={dateInputCls}
            />
          </div>
          {customInvalid && (
            <p
              id="range-error"
              role="alert"
              className="pb-2.5 text-[12px] font-medium text-sec-red"
            >
              The start date must be on or before the end date.
            </p>
          )}
        </Card>
      )}

      {current.error && !data ? (
        <ErrorBlock error={current.error} onRetry={() => void current.refetch()} />
      ) : !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[320px] rounded-card" />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col gap-6 transition-opacity",
            current.isFetching && "opacity-80"
          )}
        >
          <section>
            <SectionTitle
              title="Growth"
              hint="Dashed line: the previous period of the same length"
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SignupsChart data={data} />
              <GrowthChart
                title="Companies"
                data={data}
                previous={previous.data}
                keyName="companies"
              />
              <GrowthChart
                title="Jobs published"
                data={data}
                previous={previous.data}
                keyName="jobsPublished"
              />
              <GrowthChart
                title="Applications"
                data={data}
                previous={previous.data}
                keyName="applications"
              />
              <GrowthChart
                title="Revenue (USD)"
                data={data}
                previous={previous.data}
                keyName="revenueUsdCents"
                format={(n) => money(n, "USD")}
                tickFormat={(n) => short(Math.round(n / 100))}
              />
              <GrowthChart
                title="Revenue (ETB)"
                data={data}
                previous={previous.data}
                keyName="revenueEtbCents"
                format={(n) => money(n, "ETB")}
                tickFormat={(n) => short(Math.round(n / 100))}
              />
              <CreditsChart data={data} />
              <GrowthChart
                title="Active users"
                data={data}
                previous={previous.data}
                keyName="activeUsers"
              />
            </div>
          </section>

          <section>
            <SectionTitle title="Marketplace health" hint="Jobs published in this range" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Applications per job"
                value={data.health.appsPerJobAvg.toFixed(1)}
                caption={`median ${data.health.appsPerJobMedian}`}
                icon={Gauge}
                tone="blue"
              />
              <StatCard
                title="Zero-applicant jobs"
                value={pct100(data.health.zeroApplicantJobsPct)}
                caption="after 7 days"
                icon={Percent}
                tone="amber"
              />
              <StatCard
                title="First application"
                value={
                  data.health.medianHoursToFirstApplication == null
                    ? "—"
                    : data.health.medianHoursToFirstApplication < 48
                      ? `${Math.round(data.health.medianHoursToFirstApplication)} h`
                      : `${(data.health.medianHoursToFirstApplication / 24).toFixed(1)} d`
                }
                caption="median wait"
                icon={Clock}
                tone="teal"
              />
              <StatCard
                title="Offer rate"
                value={pct100(data.health.offerRate, 1)}
                caption="of applications"
                icon={Target}
                tone="emerald"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Platform funnel"
                hint="Applications that reached each stage"
                csv={{
                  name: "Platform funnel",
                  rows: data.health.funnel.map((f) => ({
                    ...f,
                    conversion: pct100(f.conversion, 1),
                  })),
                  columns: [
                    { key: "stage", label: "Stage" },
                    { key: "reached", label: "Reached" },
                    { key: "conversion", label: "Conversion from previous" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.health.funnel.map((f, i) => ({
                    key: f.stage,
                    label: humanize(f.stage),
                    value: f.reached,
                    sub: i === 0 ? undefined : `${pct100(f.conversion)} conv.`,
                  }))}
                  color={CHART[3]}
                />
              </ChartCard>
              <RetentionCard data={data} />
            </div>
          </section>

          <section>
            <SectionTitle title="Breakdowns" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <ChartCard
                title="Top categories"
                hint="Jobs published (applications)"
                csv={{
                  name: "Top categories",
                  rows: data.breakdowns.categories,
                  columns: [
                    { key: "name", label: "Category" },
                    { key: "jobs", label: "Jobs" },
                    { key: "applications", label: "Applications" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.breakdowns.categories.slice(0, 8).map((c) => ({
                    key: c.name,
                    label: c.name || "Uncategorised",
                    value: c.jobs,
                    sub: `(${num(c.applications)})`,
                  }))}
                />
              </ChartCard>
              <ChartCard
                title="Top locations"
                hint="Jobs published"
                csv={{
                  name: "Top locations",
                  rows: data.breakdowns.locations,
                  columns: [
                    { key: "name", label: "Location" },
                    { key: "jobs", label: "Jobs" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.breakdowns.locations.map((l) => ({
                    key: l.name,
                    label: l.name || "Unspecified",
                    value: l.jobs,
                  }))}
                />
              </ChartCard>
              <ChartCard
                title="Work setup"
                hint="Remote vs on-site, and employment type"
                csv={{
                  name: "Work setup",
                  rows: [
                    { group: "Remote", jobs: data.breakdowns.remote.remote },
                    { group: "On-site", jobs: data.breakdowns.remote.onsite },
                    ...data.breakdowns.employmentTypes.map((e) => ({
                      group: humanize(e.type),
                      jobs: e.jobs,
                    })),
                  ],
                  columns: [
                    { key: "group", label: "Group" },
                    { key: "jobs", label: "Jobs" },
                  ],
                }}
              >
                <SplitBar
                  a={{ label: "Remote", value: data.breakdowns.remote.remote }}
                  b={{ label: "On-site", value: data.breakdowns.remote.onsite }}
                />
                <div className="mt-5">
                  <RankedBars
                    rows={data.breakdowns.employmentTypes.map((e) => ({
                      key: e.type,
                      label: humanize(e.type),
                      value: e.jobs,
                    }))}
                    color={CHART[2]}
                  />
                </div>
              </ChartCard>
              <ChartCard
                title="Top companies by applications"
                csv={{
                  name: "Top companies by applications",
                  rows: data.breakdowns.companiesByApplications,
                  columns: [
                    { key: "id", label: "Company id" },
                    { key: "name", label: "Company" },
                    { key: "value", label: "Applications" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.breakdowns.companiesByApplications.map((c) => ({
                    key: c.id,
                    label: c.name,
                    value: c.value,
                  }))}
                  onSelect={(id) => go("companies", { focusId: id })}
                />
              </ChartCard>
              <ChartCard
                title="Top companies by spend"
                hint="Credits spent"
                csv={{
                  name: "Top companies by spend",
                  rows: data.breakdowns.companiesBySpend,
                  columns: [
                    { key: "id", label: "Company id" },
                    { key: "name", label: "Company" },
                    { key: "value", label: "Credits spent" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.breakdowns.companiesBySpend.map((c) => ({
                    key: c.id,
                    label: c.name,
                    value: c.value,
                  }))}
                  color={CHART[3]}
                  onSelect={(id) => go("companies", { focusId: id })}
                />
              </ChartCard>
              <ChartCard
                title="Credits spent by type"
                csv={{
                  name: "Credits spent by type",
                  rows: data.money.spentByType,
                  columns: [
                    { key: "type", label: "Type" },
                    { key: "credits", label: "Credits" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.money.spentByType.map((s) => ({
                    key: s.type,
                    label: humanize(s.type),
                    value: s.credits,
                  }))}
                  color={CHART[3]}
                />
              </ChartCard>
            </div>
          </section>

          <section>
            <SectionTitle title="Money" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                title="Average order"
                value={money(data.money.avgOrderUsdCents, "USD")}
                icon={Gauge}
                tone="emerald"
              />
              <StatCard
                title="Paying companies"
                value={data.money.payingCompanies}
                icon={Users}
                tone="blue"
              />
              <StatCard
                title="Paying seekers"
                value={data.money.payingSeekers}
                icon={Users}
                tone="violet"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Revenue by provider"
                hint="USD revenue (ETB alongside)"
                csv={{
                  name: "Revenue by provider",
                  rows: data.money.byProvider,
                  columns: [
                    { key: "provider", label: "Provider" },
                    { key: "count", label: "Payments" },
                    { key: "usdCents", label: "USD cents" },
                    { key: "etbCents", label: "ETB cents" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.money.byProvider.map((p) => ({
                    key: p.provider,
                    label: humanize(p.provider),
                    value: p.usdCents,
                    sub: `${money(p.etbCents, "ETB")} · ${num(p.count)} payments`,
                  }))}
                  format={(n) => money(n, "USD")}
                  color={CHART[2]}
                />
              </ChartCard>
              <ChartCard
                title="Revenue by kind"
                hint="Credit packs vs plans (USD)"
                csv={{
                  name: "Revenue by kind",
                  rows: data.money.byKind,
                  columns: [
                    { key: "kind", label: "Kind" },
                    { key: "count", label: "Payments" },
                    { key: "usdCents", label: "USD cents" },
                    { key: "etbCents", label: "ETB cents" },
                  ],
                }}
              >
                <RankedBars
                  rows={data.money.byKind.map((k) => ({
                    key: k.kind,
                    label: humanize(k.kind),
                    value: k.usdCents,
                    sub: `${money(k.etbCents, "ETB")} · ${num(k.count)} payments`,
                  }))}
                  format={(n) => money(n, "USD")}
                  color={CHART[2]}
                />
              </ChartCard>
            </div>
          </section>
        </div>
      )}
      <LiquidityCard />
    </div>
  )
}

function SignupsChart({ data }: { data: AnalyticsData }) {
  const s = data.series.signupsSeekers ?? []
  const r = data.series.signupsRecruiters ?? []
  const rows = s.map((p, i) => ({
    label: bucketLabel(p.t, data.interval),
    t: p.t,
    seekers: p.v,
    recruiters: r[i]?.v ?? 0,
  }))
  const total = (data.totals.signupsSeekers ?? 0) + (data.totals.signupsRecruiters ?? 0)
  const prevTotal =
    (data.previousTotals.signupsSeekers ?? 0) + (data.previousTotals.signupsRecruiters ?? 0)
  return (
    <ChartCard
      title="Sign-ups"
      hint={`${num(data.totals.signupsSeekers)} seekers · ${num(data.totals.signupsRecruiters)} recruiters`}
      badge={<Delta current={total} previous={prevTotal} />}
      legend={[
        { label: "Seekers", color: CHART[0] },
        { label: "Recruiters", color: CHART[1] },
      ]}
      csv={{
        name: "Sign-ups",
        rows: rows.map((x) => ({ bucket: x.t, seekers: x.seekers, recruiters: x.recruiters })),
        columns: [
          { key: "bucket", label: "Bucket start (UTC)" },
          { key: "seekers", label: "Seekers" },
          { key: "recruiters", label: "Recruiters" },
        ],
      }}
    >
      <TrendChart
        data={rows}
        series={[
          { key: "seekers", name: "Seekers", color: CHART[0] },
          { key: "recruiters", name: "Recruiters", color: CHART[1] },
        ]}
      />
    </ChartCard>
  )
}

function CreditsChart({ data }: { data: AnalyticsData }) {
  const b = data.series.creditsBought ?? []
  const s = data.series.creditsSpent ?? []
  const rows = b.map((p, i) => ({
    label: bucketLabel(p.t, data.interval),
    t: p.t,
    bought: p.v,
    spent: s[i]?.v ?? 0,
  }))
  return (
    <ChartCard
      title="Credits bought vs spent"
      hint={`${num(data.totals.creditsBought)} bought · ${num(data.totals.creditsSpent)} spent`}
      badge={
        <Delta
          current={data.totals.creditsSpent ?? 0}
          previous={data.previousTotals.creditsSpent ?? 0}
        />
      }
      legend={[
        { label: "Bought", color: CHART[2] },
        { label: "Spent", color: CHART[3] },
      ]}
      csv={{
        name: "Credits bought vs spent",
        rows: rows.map((x) => ({ bucket: x.t, bought: x.bought, spent: x.spent })),
        columns: [
          { key: "bucket", label: "Bucket start (UTC)" },
          { key: "bought", label: "Bought" },
          { key: "spent", label: "Spent" },
        ],
      }}
    >
      <BarsChart
        data={rows}
        series={[
          { key: "bought", name: "Bought", color: CHART[2] },
          { key: "spent", name: "Spent", color: CHART[3] },
        ]}
      />
    </ChartCard>
  )
}

/** Two-part share bar with direct labels. */
function SplitBar({
  a,
  b,
}: {
  a: { label: string; value: number }
  b: { label: string; value: number }
}) {
  const total = a.value + b.value
  const pa = total ? a.value / total : 0
  return (
    <div>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={`${a.label} ${pct(pa)}, ${b.label} ${pct(1 - pa)}`}
      >
        {total === 0 ? (
          <div className="h-full w-full bg-bg-hover" />
        ) : (
          <>
            <div
              className="h-full rounded-l-full"
              style={{ width: `${pa * 100}%`, background: CHART[0] }}
            />
            <div className="h-full flex-1 rounded-r-full" style={{ background: CHART[1] }} />
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[12px]">
        <span className="inline-flex items-center gap-1.5 text-txt-body">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART[0] }} />
          {a.label} <b className="tabular-nums text-txt-heading">{num(a.value)}</b> ({pct(pa)})
        </span>
        <span className="inline-flex items-center gap-1.5 text-txt-body">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART[1] }} />
          {b.label} <b className="tabular-nums text-txt-heading">{num(b.value)}</b> (
          {pct(total ? 1 - pa : 0)})
        </span>
      </div>
    </div>
  )
}

/** Monthly cohorts: share of each month's sign-ups still active 30 days later. */
function RetentionCard({ data }: { data: AnalyticsData }) {
  return (
    <ChartCard
      title="Retention"
      hint="Share of each month's new users active 30 days later"
      csv={{
        name: "Retention cohorts",
        rows: data.cohorts.map((c) => ({ ...c, pct: pct100(c.pct, 1) })),
        columns: [
          { key: "month", label: "Cohort" },
          { key: "joined", label: "Joined" },
          { key: "activeAfter30d", label: "Active after 30 days" },
          { key: "pct", label: "Share" },
        ],
      }}
    >
      {data.cohorts.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-txt-caption">No cohorts yet</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {data.cohorts.map((c) => {
            const label = new Date(`${c.month}-01T00:00:00Z`).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })
            return (
              <div
                key={c.month}
                className="tone-violet relative flex flex-col items-center overflow-hidden rounded-xl border border-bg-border/70 px-2 py-3 text-center"
                title={`${label}: ${num(c.activeAfter30d)} of ${num(c.joined)} active after 30 days`}
              >
                {/* Sequential: one hue, opacity by share. */}
                <span
                  className="absolute inset-0 bg-[var(--tone-fg)]"
                  style={{ opacity: 0.06 + Math.min(1, c.pct / 100) * 0.4 }}
                  aria-hidden="true"
                />
                <span className="relative text-[11px] font-semibold text-txt-caption">{label}</span>
                <span className="relative mt-1 text-[18px] font-bold tabular-nums text-txt-title">
                  {pct100(c.pct)}
                </span>
                <span className="relative text-[11px] tabular-nums text-txt-caption">
                  {num(c.activeAfter30d)}/{num(c.joined)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </ChartCard>
  )
}

type LiquidityData = {
  by: "category" | "location"
  rows: {
    key: string
    label: string
    openJobs: number
    activeSeekers: number
    applications30d: number
    ratio: number | null
    signal: "undersupplied" | "balanced" | "oversupplied" | "no_jobs"
  }[]
}

const SIGNAL = {
  undersupplied: { label: "Needs seekers", tone: "amber" },
  balanced: { label: "Balanced", tone: "emerald" },
  oversupplied: { label: "Needs jobs", tone: "violet" },
  no_jobs: { label: "No open jobs", tone: "slate" },
} as const

/** Supply (seekers applying, 30 days) vs demand (open jobs) per category or location. */
function LiquidityCard() {
  const [by, setBy] = React.useState<"category" | "location">("category")
  const { data, error, isLoading, refetch } = useAdminQuery<LiquidityData>("/liquidity", { by })
  const rows = data?.by === by ? data.rows : []
  const maxRatio = Math.max(1, ...rows.map((r) => r.ratio ?? 0))
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-txt-heading">Marketplace liquidity</h2>
          <p className="text-[12.5px] text-txt-caption">
            Applications per open job over the last 30 days. Under 3 means recruiters there need
            more seekers; over 30 means seekers need more jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterChips
            id="liquidity-by"
            label="Group by"
            value={by}
            onChange={setBy}
            options={[
              { value: "category", label: "Category" },
              { value: "location", label: "Location" },
            ]}
          />
          <button
            type="button"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(`liquidity-by-${by}`, rows, [
                { key: "label", label: by === "category" ? "Category" : "Location" },
                { key: "openJobs", label: "Open jobs" },
                { key: "activeSeekers", label: "Active seekers (30d)" },
                { key: "applications30d", label: "Applications (30d)" },
                { key: "ratio", label: "Applications per job" },
                { key: "signal", label: "Signal" },
              ])
            }
            className="rounded-lg border border-bg-border px-3 py-1.5 text-[12.5px] font-semibold text-txt-body hover:bg-bg-hover cursor-pointer disabled:opacity-50"
          >
            CSV
          </button>
        </div>
      </div>
      {error && !data ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : isLoading && !rows.length ? (
        <Skeleton className="h-40" />
      ) : !rows.length ? (
        <p className="text-[13px] text-txt-caption">No open jobs or applications yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wider text-txt-caption">
                <th className="py-2 pr-3 font-semibold">
                  {by === "category" ? "Category" : "Location"}
                </th>
                <th className="py-2 pr-3 text-right font-semibold">Open jobs</th>
                <th className="py-2 pr-3 text-right font-semibold">Active seekers</th>
                <th className="py-2 pr-3 font-semibold">Applications per job</th>
                <th className="py-2 font-semibold">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border/60">
              {rows.slice(0, 30).map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 font-medium text-txt-heading">{r.label}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{num(r.openJobs)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{num(r.activeSeekers)}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-bg-border/60">
                        <div
                          className={cn(
                            toneClass(SIGNAL[r.signal].tone),
                            "h-full rounded-full bg-[var(--tone-fg)]"
                          )}
                          style={{ width: `${Math.min(100, ((r.ratio ?? 0) / maxRatio) * 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-txt-body">{r.ratio ?? "—"}</span>
                    </div>
                  </td>
                  <td className="py-2">
                    <TonePill tone={SIGNAL[r.signal].tone}>{SIGNAL[r.signal].label}</TonePill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
