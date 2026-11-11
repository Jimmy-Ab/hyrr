import { Sparkles } from "lucide-react"
import { matchLevel, scoreTone, toneClass } from "../../lib/tones"
import { cn } from "../../lib/utils"

/**
 * Colour-coded match score pill (seeker job matches, recruiter candidate scores):
 * high (>= 70) green, medium (40-69) yellow, low (< 40) red. Bold, tabular number; the level is
 * also in the accessible name so colour is never the only signal.
 */
export function MatchScore({
  score,
  suffix = "match",
  icon = true,
  size = "sm",
  title,
  className,
}: {
  score: number
  /** Text after the percentage ("match"); "" shows the percentage only. */
  suffix?: string
  icon?: boolean
  size?: "xs" | "sm" | "md"
  title?: string
  className?: string
}) {
  const value = Math.max(0, Math.min(100, Math.round(score)))
  const level = matchLevel(value)
  const label = `${value}%${suffix ? ` ${suffix}` : ""}`
  return (
    <span
      data-testid="match-score"
      data-level={level}
      title={title ?? `${label} (${level})`}
      className={cn(
        toneClass(scoreTone(value)),
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--tone-bg)] font-bold tabular-nums text-[var(--tone-fg)] ring-1 ring-inset ring-[var(--tone-ring)]",
        size === "xs" && "px-1.5 py-0.5 text-[10.5px]",
        size === "sm" && "px-2 py-0.5 text-[11.5px]",
        size === "md" && "px-2.5 py-1 text-[13px]",
        className
      )}
    >
      {icon && (
        <Sparkles className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden="true" />
      )}
      {label}
      <span className="sr-only">, {level}</span>
    </span>
  )
}
