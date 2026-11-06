import { BadgeCheck } from "lucide-react"
import { cn } from "../../lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

export interface VerifiedBadgeProps {
  size?: "sm" | "md"
  /** false inside another interactive element (e.g. a card that is a <button>). */
  focusable?: boolean
  className?: string
}

/** Small check shown next to the name of a domain-verified company. */
export function VerifiedBadge({ size = "sm", focusable = true, className }: VerifiedBadgeProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label="Verified company"
            tabIndex={focusable ? 0 : undefined}
            className={cn(
              "inline-flex shrink-0 items-center text-primary align-middle rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              className
            )}
          >
            <BadgeCheck
              className={size === "md" ? "h-4.5 w-4.5" : "h-3.5 w-3.5"}
              aria-hidden="true"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>Verified company</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
