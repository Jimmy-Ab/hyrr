import { useState, type FormEvent } from "react"
import {
  MapPin, Clock, Briefcase, Search, ChevronRight, ArrowLeft,
  Building2, Users, Globe, Star, CheckCircle2, X, Upload,
  ExternalLink, Bookmark
} from "lucide-react"
import { useJobStore, type Job, Badge, Button, Input, useToast, Card, APPLICATION_STATUS } from "hyrr.shared"

/* ─── Tiny company stat ─── */
function CompanyStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-txt-body">
      <div className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[12px] font-bold text-txt-title leading-tight">{value}</p>
        <p className="text-[10px] text-txt-caption font-semibold mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ─── Job type badge color ─── */
function typeBadge(type: string) {
  if (type === "Full Time") return "primary"
  if (type === "Part Time") return "info"
  if (type === "Contract") return "warning"
  return "secondary"
}

/* ─── Application form modal ─── */
function ApplyModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { applyToJob, setActiveView, selectJob } = useJobStore()
  const { toast } = useToast()

  const [step, setStep] = useState<"form" | "success">("form")
  const [form, setForm] = useState({
    name: "", email: "", phone: "", title: "", location: "",
    linkedin: "", coverLetter: "", resumeName: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Full name is required"
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required"
    if (!form.phone.trim()) e.phone = "Phone number is required"
    if (!form.title.trim()) e.title = "Current job title is required"
    if (!form.location.trim()) e.location = "Location is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    applyToJob(job.id, {
      name: form.name,
      email: form.email,
      phone: form.phone,
      title: form.title,
      location: form.location,
      linkedin: form.linkedin,
      coverLetter: form.coverLetter,
    })
    setStep("success")
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-bg-secondary border border-bg-border rounded-card shadow-floating overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-bg-border/40">
          <div>
            <p className="text-[11px] text-primary font-bold uppercase tracking-widest mb-1">Applying for</p>
            <h2 className="text-[20px] font-bold text-txt-title leading-tight">{job.title}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-[12px] text-txt-caption font-medium">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
              <span>·</span>
              <span>{job.type}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-bg-hover text-txt-caption hover:text-txt-heading transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "success" ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center p-12 gap-5 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--badge-success-bg)] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-sec-green" />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-txt-title">Application Submitted!</h3>
              <p className="text-txt-body mt-2 max-w-sm mx-auto leading-relaxed">
                Thank you <strong className="text-txt-heading">{form.name}</strong>! Your application for <strong className="text-txt-heading">{job.title}</strong> has been received and is now in review.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="secondary" onClick={onClose} className="cursor-pointer">
                Back to Jobs
              </Button>
              <Button
                variant="primary"
                className="cursor-pointer"
                onClick={() => {
                  selectJob(job.id)
                  setActiveView("Applications")
                  toast("Pipeline opened", `Viewing candidates for ${job.title}`, "success")
                }}
              >
                View in Pipeline →
              </Button>
            </div>
          </div>
        ) : (
          /* ── Application form ── */
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                  Full Name <span className="text-sec-red">*</span>
                </label>
                <Input placeholder="Emily Carter" {...field("name")} />
                {errors.name && <p className="text-[11px] text-sec-red mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                  Email Address <span className="text-sec-red">*</span>
                </label>
                <Input type="email" placeholder="emily@example.com" {...field("email")} />
                {errors.email && <p className="text-[11px] text-sec-red mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                  Phone <span className="text-sec-red">*</span>
                </label>
                <Input type="tel" placeholder="+1 555 000 0000" {...field("phone")} />
                {errors.phone && <p className="text-[11px] text-sec-red mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                  Current Job Title <span className="text-sec-red">*</span>
                </label>
                <Input placeholder="Senior Developer" {...field("title")} />
                {errors.title && <p className="text-[11px] text-sec-red mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                  Location <span className="text-sec-red">*</span>
                </label>
                <Input placeholder="San Francisco, CA" {...field("location")} />
                {errors.location && <p className="text-[11px] text-sec-red mt-1">{errors.location}</p>}
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                  LinkedIn Profile <span className="text-[11px] text-txt-caption font-normal">(optional)</span>
                </label>
                <Input placeholder="linkedin.com/in/yourname" {...field("linkedin")} />
              </div>
            </div>

            {/* Resume upload (simulated) */}
            <div>
              <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                Resume / CV <span className="text-[11px] text-txt-caption font-normal">(PDF, DOCX)</span>
              </label>
              <label className="flex items-center justify-center gap-3 w-full h-24 border-2 border-dashed border-bg-border rounded-[16px] cursor-pointer hover:border-primary/40 hover:bg-primary-light/10 transition-all group">
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setForm((f) => ({ ...f, resumeName: file.name }))
                }} />
                <Upload className="w-5 h-5 text-txt-caption group-hover:text-primary transition-colors" />
                <span className="text-[13px] text-txt-caption group-hover:text-txt-heading transition-colors font-medium">
                  {form.resumeName ? form.resumeName : "Click to upload or drag & drop"}
                </span>
              </label>
            </div>

            {/* Cover letter */}
            <div>
              <label className="text-[12.5px] font-semibold text-txt-heading block mb-1.5">
                Cover Letter <span className="text-[11px] text-txt-caption font-normal">(optional)</span>
              </label>
              <textarea
                rows={4}
                placeholder="Tell us why you're a great fit for this role..."
                value={form.coverLetter}
                onChange={(e) => setForm((f) => ({ ...f, coverLetter: e.target.value }))}
                className="w-full px-3.5 py-3 rounded-[16px] border border-bg-border bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-bg-border/40">
              <p className="text-[11px] text-txt-caption">
                By applying you agree to our <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>
              </p>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">Cancel</Button>
                <Button type="submit" variant="primary" className="cursor-pointer px-6">
                  Submit Application
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─── Job Detail Panel ─── */
function JobDetail({ job, onApply }: { job: Job; onApply: () => void }) {
  const { candidates, jobApplications, saveJobFromDiscover } = useJobStore()
  const applicantCount = candidates.filter((c) => c.jobId === job.id).length
  const isApplied = jobApplications.some((a) => a.publicJobId === job.id && a.status !== APPLICATION_STATUS.SAVED)
  const isSaved = jobApplications.some((a) => a.publicJobId === job.id && a.status === APPLICATION_STATUS.SAVED)

  const requirements: Record<string, string[]> = {
    "senior-frontend-developer": [
      "5+ years of professional frontend experience",
      "Expert-level React, TypeScript, and modern CSS",
      "Strong eye for pixel-perfect UI and micro-animations",
      "Experience with state management (Zustand, Redux, Jotai)",
      "Familiarity with accessibility standards (WCAG 2.1)",
    ],
    "product-designer": [
      "4+ years in product / UX design",
      "Mastery of Figma and design system tooling",
      "Portfolio showing end-to-end product thinking",
      "Experience running user research sessions",
    ],
    "backend-engineer": [
      "4+ years of backend engineering experience",
      "Strong in Node.js, Go, or Python",
      "Database design — PostgreSQL, Redis",
      "REST & GraphQL API design patterns",
      "Cloud infrastructure: AWS or GCP",
    ],
    "marketing-manager": [
      "3+ years of B2B marketing experience",
      "Proven track record in demand generation",
      "Data-driven with experience in HubSpot / Marketo",
      "Excellent written and verbal communication",
    ],
    "customer-support": [
      "2+ years in a technical support or CSM role",
      "Empathetic communication style",
      "Familiarity with support tooling (Intercom, Zendesk)",
      "Ability to troubleshoot software issues",
    ],
  }

  const perks = [
    "Competitive salary + equity package",
    "Flexible remote-first culture",
    "Health, dental & vision insurance",
    "$2,000 annual learning budget",
    "Home office setup allowance",
    "Unlimited PTO policy",
  ]

  const reqs = requirements[job.id] ?? [
    "Relevant experience in the field",
    "Strong communication skills",
    "Ability to work in a fast-paced environment",
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Job header */}
      <div className="p-7 border-b border-bg-border/40">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-[22px] font-bold text-txt-title leading-tight">{job.title}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[12.5px] text-txt-body font-medium">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-txt-caption" />{job.location}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-txt-caption" />{job.posted}</span>
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-txt-caption" />{applicantCount} applicant{applicantCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <Badge variant={typeBadge(job.type) as "primary" | "info" | "warning" | "secondary"}>{job.type}</Badge>
        </div>
        <div className="flex gap-3">
          <Button
            variant={isApplied ? "secondary" : "primary"}
            onClick={onApply}
            disabled={isApplied}
            className={`flex-1 font-bold text-[14px] h-11 ${isApplied ? "" : "shadow-button cursor-pointer"}`}
          >
            {isApplied ? "✓ Applied" : "Apply Now →"}
          </Button>
          {!isApplied && (
            <Button
              variant="secondary"
              onClick={() => saveJobFromDiscover(job.id)}
              disabled={isSaved}
              className="h-11 px-4 cursor-pointer"
              title={isSaved ? "Saved in Applications" : "Save Job"}
            >
              <Bookmark className={`w-4.5 h-4.5 ${isSaved ? "fill-current text-primary" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-7 space-y-7 flex-1">
        {/* About */}
        <div>
          <h3 className="text-[13px] font-bold text-txt-heading uppercase tracking-widest mb-3">About the Role</h3>
          <p className="text-[13.5px] text-txt-body leading-relaxed font-medium">
            We're looking for a talented <strong className="text-txt-heading">{job.title}</strong> to join our growing team.
            You'll work closely with cross-functional teams to ship premium, high-quality features that delight our users.
            This is a high-impact role with a direct line to product leadership.
          </p>
        </div>

        {/* Requirements */}
        <div>
          <h3 className="text-[13px] font-bold text-txt-heading uppercase tracking-widest mb-3">Requirements</h3>
          <ul className="space-y-2">
            {reqs.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-txt-body font-medium">
                <CheckCircle2 className="w-4 h-4 text-sec-green shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Perks */}
        <div>
          <h3 className="text-[13px] font-bold text-txt-heading uppercase tracking-widest mb-3">Perks & Benefits</h3>
          <div className="grid grid-cols-2 gap-2">
            {perks.map((p, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-[12px] bg-bg-primary border border-bg-border/40 text-[12.5px] text-txt-body font-medium">
                <Star className="w-3.5 h-3.5 text-sec-orange shrink-0" />
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Careers Page ─── */
export function CareersPage() {
  const { jobs, careerSelectedJobId, setCareerSelectedJobId, setActiveView, workspaceName } = useJobStore()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("All")
  const [applyJob, setApplyJob] = useState<Job | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)

  const activeJobs = jobs.filter((j) => j.status === "Active")

  const filtered = activeJobs.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.location.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === "All" || j.type === typeFilter
    return matchSearch && matchType
  })

  const selectedJob = jobs.find((j) => j.id === careerSelectedJobId) ?? filtered[0]

  const types = ["All", "Full Time", "Part Time", "Contract", "Remote"]

  const dotColors: Record<string, string> = {
    purple: "bg-primary",
    blue: "bg-sec-blue",
    green: "bg-sec-green",
    orange: "bg-sec-orange",
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div>
        <h1 className="text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">Explore Roles</span>
          </h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Find your next challenge. Search open roles, filter by work types, and apply directly.
        </p>
      </div>

      {/* ── Dashboard Hero Card ── */}
      <Card className="p-8 bg-bg-secondary border border-bg-border/60 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-light border border-primary-border/40 text-primary text-[11px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              We're hiring · {activeJobs.length} open role{activeJobs.length !== 1 ? "s" : ""}
            </div>
            <h2 className="text-[28px] font-extrabold text-txt-title leading-tight tracking-tight">
              Build the future of <span className="text-primary">talent, together.</span>
            </h2>
            <p className="text-txt-body mt-2.5 max-w-lg leading-relaxed text-[13px] font-medium">
              Join our world-class team and help shape how companies discover extraordinary people. Remote-first, mission-driven, and growing fast.
            </p>
          </div>

          {/* Company stats */}
          <div className="grid grid-cols-2 gap-4 shrink-0">
            <CompanyStat icon={Users} label="Team Size" value="120+" />
            <CompanyStat icon={Globe} label="Countries" value="18" />
            <CompanyStat icon={Star} label="Glassdoor" value="4.8 ★" />
            <CompanyStat icon={Building2} label="Founded" value="2019" />
          </div>
        </div>
      </Card>

      {/* ── Search + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
          <input
            type="text"
            placeholder="Search roles, skills, or locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-bg-secondary p-1 border border-bg-border rounded-[14px] shrink-0">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-[10px] text-[12px] font-semibold cursor-pointer transition-all ${
                typeFilter === t ? "bg-primary text-white" : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Split layout: list + detail ── */}
      <div className="flex gap-6 flex-1 items-start">
        {/* Job list */}
        <div className={`flex flex-col gap-3 w-full md:w-[380px] shrink-0 ${mobileDetail ? "hidden md:flex" : "flex"}`}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-bg-border rounded-card bg-bg-secondary/50">
              <Briefcase className="w-10 h-10 text-txt-disabled mb-3" />
              <p className="text-txt-heading font-semibold">No roles found</p>
              <p className="text-txt-caption text-[12.5px] mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            filtered.map((job) => {
              const isSelected = job.id === selectedJob?.id
              const dot = dotColors[job.color] ?? "bg-primary"
              return (
                <button
                  key={job.id}
                  onClick={() => {
                    setCareerSelectedJobId(job.id)
                    setMobileDetail(true)
                  }}
                  className={`w-full text-left p-5 rounded-card border transition-all cursor-pointer group ${isSelected
                    ? "border-primary bg-bg-secondary shadow-card ring-2 ring-primary/10"
                    : "border-bg-border/60 bg-bg-secondary hover:border-primary/30 hover:shadow-card"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
                      <div>
                        <h3 className="text-[14.5px] font-bold text-txt-heading leading-snug group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-txt-caption font-medium">
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.posted}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={typeBadge(job.type) as "primary" | "info" | "warning" | "secondary"}>
                        {job.type}
                      </Badge>
                      <ChevronRight className={`w-4 h-4 transition-colors ${isSelected ? "text-primary" : "text-txt-disabled group-hover:text-txt-caption"}`} />
                    </div>
                  </div>
                </button>
              )
            })
          )}

          {/* Recruiter CTA */}
          <div className="mt-4 p-4 rounded-[18px] bg-bg-secondary border border-bg-border/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center shrink-0">
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-[12px] text-txt-body font-medium flex-1">
              Are you a recruiter? <button onClick={() => setActiveView("Dashboard")} className="text-primary font-bold cursor-pointer hover:underline">Go to Dashboard →</button>
            </p>
          </div>
        </div>

        {/* Job detail panel */}
        {selectedJob && (
          <div className={`flex-1 bg-bg-secondary border border-bg-border/60 rounded-card shadow-card overflow-hidden ${!mobileDetail ? "hidden md:flex flex-col" : "flex flex-col"}`}>
            {/* Mobile back */}
            <div className="md:hidden flex items-center px-5 pt-4">
              <button onClick={() => setMobileDetail(false)} className="flex items-center gap-1.5 text-[12.5px] text-primary font-semibold cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> All Jobs
              </button>
            </div>
            <JobDetail job={selectedJob} onApply={() => setApplyJob(selectedJob)} />
          </div>
        )}
      </div>

      {/* Application modal */}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
    </div>
  )
}
