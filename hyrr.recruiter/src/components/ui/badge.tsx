import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors border select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--badge-primary-bg)] border-[var(--badge-primary-border)] text-[var(--badge-primary-text)]",
        success:
          "bg-[var(--badge-success-bg)] border-[var(--badge-success-border)] text-[var(--badge-success-text)]",
        info: "bg-[var(--badge-info-bg)] border-[var(--badge-info-border)] text-[var(--badge-info-text)]",
        warning:
          "bg-[var(--badge-warning-bg)] border-[var(--badge-warning-border)] text-[var(--badge-warning-text)]",
        destructive:
          "bg-[var(--badge-destructive-bg)] border-[var(--badge-destructive-border)] text-[var(--badge-destructive-text)]",
        secondary:
          "bg-[var(--badge-secondary-bg)] border-[var(--badge-secondary-border)] text-[var(--badge-secondary-text)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
