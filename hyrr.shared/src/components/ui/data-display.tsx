import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, RefreshCw, Search } from "lucide-react"
import * as React from "react"
import { errorMessage } from "../../lib/api"
import { change, initials, pct } from "../../lib/format"
import { toneClass, type Tone } from "../../lib/tones"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Card } from "./card"
import { Skeleton } from "./skeleton"

/** First-load skeleton for a list or panel. */
export function LoadingRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

/** Error with Retry (data views). */
export function ErrorBlock({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-bg-border bg-bg-secondary/40 px-6 py-12 text-center",
        className
      )}
    >
      <AlertTriangle className="h-8 w-8 text-sec-red" aria-hidden="true" />
      <div>
        <p className="text-[15px] font-semibold text-txt-heading">Couldn't load this</p>
        <p className="mt-1 text-[13px] text-txt-body">{errorMessage(error)}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  )
}

/** "Load more" footer for cursor lists. */
export function LoadMore({
  hasMore,
  loading,
  onClick,
  shown,
}: {
  hasMore: boolean
  loading: boolean
  onClick: () => void
  shown: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-3 text-[12px] text-txt-caption">
      <span className="tabular-nums">{shown.toLocaleString()} shown</span>
      {hasMore && (
        <Button size="sm" variant="secondary" onClick={onClick} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  )
}

/** ▲ 12% / ▼ 4% badge. `goodWhenUp=false` flips the colours (e.g. failures). */
export function Delta({
  current,
  previous,
  goodWhenUp = true,
  className,
}: {
  current: number
  previous: number
  goodWhenUp?: boolean
  className?: string
}) {
  const c = change(current, previous)
  const flat = c === 0
  const up = c === null ? current > 0 : c > 0
  const tone: Tone = flat ? "slate" : up === goodWhenUp ? "emerald" : "rose"
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  const label = c === null ? "new" : pct(Math.abs(c))
  return (
    <span
      className={cn(
        toneClass(tone),
        "inline-flex items-center gap-0.5 rounded-full bg-[var(--tone-bg)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--tone-fg)]",
        className
      )}
      title={`Previous period: ${previous.toLocaleString()}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">{flat ? "No change" : up ? "Up" : "Down"} </span>
      {label}
    </span>
  )
}

/** Tiny trend line (12 buckets), coloured by the parent tone. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 120
  const h = 32
  const id = React.useId().replace(/:/g, "")
  if (!values.length) return null
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => [i * step, h - 2 - (v / max) * (h - 4)] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `0,${h} ${line} ${w},${h}`
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--tone-fg)" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--tone-fg)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--tone-fg)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Debounced search box. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  className?: string
}) {
  const [text, setText] = React.useState(value)
  React.useEffect(() => setText(value), [value])
  React.useEffect(() => {
    if (text === value) return
    const t = setTimeout(() => onChange(text.trim()), 300)
    return () => clearTimeout(t)
  }, [text, value, onChange])
  const id = React.useId()
  return (
    <div className={cn("relative w-full sm:w-[300px]", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-caption"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-input border border-bg-border bg-bg-secondary pl-10 pr-3 text-[13px] text-txt-heading placeholder:text-txt-caption transition-all duration-200 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
    </div>
  )
}

/** Round avatar with initials fallback. */
export function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string
  src?: string | null
  size?: number
}) {
  const [broken, setBroken] = React.useState(false)
  const style = { width: size, height: size }
  if (src && !broken)
    return (
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover ring-1 ring-bg-border"
      />
    )
  return (
    <span
      style={style}
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-light text-[11px] font-bold text-primary ring-1 ring-primary-border/60"
    >
      {initials(name)}
    </span>
  )
}

/** Dense list table inside a card; wide content scrolls inside the card. */
export function DataTable({
  head,
  children,
  className,
}: {
  head: React.ReactNode[]
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-bg-border/70 bg-bg-primary/60">
              {head.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-txt-caption"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">{children}</tbody>
        </table>
      </div>
    </Card>
  )
}

/** Clickable table row: opens the detail sheet on click or Enter. */
export function RowButton({
  onOpen,
  children,
  label,
}: {
  onOpen: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <tr
      tabIndex={0}
      aria-label={label}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer border-b border-bg-border/50 transition-colors duration-150 hover:bg-bg-hover/60 focus-visible:bg-bg-hover/60 focus-visible:outline-none"
    >
      {children}
    </tr>
  )
}

export const td = "px-4 py-3 align-middle"

/** Small "dot + label" health indicator. */
export function StatusDot({
  state,
  label,
}: {
  state: "ok" | "disabled" | "error" | string
  label: string
}) {
  const tone: Tone = state === "ok" ? "emerald" : state === "error" ? "rose" : "slate"
  const text = state === "ok" ? "OK" : state === "error" ? "Error" : "Off"
  return (
    <span className={cn(toneClass(tone), "inline-flex items-center gap-2 text-[13px]")}>
      <span className="relative flex h-2.5 w-2.5">
        {state === "ok" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--tone-fg)] opacity-30" />
        )}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--tone-fg)]" />
      </span>
      <span className="font-medium text-txt-heading">{label}</span>
      <span className="text-[12px] font-semibold text-[var(--tone-fg)]">{text}</span>
    </span>
  )
}
