import { useState } from "react"
import { useJobStore, type Candidate, Badge, Button, Input, Card } from "hyrr.shared"
import { MapPin, ArrowRight, ShieldCheck, Mail, MessageSquare, ArrowLeft, Send } from "lucide-react"

export function TrackerPage() {
  const { candidates, jobs } = useJobStore()
  const [emailInput, setEmailInput] = useState("")
  const [searchedEmail, setSearchedEmail] = useState("")
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null)
  
  // Quick Mock chat list
  const [messages, setMessages] = useState<Record<string, { sender: "recruiter" | "seeker"; text: string; time: string }[]>>({
    default: [
      { sender: "recruiter", text: "Hi Emily, thanks for applying! We are currently reviewing your profile.", time: "2 hours ago" }
    ]
  })
  const [chatInput, setChatInput] = useState("")

  const myApplications = candidates.filter(
    (c: Candidate) => c.email && c.email.toLowerCase().trim() === searchedEmail.toLowerCase().trim()
  )

  const activeApp = myApplications.find((a: Candidate) => a.id === activeCandidateId) || myApplications[0]
  const relatedJob = activeApp ? jobs.find((j) => j.id === activeApp.jobId) : null

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (emailInput.trim()) {
      setSearchedEmail(emailInput.trim())
      if (myApplications.length > 0) {
        setActiveCandidateId(myApplications[0].id)
      }
    }
  }

  const handleSendMessage = () => {
    if (!chatInput.trim() || !activeApp) return
    const appId = activeApp.id
    const newMsg = { sender: "seeker" as const, text: chatInput.trim(), time: "Just now" }
    
    setMessages((prev) => ({
      ...prev,
      [appId]: [...(prev[appId] || [
        { sender: "recruiter", text: "Thanks for the message! Our recruitment team will review it shortly.", time: "1m ago" }
      ]), newMsg]
    }))
    setChatInput("")

    // Auto reply mock in 1.5s
    setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [appId]: [
          ...(prev[appId] || []),
          { sender: "recruiter", text: "Received your message! We will get back to you if any other documents are required.", time: "Just now" }
        ]
      }))
    }, 1500)
  }

  const steps = [
    { name: "Applied", label: "Application Received" },
    { name: "In Process", label: "Interviewing Phase" },
    { name: "Offer", label: "Offer Details Sent" },
  ]

  const getStepIndex = (status: Candidate["status"]) => {
    if (status === "Archived") return -1
    if (status === "Saved") return 0
    if (status === "Applied") return 0
    if (status === "In Process") return 1
    if (status === "Offer") return 2
    return 0
  }

  const stepIndex = activeApp ? getStepIndex(activeApp.status) : 0
  const appMessages = activeApp ? (messages[activeApp.id] || messages.default) : []

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Application Tracker</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Check status, view evaluation steps, and directly contact the hiring team.
        </p>
      </div>

      {!searchedEmail ? (
        /* Lookup view — centered card matching recruiter modal style */
        <div className="max-w-sm mx-auto">
          <Card className="p-8 space-y-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-light border border-primary-border/40 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-card-title font-semibold text-txt-heading">Track Your Application</h3>
                <p className="text-caption text-txt-caption mt-0.5 leading-relaxed">
                  Enter the email you used when applying to view your status.
                </p>
              </div>
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
                <Input
                  type="email"
                  placeholder="emily@example.com"
                  className="pl-10"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="primary" className="w-full h-10 text-[13px] font-bold cursor-pointer">
                Look up Applications <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        /* Tracker Panel */
        <div className="flex flex-col gap-6">
          {/* Quick search swap */}
          <div className="flex items-center justify-between p-4 bg-bg-secondary border border-bg-border/60 rounded-card">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-txt-caption">Tracking applications for:</span>
              <strong className="text-[13px] text-txt-heading font-semibold">{searchedEmail}</strong>
            </div>
            <button
              onClick={() => {
                setSearchedEmail("")
                setEmailInput("")
              }}
              className="text-[12.5px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change Email
            </button>
          </div>

          {myApplications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-bg-border rounded-card bg-bg-secondary/50">
              <Mail className="w-10 h-10 text-txt-disabled mb-3" />
              <p className="text-txt-heading font-semibold">No applications found</p>
              <p className="text-txt-caption text-[12.5px] mt-1">We couldn't find any job applications linked to "{searchedEmail}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sidebar: list of submissions */}
              <div className="space-y-3">
                <p className="text-[11px] text-txt-caption font-bold uppercase tracking-wider px-1">Your Applications ({myApplications.length})</p>
                {myApplications.map((app) => {
                  const job = jobs.find((j) => j.id === app.jobId)
                  const isActive = activeApp?.id === app.id
                  return (
                    <button
                      key={app.id}
                      onClick={() => setActiveCandidateId(app.id)}
                      className={`w-full text-left p-4 rounded-card border transition-all cursor-pointer block ${
                        isActive
                          ? "border-primary bg-bg-secondary ring-2 ring-primary/10 shadow-card"
                          : "border-bg-border/60 bg-bg-secondary/60 hover:bg-bg-secondary hover:border-primary/20"
                      }`}
                    >
                      <h4 className="text-[13.5px] font-bold text-txt-heading group-hover:text-primary transition-colors">{job?.title || app.title}</h4>
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-[11.5px] text-txt-caption flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</span>
                        <Badge variant={app.status === "Offer" ? "success" : app.status === "Archived" ? "secondary" : "primary"}>
                          {app.status}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Details and chat */}
              <div className="md:col-span-2 space-y-6">
                {activeApp && (
                  <>
                    {/* Status card */}
                    <div className="p-6 bg-bg-secondary border border-bg-border/60 rounded-card shadow-card space-y-6">
                      <div className="flex items-start justify-between pb-4 border-b border-bg-border/40">
                        <div>
                          <span className="text-[11px] text-primary font-bold uppercase tracking-wider">Application Details</span>
                          <h3 className="text-[17px] font-extrabold text-txt-title mt-0.5">{relatedJob?.title || activeApp.title}</h3>
                          <p className="text-[12.5px] text-txt-caption mt-1">Submitted {activeApp.dateText}</p>
                        </div>
                        {activeApp.status === "Archived" && (
                          <Badge variant="secondary" className="px-3 py-1 font-semibold text-[12px]">Closed / Archive</Badge>
                        )}
                      </div>

                      {/* Process Steps */}
                      {activeApp.status !== "Archived" ? (
                        <div className="space-y-4">
                          <p className="text-[12px] font-bold text-txt-heading uppercase tracking-wider">Progress Timeline</p>
                          <div className="flex items-center justify-between relative py-2">
                            {/* Connector Line */}
                            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-bg-border/60 z-0">
                              <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
                              />
                            </div>

                            {/* Steps Nodes */}
                            {steps.map((st, i) => {
                              const isPassed = i <= stepIndex
                              const isCurrent = i === stepIndex
                              return (
                                <div key={i} className="flex flex-col items-center relative z-10">
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[12px] border transition-all ${
                                      isPassed
                                        ? "bg-primary border-primary text-white"
                                        : "bg-bg-secondary border-bg-border text-txt-caption"
                                    } ${isCurrent ? "ring-4 ring-primary/10 scale-110" : ""}`}
                                  >
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
                          We appreciate your interest in HYRR! Unfortunately, we have decided to move forward with other candidates for this specific opening. We will keep your profile in our records for future fits.
                        </div>
                      )}
                    </div>

                    {/* Chat with Hiring Team */}
                    <div className="p-6 bg-bg-secondary border border-bg-border/60 rounded-card shadow-card flex flex-col h-[350px]">
                      <div className="flex items-center gap-2 pb-3 border-b border-bg-border/40 shrink-0">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="text-[13.5px] font-bold text-txt-title">Messages with Hiring Team</span>
                      </div>

                      {/* Messages scroll */}
                      <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
                        {appMessages.map((msg, i) => {
                          const isSeeker = msg.sender === "seeker"
                          return (
                            <div key={i} className={`flex flex-col ${isSeeker ? "items-end" : "items-start"}`}>
                              <div
                                className={`max-w-[80%] rounded-[18px] px-4 py-2.5 text-[13px] font-medium leading-normal ${
                                  isSeeker
                                    ? "bg-primary text-white rounded-tr-none"
                                    : "bg-bg-primary border border-bg-border text-txt-heading rounded-tl-none"
                                }`}
                              >
                                {msg.text}
                              </div>
                              <span className="text-[10px] text-txt-caption mt-1 px-1">{msg.time}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Chat input */}
                      <div className="flex gap-2 pt-3 border-t border-bg-border/40 shrink-0">
                        <Input
                          placeholder="Type your message here…"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                          className="flex-1"
                        />
                        <Button variant="primary" onClick={handleSendMessage} className="px-4 cursor-pointer">
                          <Send className="w-4 h-4" />
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
