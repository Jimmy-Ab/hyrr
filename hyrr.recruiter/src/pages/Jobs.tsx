import { Button, Card, RichTextRenderer, useToast, VerifiedBadge, type Job } from "hyrr.shared"
import {
  ArrowUpRight,
  Briefcase,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Power,
  Search,
  Trash2,
} from "lucide-react"
import * as React from "react"
import { JobPublishErrorNotice } from "../components/jobs/job-publish-error"
import { JobStatusBadge } from "../components/jobs/job-status-badge"
import { ConfirmDialog } from "../components/layout/confirm-dialog"
import { EditJobDialog } from "../components/layout/edit-job-dialog"
import {
  errorMessage,
  FLAGGED_JOB_TOOLTIP,
  isFlaggedJob,
  jobPublishError,
  useCompanyVerified,
  type JobPublishError,
} from "../lib/recruiter"
import { useJobStore } from "../store/useJobStore"

type StatusFilter = "All" | "Active" | "Closed"

export function Jobs() {
  const {
    jobs,
    candidates,
    selectJob,
    setActiveView,
    setAddJobOpen,
    searchQuery,
    setSearchQuery,
    updateJob,
    deleteJob,
    workspaceName,
  } = useJobStore()
  const companyVerified = useCompanyVerified()
  const { toast } = useToast()

  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("All")
  const [editingJob, setEditingJob] = React.useState<Job | null>(null)
  const [deletingJob, setDeletingJob] = React.useState<Job | null>(null)
  const [statusBusy, setStatusBusy] = React.useState(false)
  // Publishing failure for one job (content policy / unverified e-mail), shown in its panel.
  const [statusError, setStatusError] = React.useState<{
    jobId: string
    error: JobPublishError
  } | null>(null)

  const query = searchQuery.trim().toLowerCase()
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      !query ||
      job.title.toLowerCase().includes(query) ||
      job.location.toLowerCase().includes(query)
    const matchesStatus = statusFilter === "All" || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Derived from the store so edits/deletes are reflected immediately.
  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? filteredJobs[0] ?? jobs[0] ?? null

  const getCandidatesCount = (jobId: string) => candidates.filter((c) => c.jobId === jobId).length

  const handleManageApplications = (job: Job) => {
    selectJob(job.id)
    setActiveView("Applications")
  }

  const handleToggleStatus = async (job: Job) => {
    // Flagged jobs stay hidden until moderation resolves the reports.
    if (isFlaggedJob(job)) return
    const next = job.status === "Active" ? "CLOSED" : "ACTIVE"
    const publishing = job.status === "Draft"
    setStatusBusy(true)
    setStatusError(null)
    try {
      await updateJob(job.id, { status: next })
      toast(
        next === "CLOSED" ? "Job closed" : publishing ? "Job published" : "Job reopened",
        next === "ACTIVE"
          ? `"${job.title}" is accepting applications${publishing ? "" : " again"}.`
          : `"${job.title}" no longer accepts applications.`,
        "success"
      )
    } catch (err) {
      const inline = jobPublishError(err)
      if (inline) setStatusError({ jobId: job.id, error: inline })
      else toast("Could not update job", errorMessage(err), "error")
    } finally {
      setStatusBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingJob) return
    try {
      await deleteJob(deletingJob.id)
      toast("Job deleted", `"${deletingJob.title}" was deleted.`, "success")
      if (selectedJobId === deletingJob.id) setSelectedJobId(null)
    } catch (err) {
      toast("Could not delete job", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 relative z-10">
        <div className="min-w-0">
          <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight text-txt-title">
            Open Roles
          </h1>
          {workspaceName && (
            <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-txt-heading">
              {workspaceName}
              {companyVerified && <VerifiedBadge size="md" />}
            </p>
          )}
          <p className="text-body text-txt-body mt-1 font-semibold opacity-90">
            Manage your hiring vacancies, view pipelines, and review applications.
          </p>
        </div>
        <Button onClick={() => setAddJobOpen(true)} className="cursor-pointer font-bold shrink-0">
          + Create Job Listing
        </Button>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="jobs-search" className="sr-only">
            Search jobs
          </label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <input
            id="jobs-search"
            type="search"
            placeholder="Search jobs by title or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-input border border-bg-border bg-bg-secondary text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          />
        </div>
        <div
          role="group"
          aria-label="Filter by status"
          className="flex gap-2 bg-bg-secondary p-1 border border-bg-border rounded-[14px] shrink-0 self-start"
        >
          {(["All", "Active", "Closed"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={statusFilter === filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-1.5 rounded-[10px] text-caption font-semibold cursor-pointer transition-all ${
                statusFilter === filter
                  ? "bg-primary text-white"
                  : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Grid split: Job Lists & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Job List */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-w-0">
          {filteredJobs.map((job) => {
            const isSelected = selectedJob?.id === job.id
            const count = getCandidatesCount(job.id)

            return (
              <button
                key={job.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedJobId(job.id)}
                className={`text-left w-full p-5 rounded-card bg-bg-card cursor-pointer transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/10 shadow-card-hover"
                    : "border-bg-border/60 hover:border-bg-border hover:shadow-card-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 min-w-0">
                    <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-primary-light border border-primary-border/30 items-center justify-center text-primary shrink-0">
                      <Briefcase className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-card-title font-semibold text-txt-heading leading-snug break-words">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-txt-body mt-2 font-medium">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-txt-caption" />
                          {job.location}
                        </span>
                        <span>{job.type}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-txt-caption" />
                          {job.posted}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <JobStatusBadge job={job} interactive={false} />
                    <span className="text-[12px] text-txt-caption font-semibold">
                      {count} applicant{count !== 1 && "s"}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}

          {filteredJobs.length === 0 && (
            <div className="p-12 text-center border border-dashed border-bg-border/60 bg-bg-secondary/40 rounded-card">
              <p className="text-body text-txt-body font-medium">
                {jobs.length === 0
                  ? "You haven't posted any jobs yet."
                  : "No jobs match your query."}
              </p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 min-w-0">
          {selectedJob ? (
            <Card className="p-6 border border-bg-border/60 bg-bg-secondary shadow-card flex flex-col gap-6 lg:sticky lg:top-6">
              <div className="flex items-start justify-between gap-4 border-b border-bg-border/30 pb-4">
                <div className="min-w-0">
                  <h2 className="text-[20px] font-bold text-txt-heading leading-tight break-words">
                    {selectedJob.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 text-caption text-txt-body mt-1.5 font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-txt-caption" />
                    <span>{selectedJob.location}</span>
                    <span>•</span>
                    <span>{selectedJob.type}</span>
                  </div>
                </div>
                <JobStatusBadge job={selectedJob} />
              </div>

              {isFlaggedJob(selectedJob) && (
                <p
                  role="status"
                  className="-mt-2 rounded-xl border border-sec-orange/30 bg-sec-orange/5 p-3 text-[13px] text-txt-body"
                >
                  {FLAGGED_JOB_TOOLTIP} You can still edit it and manage existing applicants.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingJob(selectedJob)}
                  className="gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={statusBusy || isFlaggedJob(selectedJob)}
                  title={isFlaggedJob(selectedJob) ? FLAGGED_JOB_TOOLTIP : undefined}
                  onClick={() => handleToggleStatus(selectedJob)}
                  className="gap-1.5"
                >
                  {statusBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Power className="w-3.5 h-3.5" />
                  )}
                  {selectedJob.status === "Active"
                    ? "Close job"
                    : selectedJob.status === "Draft"
                      ? "Publish job"
                      : "Reopen job"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeletingJob(selectedJob)}
                  className="gap-1.5 text-sec-red hover:text-sec-red"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </div>

              {statusError?.jobId === selectedJob.id && (
                <div className="-mt-4">
                  <JobPublishErrorNotice error={statusError.error} />
                </div>
              )}

              {/* Job Info Details */}
              <div className="flex flex-col gap-4 text-body text-txt-body leading-relaxed">
                <div>
                  <h3 className="text-[13px] font-bold text-txt-heading uppercase tracking-wider mb-1">
                    Role Description
                  </h3>
                  <RichTextRenderer content={selectedJob.description} />
                </div>

                <div>
                  <h3 className="text-[13px] font-bold text-txt-heading uppercase tracking-wider mb-1">
                    Requirements
                  </h3>
                  {selectedJob.requirements?.length ? (
                    <ul className="list-disc list-inside space-y-1 font-medium text-txt-body">
                      {selectedJob.requirements.map((req, i) => (
                        <li key={`${i}-${req}`}>{req}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-txt-caption">No requirements listed.</p>
                  )}
                </div>

                <div className="bg-bg-primary/50 border border-bg-border/30 rounded-[16px] p-4 flex justify-between items-center mt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-bold text-txt-heading">
                      Pipeline Candidates
                    </span>
                    <span className="text-caption text-txt-caption font-semibold">
                      Total applications for this vacancy
                    </span>
                  </div>
                  <span className="text-[22px] font-extrabold text-primary">
                    {getCandidatesCount(selectedJob.id)}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => handleManageApplications(selectedJob)}
                className="w-full justify-center gap-1.5 mt-2 font-semibold cursor-pointer"
              >
                <span>Manage Candidate Board</span>
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Card>
          ) : (
            <Card className="p-12 text-center border border-dashed border-bg-border/60 bg-bg-secondary/40 rounded-card">
              <p className="text-body text-txt-body font-medium">Select a job to view details.</p>
            </Card>
          )}
        </div>
      </div>

      <EditJobDialog job={editingJob} onOpenChange={(o) => !o && setEditingJob(null)} />
      <ConfirmDialog
        open={!!deletingJob}
        onOpenChange={(o) => !o && setDeletingJob(null)}
        title="Delete job?"
        description={`"${deletingJob?.title ?? ""}" and all of its applications will be permanently deleted.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
