import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "../../lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 border border-dashed border-bg-border rounded-card bg-bg-secondary/40 min-h-[280px] select-none",
        className
      )}
    >
      <div className="rounded-full bg-primary-light p-4 mb-4 border border-primary-border shrink-0">
        <Icon className="w-8 h-8 text-primary stroke-[1.8]" />
      </div>
      <h3 className="text-card-title font-semibold text-txt-heading mb-1">{title}</h3>
      <p className="text-body text-txt-body max-w-xs mb-5 leading-relaxed">{description}</p>
      {action}
    </div>
  )
}
