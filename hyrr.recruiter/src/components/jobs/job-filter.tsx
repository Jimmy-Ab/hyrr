import { ActiveIndicator, FilterChips, jobColorTone, type FilterChipOption } from "hyrr.shared"
import { BarChart3, Kanban, List } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useJobStore } from "../../store/useJobStore"

const MAX_CHIPS = 7

/** Reads/writes `?job=<id>` so a filtered view survives reloads and can be shared. */
function useJobQueryParam() {
  const selectedJobId = useJobStore((s) => s.selectedJobId)
  const selectJob = useJobStore((s) => s.selectJob)
  const jobs = useJobStore((s) => s.jobs)

  // URL → store (once jobs are known).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("job")
    if (fromUrl && fromUrl !== selectedJobId && jobs.some((j) => j.id === fromUrl))
      selectJob(fromUrl)
  }, [jobs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Store → URL (replace, no extra history entries).
  useEffect(() => {
    const url = new URL(window.location.href)
    if (selectedJobId) url.searchParams.set("job", selectedJobId)
    else url.searchParams.delete("job")
    if (url.href !== window.location.href)
      window.history.replaceState(window.history.state, "", url)
  }, [selectedJobId])
}

/**
 * One job filter for every recruiter page (board, list, dashboard, calendar, messages, analytics).
 * Bound to the store's `selectedJobId` ("" = all jobs), so the choice follows you between pages.
 * `counts` maps jobId → number shown on each chip (e.g. applicants or events).
 */
export function JobFilter({
  id,
  counts,
  total,
  className,
}: {
  id: string
  counts?: Record<string, number>
  total?: number
  className?: string
}) {
  const jobs = useJobStore((s) => s.jobs)
  const selectedJobId = useJobStore((s) => s.selectedJobId)
  const selectJob = useJobStore((s) => s.selectJob)
  useJobQueryParam()

  const ordered = useMemo(
    () => [...jobs].sort((a, b) => (counts?.[b.id] ?? 0) - (counts?.[a.id] ?? 0)),
    [jobs, counts]
  )
  // Chips for the busiest jobs; the rest (and the selected one if hidden) in a select.
  const chipJobs = ordered.slice(0, MAX_CHIPS)
  const overflow = ordered.slice(MAX_CHIPS)
  const selectedInOverflow = overflow.some((j) => j.id === selectedJobId)
  const options: FilterChipOption<string>[] = [
    { value: "", label: "All jobs", count: total, tone: "violet" },
    ...chipJobs.map((j) => ({
      value: j.id,
      label: j.title,
      count: counts?.[j.id],
      dot: jobColorTone(j.color),
      tone: jobColorTone(j.color),
    })),
  ]

  if (jobs.length === 0) return null
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <FilterChips
        id={`${id}-jobs`}
        label="Filter by job"
        options={options}
        value={selectedInOverflow ? "__overflow" : selectedJobId}
        onChange={selectJob}
        className="min-w-0"
      />
      {overflow.length > 0 && (
        <>
          <label htmlFor={`${id}-more-jobs`} className="sr-only">
            More jobs
          </label>
          <select
            id={`${id}-more-jobs`}
            value={selectedInOverflow ? selectedJobId : ""}
            onChange={(e) => selectJob(e.target.value)}
            className={`h-9 max-w-[200px] shrink-0 cursor-pointer truncate rounded-[12px] border px-2.5 text-[12.5px] font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 ${
              selectedInOverflow
                ? "border-primary/40 bg-primary-light text-primary"
                : "border-bg-border bg-bg-secondary text-txt-body"
            }`}
          >
            <option value="">{`More jobs (${overflow.length})`}</option>
            {overflow.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
                {counts?.[j.id] !== undefined ? ` (${counts[j.id]})` : ""}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}

/** Board / List / Analytics switch for the pipeline pages. */
export function PipelineViewSwitch({
  current,
}: {
  current: "Applications" | "Candidates" | "Analytics"
}) {
  const setActiveView = useJobStore((s) => s.setActiveView)
  const items = [
    { view: "Applications" as const, label: "Board", icon: Kanban },
    { view: "Candidates" as const, label: "List", icon: List },
    { view: "Analytics" as const, label: "Analytics", icon: BarChart3 },
  ]
  return (
    <div
      role="group"
      aria-label="Pipeline view"
      className="flex shrink-0 gap-1 rounded-xl border border-bg-border/70 bg-bg-secondary/80 p-1"
    >
      {items.map(({ view, label, icon: Icon }) => {
        const active = view === current
        return (
          <button
            key={view}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => !active && setActiveView(view)}
            className={`press relative isolate flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
              active ? "text-primary" : "text-txt-body hover:text-txt-heading"
            }`}
          >
            {active && <ActiveIndicator layoutId="pipeline-view" className="rounded-lg" />}
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** Applicants per job (for JobFilter counts). */
export function useApplicantCounts() {
  const candidates = useJobStore((s) => s.candidates)
  return useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of candidates) counts[c.jobId] = (counts[c.jobId] ?? 0) + 1
    return { counts, total: candidates.length }
  }, [candidates])
}
