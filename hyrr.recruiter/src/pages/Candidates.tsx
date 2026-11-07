import {
  Button,
  Card,
  EmptyState,
  FilterChips,
  jobColorTone,
  PageHeader,
  scoreTone,
  stageTone,
  toneClass,
  TonePill,
  useToast,
  type BulkAction,
  type Candidate,
  type FilterChipOption,
} from "hyrr.shared"
import {
  Archive,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Bookmark,
  Mail,
  MapPin,
  MessageSquare,
  Search,
  SearchX,
  StickyNote,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AiScoreChips } from "../components/ai/ai-score"
import { BulkActionDialog } from "../components/candidates/bulk-action-dialog"
import { JobFilter, PipelineViewSwitch, useApplicantCounts } from "../components/jobs/job-filter"
import { LabelChips, LabelFilterSelect, matchesLabel } from "../components/labels/labels"
import { ConfirmDialog } from "../components/layout/confirm-dialog"
import { avatarFallback, errorMessage, PIPELINE_STATUSES, WITHDRAWN_STATUS } from "../lib/recruiter"
import { useJobStore } from "../store/useJobStore"

const STAGES = [...PIPELINE_STATUSES, WITHDRAWN_STATUS] as const
type SortKey = "recent" | "name" | "ai"

/** Recruiter candidates directory: job + stage + label filters, sortable, bulk actions. */
export function Candidates() {
  const {
    candidates,
    jobs,
    selectedJobId,
    selectJob,
    toggleBookmark,
    deleteCandidate,
    searchQuery,
    setSearchQuery,
    setSelectedCandidateId,
    openConversation,
    setActiveView,
    labelFilter,
    setLabelFilter,
  } = useJobStore()
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "recent",
    dir: "desc",
  })
  const [pendingDelete, setPendingDelete] = useState<Candidate | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [bulkTargets, setBulkTargets] = useState<Candidate[]>([])
  const { counts: jobCounts, total } = useApplicantCounts()

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const currentJob = selectedJobId ? jobById.get(selectedJobId) : undefined

  // Job + search + label narrow the set; the stage chips then show counts within it.
  const query = searchQuery.trim().toLowerCase()
  const inScope = candidates.filter((c) => {
    if (selectedJobId && c.jobId !== selectedJobId) return false
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      (c.email || "").toLowerCase().includes(query) ||
      (c.title || "").toLowerCase().includes(query) ||
      (c.location || "").toLowerCase().includes(query) ||
      (jobById.get(c.jobId)?.title || "").toLowerCase().includes(query)
    return matchesSearch && matchesLabel(c, labelFilter)
  })
  const stageCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of inScope) out[c.status] = (out[c.status] ?? 0) + 1
    return out
  }, [inScope])

  const filteredCandidates = useMemo(() => {
    const rows = inScope
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => statusFilter === "All" || c.status === statusFilter)
    const dir = sort.dir === "asc" ? 1 : -1
    rows.sort((a, b) => {
      if (sort.key === "name") return a.c.name.localeCompare(b.c.name) * dir
      if (sort.key === "ai") return ((a.c.aiScore ?? -1) - (b.c.aiScore ?? -1)) * dir
      // "recent": the API returns newest first.
      return (b.index - a.index) * dir
    })
    return rows.map((r) => r.c)
  }, [inScope, statusFilter, sort])

  // Selection only ever covers visible rows: drop ids hidden by filters or deleted.
  const visibleKey = filteredCandidates.map((c) => c.id).join(",")
  const visibleIds = useMemo(() => new Set(visibleKey ? visibleKey.split(",") : []), [visibleKey])
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleIds])

  const selectedCount = selected.size
  const allSelected = filteredCandidates.length > 0 && selectedCount === filteredCandidates.length
  const someSelected = selectedCount > 0 && !allSelected
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filteredCandidates.map((c) => c.id)))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const startBulk = (action: BulkAction) => {
    setBulkTargets(filteredCandidates.filter((c) => selected.has(c.id)))
    setBulkAction(action)
  }

  const handleBookmark = async (c: Candidate) => {
    try {
      await toggleBookmark(c.id)
    } catch (err) {
      toast("Could not update bookmark", errorMessage(err), "error")
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteCandidate(pendingDelete.id)
      toast("Candidate deleted", `${pendingDelete.name} was removed.`, "success")
    } catch (err) {
      toast("Could not delete candidate", errorMessage(err), "error")
      throw err
    }
  }

  const message = (c: Candidate) => {
    setActiveView("Messages")
    openConversation(c.id).catch((err: unknown) =>
      toast("Could not open conversation", errorMessage(err), "error")
    )
  }

  const hasFilters = !!selectedJobId || statusFilter !== "All" || !!query || !!labelFilter
  const clearFilters = () => {
    selectJob("")
    setStatusFilter("All")
    setSearchQuery("")
    setLabelFilter(null)
  }

  const stageOptions: FilterChipOption<string>[] = [
    { value: "All", label: "All stages", count: inScope.length, tone: "violet" },
    ...STAGES.map((s) => ({ value: s, label: s, count: stageCounts[s] ?? 0, tone: stageTone(s) })),
  ]

  const sortHeader = (key: SortKey, label: string) => {
    const active = sort.key === key
    const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({
            key,
            dir:
              s.key === key ? (s.dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc",
          }))
        }
        className={`group/sort inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider transition-colors ${
          active ? "text-txt-heading" : "hover:text-txt-heading"
        }`}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Arrow
          className={`h-3 w-3 transition-all duration-300 ${active ? "opacity-100" : "opacity-0 group-hover/sort:opacity-50"}`}
          aria-hidden="true"
        />
      </button>
    )
  }

  const emptyTitle = currentJob
    ? `No candidates for ${currentJob.title}${statusFilter !== "All" ? ` in ${statusFilter}` : ""}`
    : statusFilter !== "All"
      ? `No candidates in ${statusFilter}`
      : "No candidates match"

  return (
    <div className="relative flex min-w-0 flex-col gap-6">
      <PageHeader
        icon={Users}
        tone="blue"
        title={currentJob ? currentJob.title : "Candidates"}
        subtitle={
          currentJob
            ? `${jobCounts[currentJob.id] ?? 0} applicant${(jobCounts[currentJob.id] ?? 0) === 1 ? "" : "s"} · ${[currentJob.location, currentJob.type].filter(Boolean).join(" · ")}`
            : `${total} candidate${total === 1 ? "" : "s"} across ${jobs.length} job${jobs.length === 1 ? "" : "s"}`
        }
        actions={<PipelineViewSwitch current="Candidates" />}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <JobFilter id="candidates" counts={jobCounts} total={total} />
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="candidates-search" className="sr-only">
              Search candidates
            </label>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-caption" />
            <input
              id="candidates-search"
              type="search"
              placeholder="Search by name, email, job or location…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-[12px] border border-bg-border bg-bg-secondary pl-10 pr-4 text-[13px] text-txt-heading placeholder:text-txt-caption transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <LabelFilterSelect id="candidates-label-filter" />
        </div>
        <FilterChips
          id="candidates-stage"
          label="Filter by stage"
          options={stageOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          className="self-start"
        />
      </div>

      {filteredCandidates.length === 0 ? (
        <EmptyState
          icon={SearchX}
          tone="blue"
          title={emptyTitle}
          description={
            hasFilters
              ? "Try another job or stage, or clear the filters."
              : "Applications will appear here as candidates apply."
          }
          action={
            hasFilters ? (
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="min-w-0 overflow-hidden p-0">
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[40px_minmax(220px,2.2fr)_minmax(160px,1.4fr)_130px_150px_110px_112px] items-center gap-3 border-b border-bg-border/60 px-5 py-3 text-[11px] font-semibold text-txt-caption">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all visible candidates"
                className="h-4 w-4 cursor-pointer rounded accent-primary"
              />
              {sortHeader("name", "Candidate")}
              <span className="uppercase tracking-wider">Job</span>
              <span className="uppercase tracking-wider">Stage</span>
              {sortHeader("ai", "AI match")}
              {sortHeader("recent", "Applied")}
              <span className="text-right uppercase tracking-wider">Actions</span>
            </div>
            <ul className="stagger divide-y divide-bg-border/50">
              {filteredCandidates.map((c) => {
                const job = jobById.get(c.jobId)
                const tone = stageTone(c.status)
                const isSelected = selected.has(c.id)
                return (
                  <li
                    key={c.id}
                    className={`group relative grid grid-cols-[40px_minmax(220px,2.2fr)_minmax(160px,1.4fr)_130px_150px_110px_112px] items-center gap-3 px-5 py-3.5 transition-colors duration-200 ${toneClass(tone)} ${
                      isSelected ? "bg-primary-light/50" : "hover:bg-bg-hover/40"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-[3px] origin-center scale-y-0 rounded-full bg-[var(--tone-fg)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100"
                    />
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(c.id)}
                      aria-label={`Select ${c.name}`}
                      className="h-4 w-4 cursor-pointer rounded accent-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedCandidateId(c.id)}
                      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
                    >
                      <img
                        src={c.avatar || avatarFallback(c.name)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[var(--tone-ring)] ring-offset-2 ring-offset-bg-card transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-semibold text-txt-heading transition-colors group-hover:text-primary">
                            {c.name}
                          </span>
                          {c.notesCount > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-txt-caption"
                              title={`${c.notesCount} note${c.notesCount === 1 ? "" : "s"}`}
                            >
                              <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                              {c.notesCount}
                              <span className="sr-only"> notes</span>
                            </span>
                          )}
                        </span>
                        <span className="flex min-w-0 items-center gap-2 text-[12px] text-txt-caption">
                          {c.email && (
                            <span className="inline-flex min-w-0 items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{c.email}</span>
                            </span>
                          )}
                          {c.location && (
                            <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap lg:inline-flex">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                              {c.location}
                            </span>
                          )}
                        </span>
                        <LabelChips labels={c.labels} />
                      </span>
                    </button>
                    {job ? (
                      <button
                        type="button"
                        onClick={() => selectJob(job.id)}
                        title={`Show only ${job.title}`}
                        className={`inline-flex min-w-0 max-w-full cursor-pointer items-center gap-2 justify-self-start rounded-full border border-bg-border/70 bg-bg-secondary px-2.5 py-1 text-[12px] font-medium text-txt-body transition-colors hover:border-primary/30 hover:text-txt-heading ${toneClass(jobColorTone(job.color))}`}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[var(--tone-fg)]"
                          aria-hidden="true"
                        />
                        <span className="truncate">{job.title}</span>
                      </button>
                    ) : (
                      <span className="truncate text-[12.5px] text-txt-caption">
                        {c.title || "—"}
                      </span>
                    )}
                    <TonePill tone={tone} className="justify-self-start">
                      {c.status}
                    </TonePill>
                    <ScoreCell c={c} />
                    <span className="text-[12.5px] font-medium text-txt-caption">{c.dateText}</span>
                    <div className="flex items-center justify-end gap-1">
                      <RowAction
                        label={
                          c.bookmarked ? `Remove bookmark for ${c.name}` : `Bookmark ${c.name}`
                        }
                        pressed={c.bookmarked}
                        onClick={() => handleBookmark(c)}
                        visible={c.bookmarked}
                        className={c.bookmarked ? "text-primary" : ""}
                      >
                        <Bookmark
                          className="h-4 w-4"
                          fill={c.bookmarked ? "currentColor" : "none"}
                        />
                      </RowAction>
                      <RowAction label={`Message ${c.name}`} onClick={() => message(c)}>
                        <MessageSquare className="h-4 w-4" />
                      </RowAction>
                      <RowAction
                        label={`Delete ${c.name}`}
                        onClick={() => setPendingDelete(c)}
                        className="hover:!bg-sec-red/10 hover:!text-sec-red"
                      >
                        <Trash2 className="h-4 w-4" />
                      </RowAction>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Phone cards */}
          <ul className="stagger divide-y divide-bg-border/50 md:hidden">
            {filteredCandidates.map((c) => {
              const job = jobById.get(c.jobId)
              const tone = stageTone(c.status)
              return (
                <li key={c.id} className={`flex items-start gap-3 p-4 ${toneClass(tone)}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    aria-label={`Select ${c.name}`}
                    className="mt-3 h-4 w-4 cursor-pointer rounded accent-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateId(c.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                  >
                    <img
                      src={c.avatar || avatarFallback(c.name)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[var(--tone-ring)] ring-offset-2 ring-offset-bg-card"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-[14px] font-semibold text-txt-heading">
                        {c.name}
                      </span>
                      <span className="truncate text-[12px] text-txt-caption">
                        {job?.title || c.title} · {c.dateText}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <TonePill tone={tone}>{c.status}</TonePill>
                        <ScoreCell c={c} compact />
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {selectedCount > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="glass sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-bg-border/70 p-3 shadow-floating animate-rise"
        >
          <span className="px-1 text-[13px] font-semibold text-txt-heading" aria-live="polite">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="cursor-pointer rounded-lg p-1.5 text-txt-caption hover:bg-bg-hover hover:text-txt-heading"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" variant="secondary" onClick={() => startBulk("MOVE")}>
              <ArrowRightLeft className="h-3.5 w-3.5" /> Move to stage
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startBulk("ADD_LABEL")}>
              <Tag className="h-3.5 w-3.5" /> Add label
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startBulk("REMOVE_LABEL")}>
              <Tag className="h-3.5 w-3.5" /> Remove label
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startBulk("MESSAGE")}>
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </Button>
            <Button size="sm" variant="danger" onClick={() => startBulk("ARCHIVE")}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
          </div>
        </div>
      )}

      <BulkActionDialog
        action={bulkAction}
        candidates={bulkTargets}
        onOpenChange={(o) => !o && setBulkAction(null)}
        onDone={(ok) => setSelected((prev) => new Set([...prev].filter((id) => !ok.includes(id))))}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete candidate?"
        description={`${pendingDelete?.name ?? "This candidate"}'s application and its history will be permanently deleted.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/** AI match: coloured bar + score once scored; otherwise the status chips (pending, failed…). */
function ScoreCell({ c, compact }: { c: Candidate; compact?: boolean }) {
  if (c.aiScore == null) return <AiScoreChips candidate={c} />
  const tone = scoreTone(c.aiScore)
  return (
    <span
      className={`inline-flex items-center gap-2 ${toneClass(tone)}`}
      title={`AI match ${c.aiScore}%`}
    >
      {!compact && (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-border/70">
          <span
            className="block h-full rounded-full bg-[var(--tone-fg)] transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${Math.max(4, Math.min(100, c.aiScore))}%` }}
          />
        </span>
      )}
      <span className="text-[12.5px] font-semibold tabular-nums text-[var(--tone-fg)]">
        {c.aiScore}%
      </span>
    </span>
  )
}

/** Icon action that fades in on row hover (always visible when focused or `visible`). */
function RowAction({
  label,
  onClick,
  children,
  pressed,
  visible,
  className = "",
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  pressed?: boolean
  visible?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`press cursor-pointer rounded-full p-1.5 text-txt-caption transition-[opacity,color,background-color] duration-200 hover:bg-bg-hover hover:text-primary focus-visible:opacity-100 ${
        visible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      } ${className}`}
    >
      {children}
    </button>
  )
}
