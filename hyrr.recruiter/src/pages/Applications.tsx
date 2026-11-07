import { Button } from "hyrr.shared"
import { Plus } from "lucide-react"
import { JobStatusBadge } from "../components/jobs/job-status-badge"
import { JobFilter, PipelineViewSwitch, useApplicantCounts } from "../components/jobs/job-filter"
import { KanbanBoard } from "../components/kanban/kanban-board"
import { LabelFilterSelect } from "../components/labels/labels"
import { useJobStore } from "../store/useJobStore"

export function Applications() {
  const {
    jobs,
    candidates,
    selectedJobId,
    setAddCandidateOpen,
    setAddJobOpen,
  } = useJobStore()
  const { counts, total } = useApplicantCounts()

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
          <LabelFilterSelect id="board-label-filter" />
          <PipelineViewSwitch current="Applications" />

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

      <JobFilter id="board" counts={counts} total={total} />

      {/* Kanban Board Container (scrolls horizontally inside itself) */}
      <div className="flex-1 min-w-0">
        <KanbanBoard jobId={currentJob?.id} />
      </div>
    </div>
  )
}
