import { Card, cn } from "hyrr.shared"
import { Download, Table2 } from "lucide-react"
import * as React from "react"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CHART } from "../../lib/chart"
import { downloadCsv } from "../../lib/csv"

type Col = { key: string; label: string }
export type ChartCsv = { name: string; rows: Record<string, unknown>[]; columns: Col[] }

/**
 * Chart frame: title, optional growth badge, legend, CSV download and a table view of the same
 * rows (so values are never colour-only).
 */
export function ChartCard({
  title,
  hint,
  badge,
  legend,
  csv,
  children,
  className,
}: {
  title: string
  hint?: string
  badge?: React.ReactNode
  legend?: { label: string; color: string; dashed?: boolean }[]
  csv: ChartCsv
  children: React.ReactNode
  className?: string
}) {
  const [showTable, setShowTable] = React.useState(false)
  return (
    <Card className={cn("flex min-w-0 flex-col p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-txt-heading">{title}</h3>
            {badge}
          </div>
          {hint && <p className="mt-0.5 text-[12px] text-txt-caption">{hint}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            aria-label={showTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
            title={showTable ? "Show chart" : "Show table"}
            className={cn(
              "cursor-pointer rounded-lg p-1.5 text-txt-caption transition-colors hover:bg-bg-hover hover:text-txt-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              showTable && "bg-bg-hover text-txt-heading"
            )}
          >
            <Table2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(csv.name, csv.rows, csv.columns)}
            aria-label={`Download ${title} as CSV`}
            title="Download CSV"
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-txt-caption transition-colors hover:bg-bg-hover hover:text-txt-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>
      {legend && legend.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-txt-body">
          {legend.map((l) => (
            <li key={l.label} className="inline-flex items-center gap-1.5">
              <svg width="16" height="6" aria-hidden="true">
                <line
                  x1="1"
                  x2="15"
                  y1="3"
                  y2="3"
                  stroke={l.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={l.dashed ? "3 3" : undefined}
                />
              </svg>
              {l.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 min-w-0 flex-1">{showTable ? <CsvTable csv={csv} /> : children}</div>
    </Card>
  )
}

function CsvTable({ csv }: { csv: ChartCsv }) {
  return (
    <div
      className="max-h-[260px] overflow-auto rounded-xl border border-bg-border/70"
      data-lenis-prevent
    >
      <table className="w-full text-left text-[12px]">
        <thead className="sticky top-0 bg-bg-secondary">
          <tr>
            {csv.columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-semibold text-txt-caption">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {csv.rows.map((r, i) => (
            <tr key={i} className="border-t border-bg-border/50">
              {csv.columns.map((c) => (
                <td key={c.key} className="px-3 py-1.5 tabular-nums text-txt-heading">
                  {String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Tooltip card in the app's surface tokens. */
function TooltipCard({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; dataKey?: string; payload?: any }[]
  label?: string
  format: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  const title = payload[0]?.payload?.tooltipLabel ?? label
  return (
    <div className="min-w-[150px] rounded-xl border border-bg-border bg-bg-secondary px-3 py-2 text-[12px] shadow-floating">
      <p className="mb-1 font-semibold text-txt-heading">{title}</p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-txt-body">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums text-txt-heading">
            {format(Number(p.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  )
}

export type TrendSeries = { key: string; name: string; color: string; dashed?: boolean }

const axisProps = {
  stroke: "var(--chart-axis)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const

/**
 * Time series: solid current series (area fill when there is exactly one), dashed previous period.
 * One y-axis only.
 */
export function TrendChart({
  data,
  series,
  format = (n) => n.toLocaleString(),
  tickFormat,
  minMax = 4,
  height = 220,
}: {
  data: Record<string, unknown>[]
  series: TrendSeries[]
  format?: (n: number) => string
  /** Short axis labels (defaults to `format`). */
  tickFormat?: (n: number) => string
  /** Smallest y-axis top, so an all-zero series still gets whole-unit ticks. */
  minMax?: number
  height?: number
}) {
  const id = React.useId().replace(/:/g, "")
  const solid = series.filter((s) => !s.dashed)
  const filled = solid.length === 1
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {solid.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis
            {...axisProps}
            width={48}
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(max, minMax)]}
            tickFormatter={(v: number) => (tickFormat ?? format)(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
            content={<TooltipCard format={format} />}
          />
          {series
            .filter((s) => s.dashed)
            .map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-bg-secondary)" }}
                isAnimationActive={false}
              />
            ))}
          {solid.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={filled ? `url(#${id}-${s.key})` : "transparent"}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--color-bg-secondary)" }}
              animationDuration={600}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Grouped vertical bars (e.g. credits bought vs spent). */
export function BarsChart({
  data,
  series,
  format = (n) => n.toLocaleString(),
  tickFormat,
  height = 220,
}: {
  data: Record<string, unknown>[]
  series: TrendSeries[]
  format?: (n: number) => string
  tickFormat?: (n: number) => string
  height?: number
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axisProps} minTickGap={24} />
          <YAxis
            {...axisProps}
            width={48}
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(max, 4)]}
            tickFormatter={(v: number) => (tickFormat ?? format)(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--color-bg-hover)", opacity: 0.6 }}
            content={<TooltipCard format={format} />}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              animationDuration={600}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Ranked horizontal bars (one series, one colour), value at the end. */
export function RankedBars({
  rows,
  format = (n) => n.toLocaleString(),
  color = CHART[0],
  empty = "No data in this range",
  onSelect,
}: {
  rows: { key: string; label: string; value: number; sub?: string }[]
  format?: (n: number) => string
  color?: string
  empty?: string
  onSelect?: (key: string) => void
}) {
  if (!rows.length) return <p className="py-8 text-center text-[13px] text-txt-caption">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="truncate font-medium text-txt-heading">{r.label}</span>
              <span className="shrink-0 tabular-nums text-txt-body">
                {format(r.value)}
                {r.sub && <span className="ml-1.5 text-txt-caption">{r.sub}</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-hover/80">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }}
              />
            </div>
          </>
        )
        return (
          <li key={r.key} title={`${r.label}: ${format(r.value)}`}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(r.key)}
                className="w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {inner}
              </button>
            ) : (
              inner
            )}
          </li>
        )
      })}
    </ol>
  )
}
