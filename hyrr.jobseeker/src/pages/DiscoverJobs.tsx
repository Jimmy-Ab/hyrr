import { useState, useEffect } from "react"
import { Search, Bookmark, CheckCircle2, MapPin, DollarSign, Clock, Star, Briefcase, Globe, Loader2 } from "lucide-react"
import { useJobStore, type PublicJob } from "hyrr.shared"
import { Card, Badge, Button, useToast, RichTextRenderer } from "hyrr.shared"

const colorBg: Record<string, string> = {
  purple: "bg-primary text-white",
  blue: "bg-sec-blue text-white",
  green: "bg-sec-green text-white",
  orange: "bg-sec-orange text-white",
}

const types = ["All", "Full Time", "Part Time", "Contract", "Remote"]

function JobSkeleton() {
  return (
    <div className="p-4 rounded-card border border-bg-border/40 bg-bg-secondary/60 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-bg-border/60 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-bg-border/60 rounded w-3/4" />
          <div className="h-3 bg-bg-border/40 rounded w-1/2" />
          <div className="flex gap-2 mt-2">
            <div className="h-3 bg-bg-border/40 rounded w-16" />
            <div className="h-3 bg-bg-border/40 rounded w-12" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function DiscoverJobs() {
  const {
    publicJobs, publicJobsLoading, jobApplications,
    discoverSearch, discoverTypeFilter,
    setDiscoverSearch, setDiscoverTypeFilter,
    applyFromDiscover, saveJobFromDiscover,
    setCandidateActiveView, fetchInitialData,
  } = useJobStore()
  const { toast } = useToast()

  const [selectedJob, setSelectedJob] = useState<PublicJob | null>(null)

  useEffect(() => {
    fetchInitialData()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (publicJobs.length > 0 && !selectedJob) {
      setSelectedJob(publicJobs[0])
    }
  }, [publicJobs, selectedJob])

  const filtered = publicJobs.filter((j) => {
    const matchType = discoverTypeFilter === "All" || j.type === discoverTypeFilter
    const q = discoverSearch.toLowerCase()
    const matchSearch = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.skills.some((s) => s.toLowerCase().includes(q))
    return matchType && matchSearch
  })

  const isApplied = (id: string) => jobApplications.some((a) => a.publicJobId === id && a.status !== "Saved")
  const isSaved = (id: string) => jobApplications.some((a) => a.publicJobId === id)

  const handleApply = (job: PublicJob) => {
    if (isApplied(job.id)) return
    applyFromDiscover(job.id)
    toast("Applied!", `Your application to ${job.company} has been submitted.`, "success")
    setCandidateActiveView("Applications")
  }

  const handleSave = (job: PublicJob) => {
    saveJobFromDiscover(job.id)
    toast("Saved", `${job.title} at ${job.company} added to your Saved list.`, "success")
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      <div className="relative z-10">
        <h1 className="text-[36px] font-extrabold tracking-tight">
          <span className="premium-gradient-text text-glow">Discover Jobs</span>
        </h1>
        <p className="text-body text-txt-body mt-1 font-semibold opacity-90">
          Find your next opportunity from {publicJobs.length} open roles across top companies.
        </p>
      </div>

      {/* Search + Filter Bar */}
      <Card className="p-4 glass-panel border-bg-border/60 relative z-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
            <input
              type="text"
              placeholder="Search roles, companies, skills…"
              value={discoverSearch}
              onChange={(e) => setDiscoverSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-input border border-bg-border bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>
          <div className="flex gap-1 bg-bg-primary p-1 border border-bg-border rounded-[13px] shrink-0">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setDiscoverTypeFilter(t)}
                className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold cursor-pointer transition-all ${discoverTypeFilter === t
                    ? "bg-primary text-white shadow-[0_2px_8px_rgba(108,99,255,0.35)]"
                    : "text-txt-body hover:bg-bg-hover hover:text-txt-heading font-semibold"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Split Pane */}
      <div className="flex gap-5 flex-1">
        {/* Job List */}
        <div className="w-[360px] shrink-0 flex flex-col gap-3">
          {publicJobsLoading ? (
            Array.from({ length: 5 }).map((_, i) => <JobSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <Card className="p-10 flex flex-col items-center gap-3 text-center">
              <Briefcase className="w-10 h-10 text-txt-disabled" />
              <p className="text-[14px] font-semibold text-txt-heading">No roles found</p>
              <p className="text-caption text-txt-caption">Try adjusting your search or filters.</p>
            </Card>
          ) : filtered.map((job) => {

            const active = selectedJob?.id === job.id
            const applied = isApplied(job.id)
            const saved = isSaved(job.id)
            return (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`w-full text-left p-4 rounded-card border transition-all cursor-pointer block ${active
                    ? "border-primary bg-bg-secondary ring-2 ring-primary/10 shadow-card"
                    : "border-bg-border/60 bg-bg-secondary/60 hover:bg-bg-secondary hover:border-primary/20"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center text-white font-bold text-[14px] shrink-0 ${colorBg[job.companyColor] ?? "bg-primary"}`}>
                    {job.company[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-[13.5px] font-bold text-txt-heading truncate">{job.title}</h4>
                      {job.featured && <Star className="w-3.5 h-3.5 text-sec-orange shrink-0 fill-current" />}
                    </div>
                    <p className="text-[12px] text-txt-body mt-0.5">{job.company}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] text-txt-caption flex items-center gap-0.5"><MapPin className="w-3 h-3" />{job.location}</span>
                      <span className="text-[11px] font-semibold text-primary">{job.salary}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={applied ? "success" : saved ? "primary" : "secondary"}>
                        {applied ? "Applied" : saved ? "Saved" : job.type}
                      </Badge>
                      <span className="text-[10.5px] text-txt-caption">{job.posted}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Job Detail */}
        {selectedJob && (
          <div className="flex-1 min-w-0">
            <Card className="p-8 sticky top-0">
              {/* Header */}
              <div className="flex items-start gap-5 pb-6 border-b border-bg-border/40">
                <div className={`w-16 h-16 rounded-[18px] flex items-center justify-center text-white font-black text-[24px] shrink-0 ${colorBg[selectedJob.companyColor] ?? "bg-primary"}`}>
                  {selectedJob.company[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[22px] font-extrabold text-txt-title">{selectedJob.title}</h2>
                      <p className="text-[14px] text-txt-body font-medium mt-0.5">{selectedJob.company}</p>
                    </div>
                    {selectedJob.featured && <Badge variant="warning"><Star className="w-3 h-3 mr-1 fill-current" />Featured</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[12.5px] text-txt-caption font-medium">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedJob.location}</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{selectedJob.type}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{selectedJob.salary}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Posted {selectedJob.posted}</span>
                    {selectedJob.remote && <span className="flex items-center gap-1 text-sec-green font-semibold"><Globe className="w-3.5 h-3.5" />Remote OK</span>}
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="py-5 border-b border-bg-border/40 flex flex-wrap gap-2">
                {selectedJob.skills.map((s) => (
                  <span key={s} className="text-[11.5px] font-bold text-primary bg-primary-light border border-primary-border/30 px-2.5 py-0.5 rounded-full">{s}</span>
                ))}
              </div>

              {/* Description */}
              <div className="py-5 border-b border-bg-border/40">
                <h3 className="text-[14px] font-bold text-txt-heading mb-2">About the Role</h3>
                <RichTextRenderer content={selectedJob.description} />
              </div>

              {/* Requirements */}
              <div className="py-5 border-b border-bg-border/40">
                <h3 className="text-[14px] font-bold text-txt-heading mb-3">Requirements</h3>
                <ul className="space-y-2">
                  {selectedJob.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-[13px] text-txt-body">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Benefits */}
              <div className="py-5">
                <h3 className="text-[14px] font-bold text-txt-heading mb-3">Benefits & Perks</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.benefits.map((b) => (
                    <span key={b} className="text-[12px] font-semibold text-sec-green bg-sec-green/10 border border-sec-green/20 px-2.5 py-1 rounded-full">{b}</span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex gap-3 mt-2">
                <Button
                  variant={isApplied(selectedJob.id) ? "secondary" : "primary"}
                  onClick={() => handleApply(selectedJob)}
                  disabled={isApplied(selectedJob.id)}
                  className={`flex-1 h-11 text-[14px] font-bold cursor-pointer ${isApplied(selectedJob.id) ? "" : "shadow-button"}`}
                >
                  {isApplied(selectedJob.id) ? "✓ Applied" : "Apply Now"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSave(selectedJob)}
                  disabled={isSaved(selectedJob.id) && !isApplied(selectedJob.id)}
                  className="h-11 px-4 cursor-pointer"
                >
                  <Bookmark className={`w-4.5 h-4.5 ${isSaved(selectedJob.id) ? "fill-current text-primary" : ""}`} />
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
