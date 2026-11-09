import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FieldError,
  toIsoFromLocal,
  useToast,
} from "hyrr.shared"
import {
  Bookmark,
  Calendar,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
} from "lucide-react"
import { useEffect, useState } from "react"
import {
  avatarFallback,
  errorMessage,
  isWithdrawn,
  PIPELINE_STATUSES,
  sourceLabel,
  statusBadgeVariant,
} from "../../lib/recruiter"
import { useJobStore, type Candidate } from "../../store/useJobStore"
import { AiAnalysisPanel } from "../ai/ai-analysis-panel"
import { CandidateLabelsEditor } from "../candidate/candidate-labels-editor"
import { CandidateNotes } from "../candidate/candidate-notes"
import { CandidateTimeline } from "../candidate/candidate-timeline"
import { InterviewSlotsOffer } from "./interview-slots-offer"

type CandidateTab = "details" | "notes" | "timeline" | "ai" | "schedule"

export function CandidateDetailDialog() {
  const {
    selectedCandidateId,
    setSelectedCandidateId,
    candidates,
    moveCandidate,
    toggleBookmark,
    createEvent,
    openConversation,
    setActiveView,
  } = useJobStore()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<CandidateTab>("details")

  // Schedule state
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingDate, setMeetingDate] = useState("")
  const [meetingTime, setMeetingTime] = useState("10:00")
  const [scheduling, setScheduling] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [meetingErrors, setMeetingErrors] = useState<{ title?: string; date?: string }>({})

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

  const withdrawn = isWithdrawn(candidate)

  const handleStatusChange = async (newStatus: Candidate["status"]) => {
    if (newStatus === candidate.status) return
    setStatusUpdating(true)
    try {
      await moveCandidate(candidate.id, newStatus)
      toast("Pipeline Updated", `${candidate.name} moved to ${newStatus}.`, "success")
    } catch (err) {
      toast("Could not update status", errorMessage(err), "error")
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleToggleBookmark = async () => {
    try {
      await toggleBookmark(candidate.id)
    } catch (err) {
      toast("Could not update bookmark", errorMessage(err), "error")
    }
  }

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found: { title?: string; date?: string } = {}
    if (!meetingTitle.trim()) found.title = "Add a meeting title"
    if (!meetingDate) found.date = "Choose a date"
    else if (meetingDate < new Date().toISOString().slice(0, 10))
      found.date = "Choose today or a future date"
    setMeetingErrors(found)
    if (found.title || found.date) return
    setScheduling(true)
    try {
      await createEvent({
        title: `${meetingTitle} - ${candidate.name}`,
        startTime: toIsoFromLocal(meetingDate, meetingTime),
        type: "interview",
        applicationId: candidate.id,
        notes: `Interview scheduled by recruiter.`,
      })
      toast("Interview Scheduled", `Meeting successfully created for ${candidate.name}.`, "success")
      setMeetingTitle("")
      setMeetingDate("")
      setActiveTab("details")
    } catch (err) {
      toast("Could not schedule interview", errorMessage(err), "error")
    } finally {
      setScheduling(false)
    }
  }

  return (
    <Dialog
      open={!!selectedCandidateId}
      onOpenChange={(open) => !open && setSelectedCandidateId(null)}
    >
      <DialogContent variant="sheet" className="flex flex-col p-0">
        {/* Banner with profile summary */}
        <div className="relative p-4 sm:p-6 pr-12 bg-gradient-to-r from-primary-light/50 via-primary-light/20 to-transparent flex flex-col sm:flex-row gap-4 sm:gap-5 border-b border-bg-border/40 shrink-0">
          <img
            src={candidate.avatar || avatarFallback(candidate.name)}
            alt=""
            className="w-16 h-16 rounded-[18px] object-cover border border-bg-border/60 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-[20px] font-extrabold text-txt-heading truncate">
                {candidate.name}
              </DialogTitle>
              <button
                type="button"
                onClick={handleToggleBookmark}
                aria-label={candidate.bookmarked ? "Remove bookmark" : "Bookmark candidate"}
                aria-pressed={candidate.bookmarked}
                className={`p-1 rounded-full hover:bg-bg-hover transition-colors cursor-pointer outline-none ${
                  candidate.bookmarked ? "text-primary" : "text-txt-caption"
                }`}
              >
                <Bookmark
                  className="w-4.5 h-4.5"
                  fill={candidate.bookmarked ? "currentColor" : "none"}
                />
              </button>
            </div>
            <DialogDescription className="text-[13.5px] font-semibold text-txt-body mt-0.5">
              {candidate.title || "No title provided"}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {candidate.location && (
                <span className="flex items-center gap-1 text-[11.5px] text-txt-caption font-medium">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{candidate.location}</span>
                </span>
              )}
              {sourceLabel(candidate.source) && (
                <Badge variant="secondary" className="text-[11px] px-2 py-0.5 rounded-md">
                  {sourceLabel(candidate.source)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end justify-end">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                size="sm"
                onClick={() => {
                  if (!candidate) return
                  const id = candidate.id
                  setSelectedCandidateId(null)
                  setActiveView("Messages")
                  openConversation(id).catch((err: unknown) =>
                    toast("Could not open conversation", errorMessage(err), "error")
                  )
                }}
                className="gap-1.5 text-[12.5px] cursor-pointer shadow-button"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send Message
              </Button>
              {withdrawn ? (
                <Badge
                  variant={statusBadgeVariant(candidate.status)}
                  title="The candidate withdrew this application"
                >
                  Withdrawn
                </Badge>
              ) : (
                <>
                  <label htmlFor="candidate-status" className="sr-only">
                    Pipeline status
                  </label>
                  <select
                    id="candidate-status"
                    value={candidate.status}
                    disabled={statusUpdating}
                    onChange={(e) => handleStatusChange(e.target.value as Candidate["status"])}
                    className="h-9 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-[12.5px] font-bold text-txt-heading focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {PIPELINE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab triggers */}
        <div
          role="tablist"
          aria-label="Candidate sections"
          className="flex border-b border-bg-border/30 px-2 sm:px-6 bg-bg-primary/20 shrink-0 overflow-x-auto custom-scrollbar-none"
        >
          {[
            { id: "details", label: "Profile Details" },
            {
              id: "notes",
              label: candidate.notesCount ? `Notes (${candidate.notesCount})` : "Notes",
            },
            { id: "timeline", label: "Timeline" },
            { id: "ai", label: "AI Screening Match" },
            { id: "schedule", label: "Interview Scheduler" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as CandidateTab)}
              className={`py-3.5 px-3 sm:px-4 whitespace-nowrap text-[12.5px] font-bold transition-all relative border-b-2 cursor-pointer ${
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
              {/* Labels */}
              <div>
                <h4 className="text-[12.5px] font-bold text-txt-heading uppercase tracking-wider mb-2.5">
                  Labels
                </h4>
                <CandidateLabelsEditor candidate={candidate} />
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4 flex items-center gap-3 min-w-0">
                  <Mail className="w-4.5 h-4.5 text-txt-caption" />
                  <div>
                    <p className="text-[11px] text-txt-caption font-bold uppercase tracking-wider">
                      Email Address
                    </p>
                    <p className="text-[13px] text-txt-heading font-semibold mt-0.5 break-all">
                      {candidate.email || "Not provided"}
                    </p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                  <Phone className="w-4.5 h-4.5 text-txt-caption" />
                  <div>
                    <p className="text-[11px] text-txt-caption font-bold uppercase tracking-wider">
                      Phone Number
                    </p>
                    <p className="text-[13px] text-txt-heading font-semibold mt-0.5">
                      {candidate.phone || "Not provided"}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Cover Letter */}
              {candidate.coverLetter && (
                <div>
                  <h4 className="text-[12.5px] font-bold text-txt-heading uppercase tracking-wider mb-2.5">
                    Cover Letter
                  </h4>
                  <div className="p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary text-[13px] text-txt-body leading-relaxed max-h-[160px] overflow-y-auto font-medium">
                    {candidate.coverLetter}
                  </div>
                </div>
              )}

              {/* Screening answers */}
              {(candidate.screeningAnswers?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-[12.5px] font-bold text-txt-heading uppercase tracking-wider mb-2.5">
                    Screening Answers
                  </h4>
                  <dl className="space-y-3">
                    {candidate.screeningAnswers.map((qa) => (
                      <div
                        key={qa.questionId}
                        className="p-3.5 rounded-[14px] border border-bg-border/60 bg-bg-secondary"
                      >
                        <dt className="text-[12.5px] font-semibold text-txt-heading">
                          {qa.question}
                        </dt>
                        <dd className="text-[13px] text-txt-body mt-1 whitespace-pre-wrap break-words">
                          {qa.answer || <span className="text-txt-caption">No answer</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Resume download section */}
              <div>
                <h4 className="text-[12.5px] font-bold text-txt-heading uppercase tracking-wider mb-2.5">
                  Candidate Documents
                </h4>
                <Card className="p-4 flex items-center justify-between gap-3 border border-bg-border bg-bg-secondary">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[12px] bg-primary-light border border-primary-border/20 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-txt-heading truncate">
                        {candidate.resumeUrl ? "Resume" : "No resume"}
                      </p>
                      <p className="text-[11px] text-txt-caption mt-0.5 font-medium">
                        {candidate.resumeUrl
                          ? "Uploaded with the application"
                          : "This candidate hasn't attached a resume."}
                      </p>
                    </div>
                  </div>
                  {candidate.resumeUrl && (
                    <a
                      href={candidate.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[14px] border border-bg-border bg-bg-secondary text-[12px] font-semibold text-txt-heading hover:bg-bg-hover shrink-0"
                    >
                      Open <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </Card>
              </div>
            </div>
          )}

          {activeTab === "notes" && <CandidateNotes applicationId={candidate.id} />}

          {activeTab === "timeline" && <CandidateTimeline applicationId={candidate.id} />}

          {activeTab === "ai" && <AiAnalysisPanel candidate={candidate} />}

          {activeTab === "schedule" && (
            <div className="space-y-6">
              <InterviewSlotsOffer candidate={candidate} />
              <div className="border-t border-bg-border/40 pt-4">
                <h3 className="text-[14px] font-semibold text-txt-heading">Or book a fixed time</h3>
              </div>
              <form onSubmit={handleScheduleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="schedule-title"
                    className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1.5"
                  >
                    Interview Stage / Meeting Title
                  </label>
                  <input
                    id="schedule-title"
                    type="text"
                    placeholder="e.g. Technical Round 1"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    maxLength={200}
                    aria-invalid={!!meetingErrors.title || undefined}
                    className="w-full h-10 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-txt-heading text-[13px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 transition-all font-medium"
                  />
                  <FieldError id="schedule-title-error" message={meetingErrors.title} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="schedule-date"
                      className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1.5"
                    >
                      Meeting Date
                    </label>
                    <input
                      id="schedule-date"
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      aria-invalid={!!meetingErrors.date || undefined}
                      className="w-full h-10 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-txt-heading text-[13px] focus:outline-none focus:border-primary/30 transition-all cursor-pointer font-medium"
                    />
                    <FieldError id="schedule-date-error" message={meetingErrors.date} />
                  </div>
                  <div>
                    <label
                      htmlFor="schedule-time"
                      className="text-[11px] font-bold text-txt-caption uppercase tracking-wider block mb-1.5"
                    >
                      Meeting Time
                    </label>
                    <input
                      id="schedule-time"
                      type="time"
                      required
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-[12px] border border-bg-border bg-bg-secondary text-txt-heading text-[13px] focus:outline-none focus:border-primary/30 transition-all cursor-pointer font-medium"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={scheduling}
                    className="w-full h-10 font-bold cursor-pointer"
                  >
                    {scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Schedule and Send Invite <Calendar className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </form>
            </div>
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
