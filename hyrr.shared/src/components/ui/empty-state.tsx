import type { LucideIcon } from "lucide-react"
import * as React from "react"
import { toneClass, type Tone } from "../../lib/tones"
import { cn } from "../../lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
  /** Icon colour family (default violet). */
  tone?: Tone
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "violet",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 border border-dashed border-bg-border rounded-card bg-bg-secondary/40 min-h-[280px] select-none",
        className
      )}
    >
      <div
        className={cn(
          toneClass(tone),
          "relative mb-4 shrink-0 rounded-[18px] bg-[var(--tone-bg)] p-4 ring-1 ring-[var(--tone-ring)] shadow-[0_10px_30px_-10px_var(--tone-glow)] animate-rise"
        )}
      >
        <Icon className="h-8 w-8 stroke-[1.8] text-[var(--tone-fg)]" />
      </div>
      <h3 className="text-card-title font-semibold text-txt-heading mb-1">{title}</h3>
      <p className="text-body text-txt-body max-w-xs mb-5 leading-relaxed">{description}</p>
      {action}
    </div>
  )
}
