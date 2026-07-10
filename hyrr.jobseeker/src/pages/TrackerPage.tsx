import { useState, useRef, useEffect } from "react"
import { useJobStore, Badge, Button, Input, Card } from "hyrr.shared"
import { MapPin, ArrowRight, ShieldCheck, Mail, MessageSquare, ArrowLeft, Send, Loader2, RefreshCw } from "lucide-react"
import { apiFetch } from "hyrr.shared"

interface TrackerApplication {
  id: string
  jobTitle: string
  company: string
  location: string
  status: "Saved" | "Applied" | "In Process" | "Offer" | "Archived"
  appliedAt: string
  tag?: string
}

interface TrackerMessage {
  sender: "recruiter" | "seeker"
  text: string
  time: string
}

const STATUS_MAP: Record<string, TrackerApplication["status"]> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  IN_PROCESS: "In Process",
  OFFER: "Offer",
  ARCHIVED: "Archived",
}

const steps = [
  { name: "Applied", label: "Application Received" },
  { name: "In Process", label: "Interviewing Phase" },
  { name: "Offer", label: "Offer Details Sent" },
]

function getStepIndex(status: TrackerApplication["status"]) {
  if (status === "Archived") return -1
  if (status === "Saved" || status === "Applied") return 0
  if (status === "In Process") return 1
  if (status === "Offer") return 2
  return 0
}

export function TrackerPage() {
  const { user, conversationMessages, fetchMessages, sendMessage } = useJobStore()

  const [emailInput, setEmailInput] = useState(user?.email || "")
  const [searchedEmail, setSearchedEmail] = useState("")
  const [applications, setApplications] = useState<TrackerApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAppId, setActiveAppId] = useState<string | null>(null)

  const [localMessages, setLocalMessages] = useState<TrackerMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [sendingMsg, setSendingMsg] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeApp = applications.find(a => a.id === activeAppId) || applications[0] || null
  const stepIndex = activeApp ? getStepIndex(activeApp.status) : 0

  // Autofill email for logged-in seekers
  useEffect(() => {
    if (user?.email) setEmailInput(user.email)
  }, [user])

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localMessages, conversationMessages])

  // When active app changes, load messages from API
  useEffect(() => {
    if (activeApp?.id) {
      fetchMessages(activeApp.id).then(() => {
        // map store messages to local format
        setLocalMessages(
          conversationMessages.map(m => ({
            sender: m.senderType === "SEEKER" ? "seeker" : "recruiter",
            text: m.text,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }))
        )
      })
    }
  }, [activeApp?.id]) // eslint-disable-line

  // Sync when conversationMessages updates
  useEffect(() => {
    if (activeApp?.id && conversationMessages.length > 0) {
      setLocalMessages(
        conversationMessages.map(m => ({
          sender: m.senderType === "SEEKER" ? "seeker" : "recruiter",
          text: m.text,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
      )
    }
  }, [conversationMessages]) // eslint-disable-line

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailInput.trim()) return
    setLoading(true)
    setError(null)
    setApplications([])
    setActiveAppId(null)

    try {
      const data = await apiFetch(`/applications/tracker?email=${encodeURIComponent(emailInput.trim())}`, { skipAuth: true })
      const mapped: TrackerApplication[] = (data || []).map((a: any) => ({
        id: a.id,
        jobTitle: a.job?.title || a.title || "Position",
        company: a.job?.company?.name || "Company",
        location: a.job?.location || a.location || "Remote",
        status: STATUS_MAP[a.status] || "Applied",
        appliedAt: a.appliedAt ? new Date(a.appliedAt).toLocaleDateString() : "N/A",
        tag: a.tag,
      }))
      setApplications(mapped)
      setSearchedEmail(emailInput.trim())
      if (mapped.length > 0) setActiveAppId(mapped[0].id)
    } catch (err: any) {
      setError("Could not find any applications for this email. Please verify the email used when applying.")
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeApp || sendingMsg) return
    const text = chatInput.trim()
    setChatInput("")
    setSendingMsg(true)

    // Optimistic local append
    setLocalMessages(prev => [...prev, { sender: "seeker", text, time: "Just now" }])

    try {
      await sendMessage(activeApp.id, text)
    } catch {
      // already handled in store
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Application Tracker</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Check your application status and communicate directly with the hiring team.
        </p>
      </div>

      {!searchedEmail ? (
        <div className="max-w-sm mx-auto">
          <Card className="p-8 space-y-6 shadow-card">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary-border/40 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="text-card-title font-semibold text-txt-heading">Track Your Application</h3>
                <p className="text-caption text-txt-caption mt-0.5 leading-relaxed">
                  {user?.email
                    ? "We've pre-filled your email. Click below to look up your applications."
                    : "Enter the email you used when applying to view your status."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  className="pl-10"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="primary" className="w-full h-10 text-[13px] font-bold cursor-pointer shadow-button" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? "Looking up…" : (<>Look up Applications <ArrowRight className="w-4 h-4 ml-1" /></>)}
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Email header */}
          <div className="flex items-center justify-between p-4 bg-bg-secondary border border-bg-border/60 rounded-card">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-txt-caption">Tracking applications for:</span>
              <strong className="text-[13px] text-txt-heading font-semibold">{searchedEmail}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSearch({ preventDefault: () => {} } as any)}
                className="text-[12px] text-txt-caption hover:text-txt-heading flex items-center gap-1 cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setSearchedEmail(""); setApplications([]); setActiveAppId(null) }}
                className="text-[12.5px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Change Email
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-card bg-sec-red/10 border border-sec-red/20 text-sec-red text-[13px] font-medium">
              {error}
            </div>
          )}

          {applications.length === 0 && !loading && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-bg-border rounded-card bg-bg-secondary/50">
              <Mail className="w-10 h-10 text-txt-disabled mb-3" />
              <p className="text-txt-heading font-semibold">No applications found</p>
              <p className="text-txt-caption text-[12.5px] mt-1">We couldn't find any job applications linked to "{searchedEmail}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Application list */}
              <div className="space-y-3">
                <p className="text-[11px] text-txt-caption font-bold uppercase tracking-wider px-1">
                  Your Applications ({applications.length})
                </p>
                {applications.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => setActiveAppId(app.id)}
                    className={`w-full text-left p-4 rounded-card border transition-all cursor-pointer block ${
                      activeApp?.id === app.id
                        ? "border-primary bg-bg-secondary ring-2 ring-primary/10 shadow-card"
                        : "border-bg-border/60 bg-bg-secondary/60 hover:bg-bg-secondary hover:border-primary/20"
                    }`}
                  >
                    <h4 className="text-[13.5px] font-bold text-txt-heading">{app.jobTitle}</h4>
                    <p className="text-[11.5px] text-txt-caption mt-0.5">{app.company}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[11.5px] text-txt-caption flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{app.location}
                      </span>
                      <Badge variant={app.status === "Offer" ? "success" : app.status === "Archived" ? "secondary" : "primary"}>
                        {app.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>

              {/* Detail panel */}
              <div className="md:col-span-2 space-y-6">
                {activeApp && (
                  <>
                    {/* Status card */}
                    <div className="p-6 bg-bg-secondary border border-bg-border/60 rounded-card shadow-card space-y-6">
                      <div className="flex items-start justify-between pb-4 border-b border-bg-border/40">
                        <div>
                          <span className="text-[11px] text-primary font-bold uppercase tracking-wider">Application Details</span>
                          <h3 className="text-[17px] font-extrabold text-txt-title mt-0.5">{activeApp.jobTitle}</h3>
                          <p className="text-[12.5px] text-txt-caption mt-1">{activeApp.company} · Applied {activeApp.appliedAt}</p>
                        </div>
                        {activeApp.status === "Archived" && (
                          <Badge variant="secondary" className="px-3 py-1 font-semibold text-[12px]">Closed</Badge>
                        )}
                      </div>

                      {activeApp.status !== "Archived" ? (
                        <div className="space-y-4">
                          <p className="text-[12px] font-bold text-txt-heading uppercase tracking-wider">Progress Timeline</p>
                          <div className="flex items-center justify-between relative py-2">
                            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-bg-border/60 z-0">
                              <div
                                className="h-full bg-primary transition-all duration-700 ease-out"
                                style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
                              />
                            </div>
                            {steps.map((st, i) => {
                              const isPassed = i <= stepIndex
                              const isCurrent = i === stepIndex
                              return (
                                <div key={i} className="flex flex-col items-center relative z-10">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] border-2 transition-all ${
                                    isPassed ? "bg-primary border-primary text-white" : "bg-bg-secondary border-bg-border text-txt-caption"
                                  } ${isCurrent ? "ring-4 ring-primary/10 scale-110 shadow-[0_0_12px_rgba(108,99,255,0.4)]" : ""}`}>
                                    {i + 1}
                                  </div>
                                  <span className={`text-[11px] mt-2 font-bold ${isCurrent ? "text-primary" : "text-txt-caption"}`}>
                                    {st.name}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-[14px] bg-bg-primary border border-bg-border/50 text-[13px] text-txt-body leading-relaxed">
                          We appreciate your interest in this position. Unfortunately, we have decided to move forward with other candidates. We will keep your profile for future opportunities.
                        </div>
                      )}
                    </div>

                    {/* Chat with Hiring Team */}
                    <div className="p-6 bg-bg-secondary border border-bg-border/60 rounded-card shadow-card flex flex-col h-[380px]">
                      <div className="flex items-center gap-2 pb-3 border-b border-bg-border/40 shrink-0">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="text-[13.5px] font-bold text-txt-title">Messages with Hiring Team</span>
                      </div>

                      <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
                        {localMessages.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-[12.5px] text-txt-caption">No messages yet. Start the conversation!</p>
                          </div>
                        ) : localMessages.map((msg, i) => {
                          const isSeeker = msg.sender === "seeker"
                          return (
                            <div key={i} className={`flex flex-col ${isSeeker ? "items-end" : "items-start"}`}>
                              <div className={`max-w-[80%] rounded-[18px] px-4 py-2.5 text-[13px] font-medium leading-normal ${
                                isSeeker
                                  ? "bg-primary text-white rounded-tr-none"
                                  : "bg-bg-primary border border-bg-border text-txt-heading rounded-tl-none"
                              }`}>
                                {msg.text}
                              </div>
                              <span className="text-[10px] text-txt-caption mt-1 px-1">{msg.time}</span>
                            </div>
                          )
                        })}
                        <div ref={messagesEndRef} />
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-bg-border/40 shrink-0">
                        <Input
                          placeholder="Type your message here…"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                          className="flex-1"
                        />
                        <Button variant="primary" onClick={handleSendMessage} className="px-4 cursor-pointer" disabled={sendingMsg}>
                          {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
