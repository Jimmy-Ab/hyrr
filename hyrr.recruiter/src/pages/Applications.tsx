import { Button } from "hyrr.shared"
import { BarChart3, Kanban, List, Plus } from "lucide-react"
import { JobStatusBadge } from "../components/jobs/job-status-badge"
import { KanbanBoard } from "../components/kanban/kanban-board"
import { LabelFilterSelect } from "../components/labels/labels"
import { useJobStore } from "../store/useJobStore"

export function Applications() {
  const {
    jobs,
    candidates,
    selectedJobId,
    selectJob,
    setActiveView,
    setAddCandidateOpen,
    setAddJobOpen,
  } = useJobStore()

  // No (or an unknown) selection means "All jobs": the board shows every candidate.
  const currentJob = jobs.find((j) => j.id === selectedJobId) || null

  if (jobs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-body text-txt-body font-semibold">
          You don't have any jobs yet. Create one to start tracking candidates.
        </p>
        <Button onClick={() => setAddJobOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Create Job Listing
        </Button>
      </div>
    )
  }

  const jobIds = new Set(jobs.map((j) => j.id))
  const totalCandidates = candidates.filter((c) => jobIds.has(c.jobId)).length

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200 relative min-w-0">
      {/* Job Title & Sub-header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-bold text-txt-title tracking-tight leading-tight break-words">
              {currentJob ? currentJob.title : "All applications"}
            </h1>
            {currentJob && <JobStatusBadge job={currentJob} className="rounded-md text-xs" />}
          </div>
          <p className="text-[13px] text-txt-caption mt-1.5 font-normal">
            {currentJob
              ? [currentJob.location, currentJob.type, currentJob.posted]
                  .filter(Boolean)
                  .join(" • ")
              : `${totalCandidates} candidate${totalCandidates === 1 ? "" : "s"} across ${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {/* Job filter + View Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="board-job-filter" className="sr-only">
            Show candidates for
          </label>
          <select
            id="board-job-filter"
            value={currentJob?.id ?? ""}
            onChange={(e) => selectJob(e.target.value)}
            className="h-10 max-w-[240px] truncate rounded-xl border border-bg-border bg-bg-secondary px-3 text-[13px] font-medium text-txt-heading cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          <LabelFilterSelect id="board-label-filter" />
          <div
            role="group"
            aria-label="Pipeline view"
            className="flex gap-1 bg-bg-secondary p-1 border border-bg-border rounded-xl shrink-0"
          >
            <button
              type="button"
              aria-current="page"
              className="h-8 rounded-lg gap-1.5 font-semibold text-xs cursor-default px-3 flex items-center bg-primary-light text-primary border border-primary-border/40"
            >
              <Kanban className="w-3.5 h-3.5 text-primary" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setActiveView("Candidates")}
              className="h-8 rounded-lg gap-1.5 font-medium text-xs cursor-pointer px-3 flex items-center text-txt-body hover:text-txt-heading hover:bg-bg-hover transition-colors"
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setActiveView("Analytics")}
              className="h-8 rounded-lg gap-1.5 font-medium text-xs cursor-pointer px-3 flex items-center text-txt-body hover:text-txt-heading hover:bg-bg-hover transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </button>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAddCandidateOpen(true, "Applied")}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add candidate
          </Button>
        </div>
      </div>

      {/* Kanban Board Container (scrolls horizontally inside itself) */}
      <div className="flex-1 min-w-0">
        <KanbanBoard jobId={currentJob?.id} />
      </div>
    </div>
  )
}
