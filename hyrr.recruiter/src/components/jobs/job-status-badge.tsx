import {
  Badge,
  TonePill,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type Job,
} from "hyrr.shared"
import { ShieldAlert } from "lucide-react"
import { FLAGGED_JOB_TOOLTIP, isFlaggedJob, type BadgeVariant } from "../../lib/recruiter"

function statusVariant(status: Job["status"]): BadgeVariant {
  if (status === "Active") return "success"
  if (status === "Draft") return "info"
  return "secondary"
}

/**
 * "Under review" badge with an explanatory tooltip (keyboard-focusable). Inside another
 * interactive element (a card button) pass `interactive={false}`: the explanation is then
 * exposed via `title` and screen-reader text instead of a nested button.
 */
export function UnderReviewBadge({
  className,
  interactive = true,
}: {
  className?: string
  interactive?: boolean
}) {
  if (!interactive) {
    return (
      <Badge variant="warning" className={`gap-1 ${className ?? ""}`} title={FLAGGED_JOB_TOOLTIP}>
        <ShieldAlert className="w-3 h-3" aria-hidden="true" />
        Under review
        <span className="sr-only">. {FLAGGED_JOB_TOOLTIP}</span>
      </Badge>
    )
  }
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Under review. ${FLAGGED_JOB_TOOLTIP}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-full cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Badge variant="warning" className={`gap-1 ${className ?? ""}`}>
              <ShieldAlert className="w-3 h-3" aria-hidden="true" />
              Under review
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] whitespace-normal">
          {FLAGGED_JOB_TOOLTIP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Job status badge: flagged jobs show "Under review", the rest their status label. */
export function JobStatusBadge({
  job,
  className,
  interactive = true,
}: {
  job: Pick<Job, "status"> & Partial<Pick<Job, "removedAt" | "removedReason">>
  className?: string
  interactive?: boolean
}) {
  if (job.removedAt)
    return (
      <TonePill
        tone="rose"
        className={className}
        // The reason is also shown in the job panel; here it is the hover text.
      >
        <span
          title={job.removedReason ? `Removed by Hyrr: ${job.removedReason}` : "Removed by Hyrr"}
        >
          Removed by Hyrr
        </span>
      </TonePill>
    )
  if (isFlaggedJob(job)) return <UnderReviewBadge className={className} interactive={interactive} />
  return (
    <Badge variant={statusVariant(job.status)} className={className}>
      {job.status}
    </Badge>
  )
}
