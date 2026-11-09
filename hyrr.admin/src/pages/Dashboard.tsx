import {
  AnimatedNumber,
  Card,
  FilterChips,
  IconTile,
  PageHeader,
  Skeleton,
  StatCard,
  cn,
  toneClass,
  type Tone,
} from "hyrr.shared"
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bot,
  Briefcase,
  Building2,
  ChevronRight,
  CreditCard,
  FileText,
  Flag,
  HandCoins,
  LayoutDashboard,
  MessageSquare,
  Send,
  ServerCrash,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"
import { Delta, ErrorBlock, Sparkline, StatusDot } from "../components/ui/common"
import { useAdminQuery } from "../lib/api"
import { date, money, num } from "../lib/format"
import { useAdminLive } from "../lib/live"
import { useNav, type AdminView } from "../lib/nav"
import type { Dashboard as DashboardData, MetricKey, Period } from "../lib/types"

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
]

const PREVIOUS_LABEL: Record<Period, string> = {
  today: "vs. same time yesterday",
  week: "vs. same point last week",
  month: "vs. same point last month",
  year: "vs. same point last year",
}

type Tile = {
  key: MetricKey
  label: string
  icon: LucideIcon
  tone: Tone
  format?: (n: number) => string
  sub?: (d: DashboardData) => string
}

const TILES: Tile[] = [
  {
    key: "newUsers",
    label: "New users",
    icon: UserPlus,
    tone: "violet",
    sub: (d) =>
      `${num(d.metrics.newSeekers.current)} seekers · ${num(d.metrics.newRecruiters.current)} recruiters`,
  },
  { key: "newCompanies", label: "New companies", icon: Building2, tone: "blue" },
  { key: "jobsPublished", label: "Jobs published", icon: Briefcase, tone: "teal" },
  { key: "applications", label: "Applications", icon: Send, tone: "sky" },
  { key: "offers", label: "Offers made", icon: BadgeCheck, tone: "emerald" },
  { key: "messages", label: "Messages sent", icon: MessageSquare, tone: "teal" },
  {
    key: "revenueUsdCents",
    label: "Revenue (USD)",
    icon: CreditCard,
    tone: "emerald",
    format: (n) => money(n, "USD"),
  },
  {
    key: "revenueEtbCents",
    label: "Revenue (ETB)",
    icon: HandCoins,
    tone: "amber",
    format: (n) => money(n, "ETB"),
  },
  { key: "creditsSpent", label: "Credits spent", icon: Zap, tone: "violet" },
  { key: "activeUsers", label: "Active users", icon: Activity, tone: "blue" },
]

function MetricTile({ tile, data }: { tile: Tile; data: DashboardData }) {
  const m = data.metrics[tile.key]
  if (!m) return null
  return (
    <Card hoverEffect className={cn("tone-card group flex flex-col p-4", toneClass(tile.tone))}>
      <span className="tone-wash" aria-hidden="true" />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-txt-caption">
          {tile.label}
        </span>
        <IconTile icon={tile.icon} tone={tile.tone} size="sm" />
      </div>
      <div className="relative z-10 mt-3 flex items-baseline gap-2">
        <span className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums text-txt-title">
          <AnimatedNumber value={m.current} format={tile.format} />
        </span>
        <Delta current={m.current} previous={m.previous} />
      </div>
      <p className="relative z-10 mt-1 min-h-[16px] truncate text-[11.5px] text-txt-caption">
        {tile.sub
          ? tile.sub(data)
          : `${tile.format ? tile.format(m.previous) : num(m.previous)} before`}
      </p>
      <Sparkline values={m.sparkline} className="relative z-10 mt-2" />
    </Card>
  )
}

function AttentionCard({
  icon,
  tone,
  label,
  value,
  hint,
  target,
  preset,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  value: React.ReactNode
  hint: string
  target?: AdminView
  preset?: Record<string, string>
}) {
  const go = useNav((s) => s.go)
  const body = (
    <>
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[12.5px] font-medium text-txt-body">{label}</p>
        <p className="text-[20px] font-bold leading-tight tabular-nums text-txt-title">{value}</p>
        <p className="truncate text-[11.5px] text-txt-caption">{hint}</p>
      </div>
      {target && (
        <ChevronRight className="h-4 w-4 shrink-0 text-txt-caption transition-transform duration-300 group-hover:translate-x-0.5" />
      )}
    </>
  )
  const cls =
    "group flex w-full items-center gap-3 rounded-2xl border border-bg-border/70 bg-bg-secondary p-4 shadow-card transition-[transform,box-shadow] duration-300"
  return target ? (
    <button
      type="button"
      onClick={() => go(target, { preset })}
      className={cn(
        cls,
        "hover-lift cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Dashboard() {
  const [period, setPeriod] = React.useState<Period>("today")
  const live = useAdminLive()
  const { data, error, isLoading, refetch, isFetching } = useAdminQuery<DashboardData>(
    "/dashboard",
    { period }
  )

  return (
    <div className="flex flex-col gap-7 pb-10">
      <PageHeader
        title="Dashboard"
        icon={LayoutDashboard}
        tone="violet"
        subtitle={
          data
            ? `${date(data.range.from)} – ${date(data.range.to)} · ${PREVIOUS_LABEL[period]}`
            : "Platform activity at a glance"
        }
        actions={
          <div className="flex items-center gap-3">
            {live && (
              <span
                className="tone-emerald inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--tone-fg)]"
                title="New sign-ups, applications, jobs and payments update this page automatically"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--tone-fg)] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--tone-fg)]" />
                </span>
                Live
              </span>
            )}
            <FilterChips
              id="dashboard-period"
              label="Period"
              options={PERIODS}
              value={period}
              onChange={setPeriod}
            />
          </div>
        }
      />

      {error && !data ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
        </div>
      ) : (
        <div className={cn("flex flex-col gap-7 transition-opacity", isFetching && "opacity-80")}>
          <section aria-labelledby="attention-title">
            <h2
              id="attention-title"
              className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-txt-caption"
            >
              Needs attention
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AttentionCard
                icon={Flag}
                tone={
                  data.attention.flaggedJobs + data.attention.pendingReports ? "amber" : "slate"
                }
                label="Moderation queue"
                value={`${num(data.attention.flaggedJobs)} · ${num(data.attention.pendingReports)}`}
                hint="Flagged jobs · pending reports"
                target="moderation"
              />
              <AttentionCard
                icon={AlertTriangle}
                tone={data.attention.failedPayments24h ? "rose" : "slate"}
                label="Failed payments"
                value={num(data.attention.failedPayments24h)}
                hint="Last 24 hours"
                target="money"
                preset={{ status: "FAILED" }}
              />
              <AttentionCard
                icon={ServerCrash}
                tone={data.attention.failedQueueJobs ? "rose" : "slate"}
                label="Failed background jobs"
                value={num(data.attention.failedQueueJobs)}
                hint="E-mail, AI and search queues"
              />
              <AttentionCard
                icon={Bot}
                tone={data.attention.aiProvider === "ok" ? "emerald" : "amber"}
                label="AI provider"
                value={data.attention.aiProvider === "ok" ? "Connected" : "Disabled"}
                hint={data.attention.aiProvider === "ok" ? "Scoring is running" : "Add an API key"}
                target="settings"
              />
            </div>
          </section>

          <section aria-labelledby="activity-title">
            <h2
              id="activity-title"
              className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-txt-caption"
            >
              Activity
            </h2>
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {TILES.map((t) => (
                <MetricTile key={t.key} tile={t} data={data} />
              ))}
            </div>
          </section>

          <section aria-labelledby="totals-title">
            <h2
              id="totals-title"
              className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-txt-caption"
            >
              Live totals
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Live jobs"
                value={data.totals.liveJobs}
                icon={Briefcase}
                tone="teal"
              />
              <StatCard
                title="Users"
                value={data.totals.users}
                icon={Users}
                tone="violet"
                caption={`${num(data.totals.seekers)} seekers · ${num(data.totals.recruiters)} recruiters`}
              />
              <StatCard
                title="Companies"
                value={data.totals.companies}
                icon={Building2}
                tone="blue"
              />
              <StatCard
                title="Open applications"
                value={data.totals.openApplications}
                icon={FileText}
                tone="amber"
              />
            </div>
          </section>

          <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-txt-caption">
              System health
            </span>
            <StatusDot state={data.health.db} label="Database" />
            <StatusDot state={data.health.redis} label="Redis" />
            <StatusDot state={data.health.queues} label="Queues" />
            <StatusDot state={data.health.search} label="Search" />
            <StatusDot state={data.health.email} label="E-mail" />
          </Card>
        </div>
      )}
    </div>
  )
}
