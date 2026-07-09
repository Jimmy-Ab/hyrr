import * as React from "react"
import { Briefcase, MapPin, Clock, Search, ArrowUpRight, ExternalLink } from "lucide-react"
import { useJobStore, type Job } from "../store/useJobStore"
import { Card } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { useToast } from "../components/ui/toast"

export function Jobs() {
  const { jobs, candidates, selectJob, setActiveView, setAddJobOpen, searchQuery, setSearchQuery } = useJobStore()
  const { toast } = useToast()
  
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(jobs[0] || null)
  const [statusFilter, setStatusFilter] = React.useState<"All" | "Active" | "Closed">("All")

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          job.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "All" || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getCandidatesCount = (jobId: string) => {
    return candidates.filter((c) => c.jobId === jobId).length
  }

  const handleManageApplications = (job: Job) => {
    selectJob(job.id)
    setActiveView("Applications")
    toast("Pipeline Switched", `Viewing pipeline for ${job.title}`, "success")
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Open Roles</h1>
          <p className="text-body text-txt-body mt-1 font-medium">
            Manage your hiring vacancies, view pipelines, and review applications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setActiveView("Careers")}
            className="cursor-pointer font-semibold flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            Preview Job Board
          </Button>
          <Button
            onClick={() => setAddJobOpen(true)}
            className="cursor-pointer font-semibold shadow-button"
          >
            + Create Job Listing
          </Button>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <input
            type="text"
            placeholder="Search jobs by title or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-input border border-bg-border bg-bg-secondary text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          />
        </div>
        <div className="flex gap-2 bg-bg-secondary p-1 border border-bg-border rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] shrink-0">
          {(["All", "Active", "Closed"] as const).map((filter) => (
            <button
              key={filter}
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
        <div className="lg:col-span-3 flex flex-col gap-4">
          {filteredJobs.map((job) => {
            const isSelected = selectedJob?.id === job.id
            const count = getCandidatesCount(job.id)

            return (
              <Card
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`p-5 cursor-pointer transition-all border ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/10 shadow-card-hover"
                    : "border-bg-border/60 hover:border-bg-border hover:shadow-card-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-light border border-primary-border/30 flex items-center justify-center text-primary shrink-0">
                      <Briefcase className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <div>
                      <h3 className="text-card-title font-semibold text-txt-heading leading-snug">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-4 text-caption text-txt-body mt-2 font-medium">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-txt-caption" />
                          {job.location}
                        </span>
                        <span>•</span>
                        <span>{job.type}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-txt-caption" />
                          {job.posted}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant={job.status === "Active" ? "success" : "secondary"}>
                      {job.status}
                    </Badge>
                    <span className="text-[12px] text-txt-caption font-semibold">
                      {count} applicant{count !== 1 && "s"}
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}

          {filteredJobs.length === 0 && (
            <div className="p-12 text-center border border-dashed border-bg-border/60 bg-bg-secondary/40 rounded-card">
              <p className="text-body text-txt-body font-medium">No jobs match your query.</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selectedJob ? (
            <Card className="p-6 border border-bg-border/60 bg-bg-secondary shadow-card flex flex-col gap-6 sticky top-6">
              <div className="flex items-start justify-between gap-4 border-b border-bg-border/30 pb-4">
                <div>
                  <h3 className="text-[20px] font-bold text-txt-heading leading-tight">
                    {selectedJob.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-caption text-txt-body mt-1.5 font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-txt-caption" />
                    <span>{selectedJob.location}</span>
                    <span>•</span>
                    <span>{selectedJob.type}</span>
                  </div>
                </div>
                <Badge variant={selectedJob.status === "Active" ? "success" : "secondary"}>
                  {selectedJob.status}
                </Badge>
              </div>

              {/* Job Info Details */}
              <div className="flex flex-col gap-4 text-body text-txt-body leading-relaxed">
                <div>
                  <h4 className="text-[13px] font-bold text-txt-heading uppercase tracking-wider mb-1">
                    Role Summary
                  </h4>
                  <p className="font-medium text-txt-body">
                    We are looking for a dedicated {selectedJob.title} to join our engineering and product design squads. You will help build scalable features, focus on premium micro-animations, and deliver high-performance user interfaces.
                  </p>
                </div>

                <div>
                  <h4 className="text-[13px] font-bold text-txt-heading uppercase tracking-wider mb-1">
                    Requirements
                  </h4>
                  <ul className="list-disc list-inside space-y-1 font-medium text-txt-body">
                    <li>3+ years of professional engineering experience.</li>
                    <li>Strong proficiency in React, TypeScript, and modern CSS systems.</li>
                    <li>Excellent eye for detail, grid alignments, and animations.</li>
                  </ul>
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

              {/* Actions */}
              <Button
                variant="primary"
                onClick={() => handleManageApplications(selectedJob)}
                className="w-full justify-center gap-1.5 shadow-button mt-2 font-semibold cursor-pointer"
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
    </div>
  )
}
