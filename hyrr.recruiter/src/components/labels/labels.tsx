import type { CandidateLabel } from "hyrr.shared"
import { Tag } from "lucide-react"
import { useEffect } from "react"
import { useJobStore } from "../../store/useJobStore"

let labelsRequested = false

/** Company labels from the store; loads them once per session (callers may refetch). */
export function useCompanyLabels(): CandidateLabel[] {
  const labels = useJobStore((s) => s.labels)
  const fetchLabels = useJobStore((s) => s.fetchLabels)
  useEffect(() => {
    if (labelsRequested) return
    labelsRequested = true
    fetchLabels().catch(() => {
      labelsRequested = false
    })
  }, [fetchLabels])
  return labels
}

export function LabelDot({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    />
  )
}

export function LabelChip({ label }: { label: Pick<CandidateLabel, "name" | "color"> }) {
  return (
    <span className="inline-flex items-center gap-1 max-w-[140px] px-2 py-0.5 rounded-full border border-bg-border bg-bg-secondary text-[11px] font-semibold text-txt-body">
      <LabelDot color={label.color} />
      <span className="truncate">{label.name}</span>
    </span>
  )
}

export function LabelChips({
  labels,
  max = 3,
}: {
  labels: Pick<CandidateLabel, "id" | "name" | "color">[] | undefined
  max?: number
}) {
  if (!labels?.length) return null
  const shown = labels.slice(0, max)
  const rest = labels.length - shown.length
  return (
    <span className="inline-flex flex-wrap items-center gap-1 min-w-0">
      {shown.map((l) => (
        <LabelChip key={l.id} label={l} />
      ))}
      {rest > 0 && (
        <span
          className="text-[11px] font-semibold text-txt-caption"
          title={labels
            .slice(max)
            .map((l) => l.name)
            .join(", ")}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}

/** Filters the board / candidate list by one company label (store `labelFilter`). */
export function LabelFilterSelect({ id }: { id: string }) {
  const labels = useCompanyLabels()
  const labelFilter = useJobStore((s) => s.labelFilter)
  const setLabelFilter = useJobStore((s) => s.setLabelFilter)
  const current = labels.find((l) => l.id === labelFilter)

  // Drop a filter whose label was deleted.
  useEffect(() => {
    if (labelFilter && labels.length > 0 && !current) setLabelFilter(null)
  }, [labelFilter, labels, current, setLabelFilter])

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Filter by label
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
        {current ? (
          <LabelDot color={current.color} />
        ) : (
          <Tag className="w-3.5 h-3.5 text-txt-caption" />
        )}
      </span>
      <select
        id={id}
        value={labelFilter ?? ""}
        onChange={(e) => setLabelFilter(e.target.value || null)}
        className="h-10 max-w-[200px] truncate rounded-xl border border-bg-border bg-bg-secondary pl-8 pr-3 text-[13px] font-medium text-txt-heading cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="">All labels</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Client-side label filter for already-loaded candidates. */
export function matchesLabel(
  candidate: { labels?: { id: string }[] },
  labelId: string | null
): boolean {
  if (!labelId) return true
  return !!candidate.labels?.some((l) => l.id === labelId)
}
