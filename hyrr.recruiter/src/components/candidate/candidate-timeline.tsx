import { Skeleton, type TimelineEntry } from "hyrr.shared"
import { History } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { errorMessage, formatDateTime, relativeTime } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"

export function CandidateTimeline({ applicationId }: { applicationId: string }) {
  const fetchTimeline = useJobStore((s) => s.fetchTimeline)
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setEntries(await fetchTimeline(applicationId))
    } catch (err) {
      setError(errorMessage(err, "Could not load the timeline."))
    }
  }, [applicationId, fetchTimeline])

  useEffect(() => {
    setEntries(null)
    load()
  }, [load])

  if (error) {
    return (
      <div role="alert" className="text-[13px] text-sec-red flex items-center gap-2">
        {error}
        <button
          type="button"
          onClick={load}
          className="font-semibold text-primary hover:underline cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  if (entries === null) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading timeline">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <History className="w-6 h-6 text-txt-caption" />
        <p className="text-[13px] text-txt-caption">No stage changes recorded yet.</p>
      </div>
    )
  }

  return (
    <ol className="relative border-l border-bg-border ml-2 space-y-4">
      {entries.map((entry, i) => (
        <li key={`${entry.at}-${i}`} className="pl-5 relative">
          <span
            aria-hidden="true"
            className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-bg-secondary"
          />
          <p className="text-[13.5px] font-semibold text-txt-heading">{entry.label}</p>
          <p className="text-[12px] text-txt-caption mt-0.5">
            <time dateTime={entry.at} title={formatDateTime(entry.at)}>
              {relativeTime(entry.at)}
            </time>
            {entry.actorName ? ` · by ${entry.actorName}` : ""}
          </p>
        </li>
      ))}
    </ol>
  )
}
