import type { LucideIcon } from "lucide-react"
import * as React from "react"
import { toneClass, type Tone } from "../../lib/tones"
import { cn } from "../../lib/utils"
import { Card } from "./card"
import { ActiveIndicator, AnimatedNumber } from "./motion"

/**
 * Tone-aware building blocks. Pick the tone from lib/tones.ts (stageTone, eventTone, …) so a
 * meaning keeps one colour across both apps. See the hyrr-ui skill ("Tones").
 */

/** Tinted icon square; glows softly when its `group` parent is hovered. */
export function IconTile({
  icon: Icon,
  tone,
  size = "md",
  className,
}: {
  icon: LucideIcon
  tone: Tone
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const box =
    size === "sm"
      ? "h-8 w-8 rounded-[10px]"
      : size === "lg"
        ? "h-12 w-12 rounded-[14px]"
        : "h-10 w-10 rounded-xl"
  const glyph = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5"
  return (
    <span
      className={cn(
        toneClass(tone),
        box,
        "inline-flex shrink-0 items-center justify-center bg-[var(--tone-bg)] text-[var(--tone-fg)] ring-1 ring-[var(--tone-ring)] transition-[box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-3 group-hover:scale-105 group-hover:shadow-[0_6px_18px_-4px_var(--tone-glow)]",
        className
      )}
    >
      <Icon className={glyph} aria-hidden="true" />
    </span>
  )
}

/** Dashboard metric: tone wash, coloured hairline, count-up value. */
export function StatCard({
  title,
  value,
  caption,
  icon,
  tone,
  onClick,
  active,
  className,
}: {
  title: string
  value: number | string
  caption?: React.ReactNode
  icon: LucideIcon
  tone: Tone
  onClick?: () => void
  /** Highlights the card (e.g. when it is the current filter). */
  active?: boolean
  className?: string
}) {
  const body = (
    <>
      <span className="tone-wash" aria-hidden="true" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-txt-caption">
          {title}
        </span>
        <IconTile icon={icon} tone={tone} />
      </div>
      <div className="relative z-10 mt-4 flex items-baseline gap-2">
        <span className="text-[30px] font-bold leading-none tracking-[-0.02em] text-txt-title tabular-nums">
          {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        </span>
        {caption && <span className="text-[12px] font-medium text-txt-caption">{caption}</span>}
      </div>
    </>
  )
  return (
    <Card
      hoverEffect
      className={cn(
        "tone-card group flex min-h-[132px] flex-col justify-between p-5",
        toneClass(tone),
        onClick && "cursor-pointer",
        active && "ring-2 ring-[var(--tone-ring)]",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      aria-pressed={onClick ? !!active : undefined}
    >
      {body}
    </Card>
  )
}

/** Status pill with a tone dot (stages, job status, …). */
export function TonePill({
  tone,
  children,
  className,
}: {
  tone: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        toneClass(tone),
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--tone-bg)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--tone-fg)] ring-1 ring-inset ring-[var(--tone-ring)]",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--tone-fg)]" aria-hidden="true" />
      {children}
    </span>
  )
}

export interface FilterChipOption<T extends string> {
  value: T
  label: string
  count?: number
  tone?: Tone
  /** Small colour dot (e.g. a job's colour). */
  dot?: Tone
}

/**
 * Segmented filter with a sliding highlight. Each chip may carry a tone (active state tinted in it)
 * and a count. Scrolls horizontally when it doesn't fit.
 */
export function FilterChips<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** Unique per page (used for the sliding highlight). */
  id: string
  label: string
  options: FilterChipOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "custom-scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-[14px] border border-bg-border/70 bg-bg-secondary/80 p-1",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        const tone = o.tone ?? "violet"
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              toneClass(tone),
              "press relative isolate inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-200",
              active
                ? "text-[var(--tone-fg)]"
                : "text-txt-body hover:bg-bg-hover/70 hover:text-txt-heading"
            )}
          >
            {active && (
              <ActiveIndicator
                layoutId={`filter-${id}`}
                className="rounded-[10px] bg-[var(--tone-bg)] ring-1 ring-[var(--tone-ring)]"
              />
            )}
            {o.dot && (
              <span
                className={cn(toneClass(o.dot), "h-2 w-2 rounded-full bg-[var(--tone-fg)]")}
                aria-hidden="true"
              />
            )}
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-[var(--tone-fg)]/15" : "bg-bg-primary text-txt-caption"
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Page title row: tone icon tile, title, subtitle and actions. */
export function PageHeader({
  title,
  subtitle,
  icon,
  tone = "violet",
  actions,
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="group flex min-w-0 items-center gap-3.5">
        {icon && <IconTile icon={icon} tone={tone} size="lg" />}
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-bold tracking-[-0.02em] text-txt-title md:text-[30px]">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 text-[13.5px] text-txt-body">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
