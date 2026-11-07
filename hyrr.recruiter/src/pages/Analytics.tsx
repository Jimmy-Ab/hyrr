import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type FunnelAnalytics,
} from "hyrr.shared"
import { AlertTriangle, BarChart3, Hourglass, RefreshCw, Timer, Trophy, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import { JobFilter, PipelineViewSwitch, useApplicantCounts } from "../components/jobs/job-filter"
import { APPLICATION_SOURCE_LABEL, errorMessage } from "../lib/recruiter"
import { useJobStore } from "../store/useJobStore"

const STAGE_LABEL: Record<string, string> = {
  APPLIED: "Applied",
  IN_PROCESS: "In Process",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  ARCHIVED: "Archived",
  WITHDRAWN: "Withdrawn",
  SAVED: "Saved",
}

const SOURCE_ORDER = ["DIRECT", "GUEST", "RECRUITER_ADDED"] as const

// Theme tokens (switch automatically in dark mode)
const tooltipStyle = {
  backgroundColor: "var(--color-bg-secondary)",
  borderColor: "var(--color-bg-border)",
  color: "var(--color-txt-heading)",
  borderRadius: "14px",
  boxShadow: "var(--shadow-card)",
}
const tooltipLabelStyle = { color: "var(--color-txt-heading)" }
const tooltipItemStyle = { color: "var(--color-txt-body)" }
const gridStroke = "var(--color-bg-border)"
const axisStroke = "var(--color-txt-caption)"

const pct = (v: number) => `${Math.round(v * 100)}%`
const days = (v: number | null | undefined) =>
  v == null ? "—" : `${v < 10 ? Math.round(v * 10) / 10 : Math.round(v)} d`

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[16px] font-semibold text-txt-heading">{title}</h2>
      <p className="text-[12px] text-txt-caption mt-0.5 font-medium">{hint}</p>
    </div>
  )
}

/** Horizontal bars, one hue (magnitude); values in text ink beside the bar. */
function HBar({
  label,
  value,
  max,
  suffix,
}: {
  label: string
  value: number
  max: number
  suffix?: string
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0
  return (
    <div className="grid grid-cols-[96px_1fr_auto] sm:grid-cols-[120px_1fr_auto] items-center gap-3">
      <span className="text-[13px] font-semibold text-txt-heading truncate">{label}</span>
      <div className="h-6 rounded-md bg-bg-hover overflow-hidden" title={`${label}: ${value}`}>
        <div className="h-full rounded-r-[4px] bg-primary" style={{ width: `${width}%` }} />
      </div>
      <span className="text-[13px] font-semibold text-txt-body tabular-nums text-right min-w-[3ch]">
        {value}
        {suffix && <span className="text-txt-caption font-medium"> {suffix}</span>}
      </span>
    </div>
  )
}

function Funnel({ funnel }: { funnel: FunnelAnalytics["funnel"] }) {
  const max = Math.max(...funnel.map((s) => s.reached), 0)
  return (
    <ol className="space-y-3.5">
      {funnel.map((s, i) => (
        <li key={s.stage}>
          <HBar label={STAGE_LABEL[s.stage] ?? s.stage} value={s.reached} max={max} />
          {i > 0 && (
            <p className="text-[12px] text-txt-caption mt-1 pl-[108px] sm:pl-[132px]">
              {pct(s.conversionFromPrevious)} from {STAGE_LABEL[funnel[i - 1]!.stage]}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading analytics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[120px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

export function Analytics() {
  const { jobs, funnelAnalytics, fetchFunnelAnalytics, setAddJobOpen, selectedJobId, selectJob } =
    useJobStore()
  const jobId = selectedJobId
  const { counts, total } = useApplicantCounts()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchFunnelAnalytics(jobId || undefined)
    } catch (err) {
      setError(errorMessage(err, "Could not load analytics."))
    } finally {
      setLoading(false)
    }
  }, [fetchFunnelAnalytics, jobId])

  useEffect(() => {
    load()
  }, [load])

  const data = funnelAnalytics
  const applicants = data?.funnel?.[0]?.reached ?? 0
  const offers = data?.funnel?.find((s) => s.stage === "OFFER")?.reached ?? 0
  const sources = SOURCE_ORDER.map((key) => ({
    key,
    label: APPLICATION_SOURCE_LABEL[key] ?? key,
    value: data?.bySource?.[key] ?? 0,
  }))
  const sourceMax = Math.max(...sources.map((s) => s.value), 0)
  const stageTimes = Object.entries(data?.timeInStageDays ?? {})
  const stageTimeMax = Math.max(...stageTimes.map(([, v]) => v ?? 0), 0)
  const monthly = data?.monthlyApplications ?? []

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative min-w-0">
      <PageHeader
        icon={BarChart3}
        tone="sky"
        title="Analytics"
        subtitle="Funnel conversion, time to hire and where your applicants come from."
        actions={<PipelineViewSwitch current="Analytics" />}
      />
      <JobFilter id="analytics" counts={counts} total={total} />

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <div role="alert" className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertTriangle className="w-9 h-9 text-sec-red" />
          <div>
            <h2 className="text-[16px] font-semibold text-txt-heading">Analytics unavailable</h2>
            <p className="text-body text-txt-body mt-1">{error}</p>
          </div>
          <Button onClick={load} variant="secondary" className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      ) : !data || applicants === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={jobId ? "No applicants for this job yet" : "No applicants yet"}
          description="Analytics appear once candidates apply. Publish a job to start collecting applications."
          action={
            jobs.length === 0 ? (
              <Button onClick={() => setAddJobOpen(true)}>Create a job</Button>
            ) : undefined
          }
        />
      ) : (
        <div
          className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}
          aria-busy={loading}
        >
          <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Applicants"
              value={applicants}
              caption="reached Applied"
              icon={Users}
              tone="blue"
            />
            <StatCard
              title="Offers"
              value={offers}
              caption={`${applicants > 0 ? pct(offers / applicants) : "0%"} of applicants`}
              icon={Trophy}
              tone="emerald"
            />
            <StatCard
              title="Median time to hire"
              value={days(data.timeToHireDays?.median)}
              caption="Applied → Offer"
              icon={Timer}
              tone="amber"
            />
            <StatCard
              title="Average time to hire"
              value={days(data.timeToHireDays?.average)}
              caption="Applied → Offer"
              icon={Hourglass}
              tone="violet"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="p-6">
              <SectionTitle
                title="Hiring funnel"
                hint="Candidates who reached each stage, with conversion from the previous one"
              />
              <Funnel funnel={data.funnel} />
            </Card>

            <Card className="p-6">
              <SectionTitle
                title="Applicants by source"
                hint="How candidates entered the pipeline"
              />
              <div className="space-y-3.5">
                {sources.map((s) => (
                  <HBar
                    key={s.key}
                    label={s.label}
                    value={s.value}
                    max={sourceMax}
                    suffix={applicants > 0 ? `(${pct(s.value / applicants)})` : undefined}
                  />
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <SectionTitle
                title="Average time in stage"
                hint="Days candidates spend in each stage before moving on"
              />
              {stageTimes.length === 0 ? (
                <p className="text-[13px] text-txt-caption">Not enough stage changes yet.</p>
              ) : (
                <dl className="space-y-3.5">
                  {stageTimes.map(([stage, value]) => (
                    <div
                      key={stage}
                      className="grid grid-cols-[96px_1fr_auto] sm:grid-cols-[120px_1fr_auto] items-center gap-3"
                    >
                      <dt className="text-[13px] font-semibold text-txt-heading truncate">
                        {STAGE_LABEL[stage] ?? stage}
                      </dt>
                      <div className="h-6 rounded-md bg-bg-hover overflow-hidden">
                        <div
                          className="h-full rounded-r-[4px] bg-primary"
                          style={{
                            width: `${stageTimeMax > 0 && value != null ? (value / stageTimeMax) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <dd className="text-[13px] font-semibold text-txt-body tabular-nums text-right">
                        {days(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>

            {monthly.length > 0 && (
              <Card className="p-6">
                <SectionTitle title="Application intake" hint="Applications per month" />
                <div className="h-64 w-full font-medium">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                      <XAxis
                        dataKey="month"
                        stroke={axisStroke}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke={axisStroke}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        itemStyle={tooltipItemStyle}
                      />
                      <Area
                        type="monotone"
                        dataKey="applications"
                        name="Applications"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorApplications)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {!jobId && (data.perJob?.length ?? 0) > 0 && (
            <Card className="overflow-hidden border border-bg-border/60 min-w-0">
              <div className="p-6 pb-2">
                <SectionTitle title="Per job" hint="Pipeline counts for each job" />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Job</TableHead>
                    <TableHead className="text-right">Applicants</TableHead>
                    <TableHead className="text-right">In process</TableHead>
                    <TableHead className="text-right">Interviewing</TableHead>
                    <TableHead className="pr-6 text-right">Offers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.perJob.map((row) => (
                    <TableRow key={row.jobId}>
                      <TableCell className="pl-6 py-3">
                        <button
                          type="button"
                          onClick={() => selectJob(row.jobId)}
                          className="font-semibold text-txt-heading hover:text-primary hover:underline cursor-pointer text-left"
                        >
                          {row.title}
                        </button>
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        {row.applicants}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        {row.inProcess}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        {row.interviewing}
                      </TableCell>
                      <TableCell className="pr-6 py-3 text-right tabular-nums">
                        {row.offers}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
