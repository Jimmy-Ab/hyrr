import { useState, useEffect } from "react"
import { useJobStore, type Candidate } from "../../store/useJobStore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { Button } from "../ui/button"
import { useToast } from "../ui/toast"
import { MapPin, Mail, Phone, Calendar, X, Bookmark, Sparkles, FileText, Loader2 } from "lucide-react"
import { Card } from "../ui/card"

export function CandidateDetailDialog() {
  const {
    selectedCandidateId,
    setSelectedCandidateId,
    candidates,
    moveCandidate,
    toggleBookmark,
    createEvent,
  } = useJobStore()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<"details" | "ai" | "schedule">("details")

  // Schedule state
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingDate, setMeetingDate] = useState("")
  const [meetingTime, setMeetingTime] = useState("10:00")
  const [scheduling, setScheduling] = useState(false)

  // Find candidate details
  const candidate = candidates.find((c) => c.id === selectedCandidateId) || null

  // Reset tab when modal changes/opens
  useEffect(() => {
    if (selectedCandidateId) {
      setActiveTab("details")
      setMeetingTitle("")
      setMeetingDate("")
      setMeetingTime("10:00")
    }
  }, [selectedCandidateId])

  if (!candidate) return null

  const handleStatusChange = async (newStatus: Candidate["status"]) => {
    await moveCandidate(candidate.id, newStatus)
    toast("Pipeline Updated", `${candidate.name} moved to ${newStatus}.`, "success")
  }

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meetingTitle || !meetingDate) {
      toast("Error", "Please fill in all meeting fields.", "error")
      return
    }
    setScheduling(true)
    try {
      await createEvent({
        title: `${meetingTitle} - ${candidate.name}`,
        startTime: `${meetingDate}T${meetingTime}:00`,
        type: "interview",
        applicationId: candidate.id,
        notes: `Interview scheduled by recruiter.`,
      })
      toast("Interview Scheduled", `Meeting successfully created for ${candidate.name}.`, "success")
      setMeetingTitle("")
      setMeetingDate("")
      setActiveTab("details")
    } catch {
      toast("Error", "Could not schedule interview. Please try again.", "error")
    } finally {
      setScheduling(false)
    }
  }

  // Determine colors based on AI Score
  const getAiScoreColor = (score: number) => {
    if (score >= 85) return "bg-[#34C759] text-white shadow-[0_0_12px_rgba(52,199,89,0.3)]"
    if (score >= 60) return "bg-[#FFB547] text-white shadow-[0_0_12px_rgba(255,181,71,0.3)]"
    return "bg-[#6C63FF] text-white"
  }

  return (
    <Dialog open={!!selectedCandidateId} onOpenChange={(open) => !open && setSelectedCandidateId(null)}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 rounded-[20px] bg-bg-secondary border border-bg-border/60 shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[90vh]">
        {/* Banner with profile summary */}
        <div className="relative p-6 bg-gradient-to-r from-primary-light/50 via-primary-light/20 to-transparent flex gap-5 border-b border-bg-border/40 shrink-0">
          <img
            src={candidate.avatar}
            alt={candidate.name}
            className="w-16 h-16 rounded-[18px] object-cover border border-bg-border/60 shadow-button transition-transform duration-250 hover:scale-105"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-extrabold text-txt-heading truncate">{candidate.name}</h2>
              <button
                onClick={() => toggleBookmark(candidate.id)}
                className={`p-1 rounded-full hover:bg-bg-hover transition-colors cursor-pointer outline-none ${
                  candidate.bookmarked ? "text-primary" : "text-txt-caption"
                }`}
              >
                <Bookmark className="w-4.5 h-4.5" fill={candidate.bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
            <p className="text-[13.5px] font-semibold text-txt-body mt-0.5">{candidate.title}</p>
            <div className="flex items-center gap-1 text-[11.5px] text-txt-caption mt-2 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>{candidate.location}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end justify-between">
            <button
              onClick={() => setSelectedCandidateId(null)}
              className="p-1.5 rounded-full hover:bg-bg-hover text-txt-caption hover:text-txt-heading transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
              <select
                value={candidate.status}
                onChange={(e) => handleStatusChange(e.target.value as Candidate["status"])}
                className="h-9 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-[12.5px] font-bold text-txt-heading focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer shadow-button"
              >
                <option value="Saved">Saved</option>
                <option value="Applied">Applied</option>
                <option value="In Process">In Process</option>
                <option value="Offer">Offer</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab triggers */}
        <div className="flex border-b border-bg-border/30 px-6 bg-bg-primary/20 shrink-0">
          {[
            { id: "details", label: "Profile Details" },
            { id: "ai", label: "AI Screening Match" },
            { id: "schedule", label: "Interview Scheduler" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 px-4 text-[12.5px] font-bold transition-all relative border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-txt-caption hover:text-txt-heading"
              }`}
            >
              {tab.id === "ai" && candidate.aiScore != null && (
                <span className="absolute top-2 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-bg-primary/10">
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 flex items-center gap-3">
                  <Mail className="w-4.5 h-4.5 text-txt-caption" />
                  <div>
                    <p className="text-[11px] text-txt-caption font-bold uppercase tracking-wider">Email Address</p>
                    <p className="text-[13px] text-txt-heading font-semibold mt-0.5">{candidate.email || "Not provided"}</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                  <Phone className="w-4.5 h-4.5 text-txt-caption" />
                  <div>
                    <p className="text-[11px] text-txt-caption font-bold uppercase tracking-wider">Phone Number</p>
                    <p className="text-[13px] text-txt-heading font-semibold mt-0.5">{candidate.phone || "Not provided"}</p>
                  </div>
                </Card>
              </div>

              {/* Cover Letter */}
              {candidate.coverLetter && (
                <div>
                  <h4 className="text-[12.5px] font-bold text-txt-heading uppercase tracking-wider mb-2.5">Cover Letter</h4>
                  <div className="p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary text-[13px] text-txt-body leading-relaxed max-h-[160px] overflow-y-auto font-medium">
                    {candidate.coverLetter}
                  </div>
                </div>
              )}

              {/* Resume download section */}
              <div>
                <h4 className="text-[12.5px] font-bold text-txt-heading uppercase tracking-wider mb-2.5">Candidate Documents</h4>
                <Card className="p-4 flex items-center justify-between border border-bg-border bg-bg-secondary hover:border-primary/20 transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[12px] bg-primary-light border border-primary-border/20 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-txt-heading truncate">
                        {candidate.name.replace(/\s+/g, "_")}_Resume.pdf
                      </p>
                      <p className="text-[11px] text-txt-caption mt-0.5 font-medium">Primary Resume Document</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="font-semibold text-[12px] cursor-pointer"
                    onClick={() => {
                      if (candidate.resumeUrl) {
                        window.open(candidate.resumeUrl, "_blank")
                      } else {
                        toast("Preview", "Opening candidate resume PDF...", "success")
                      }
                    }}
                  >
                    View File
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-6">
              {candidate.aiScore != null ? (
                <div className="space-y-6">
                  {/* Score circle */}
                  <div className="flex items-center gap-5 p-5 bg-gradient-to-r from-bg-secondary to-bg-primary/30 border border-bg-border/60 rounded-[18px]">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-extrabold select-none shrink-0 ${getAiScoreColor(candidate.aiScore)}`}>
                      {candidate.aiScore}%
                    </div>
                    <div>
                      <h4 className="text-[14.5px] font-bold text-txt-heading">Gemini Smart Match Fit</h4>
                      <p className="text-[12.5px] text-txt-caption mt-1 font-medium">
                        {candidate.aiScore >= 80
                          ? "Exceptional match! Candidate has matching experience and skills."
                          : candidate.aiScore >= 60
                          ? "Good match potential. Some minor gaps identified in requirements."
                          : "Lower match alignment. Skill sets might not be an exact fit."}
                      </p>
                    </div>
                  </div>

                  {/* Summary analysis */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Sparkles className="w-4 h-4" />
                      <h4 className="text-[12.5px] font-bold uppercase tracking-wider">AI Evaluation Analysis</h4>
                    </div>
                    <div className="p-5 rounded-[18px] border border-bg-border/60 bg-bg-secondary text-[13px] text-txt-body leading-relaxed font-medium">
                      {candidate.aiSummary || "AI assessment summary data is being populated. Please re-open the window in a few moments."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-primary animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-txt-heading">Run AI Fit Analysis</h4>
                    <p className="text-[12.5px] text-txt-caption mt-1 max-w-sm leading-relaxed">
                      Evaluate this candidate's resume and details against the job requirements using Gemini AI.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      toast("Triggered AI", "Starting evaluation in backend...", "info")
                      await moveCandidate(candidate.id, candidate.status) // updates pipeline status to trigger scoring
                    }}
                    className="font-bold shadow-button flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" /> Evaluate Profile
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "schedule" && (
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1.5">
                  Interview Stage / Meeting Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Technical Round 1"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  required
                  className="w-full h-10 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-[13px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1.5">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    required
                    className="w-full h-10 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-[13px] focus:outline-none focus:border-primary/30 transition-all cursor-pointer font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1.5">
                    Meeting Time
                  </label>
                  <input
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-[13px] focus:outline-none focus:border-primary/30 transition-all cursor-pointer font-medium"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={scheduling} className="w-full h-10 font-bold shadow-button cursor-pointer">
                  {scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Schedule and Send Invite <Calendar className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </form>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-bg-border/40 shrink-0 bg-bg-primary/20">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSelectedCandidateId(null)}
            className="cursor-pointer font-semibold"
          >
            Close Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
