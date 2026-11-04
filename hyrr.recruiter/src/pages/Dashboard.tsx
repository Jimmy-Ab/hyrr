import { Card, notificationConversationId } from "hyrr.shared"
import { ArrowUpRight, Briefcase, Calendar, CheckSquare, TrendingUp, Users } from "lucide-react"
import { isRecruiterView } from "../lib/recruiter"
import { useJobStore } from "../store/useJobStore"

const statsAccents = [
  "accent-card-primary",
  "accent-card-blue",
  "accent-card-orange",
  "accent-card-green",
]

export function Dashboard() {
  const { candidates, jobs, notifications, setActiveView, openConversation, events, user } =
    useJobStore()

  const totalCandidates = candidates.length
  const activeJobs = jobs.filter((j) => j.status === "Active").length
  const offersSent = candidates.filter((c) => c.status === "Offer").length
  const now = Date.now()
  const interviewsCount = events.filter(
    (e) => e.type === "interview" && new Date(e.startTime).getTime() >= now
  ).length

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()
  const firstName = user?.name?.split(" ")[0] || "there"

  const stats = [
    { title: "Total Candidates", value: totalCandidates, icon: Users, caption: "in pipeline" },
    {
      title: "Active Openings",
      value: activeJobs,
      icon: Briefcase,
      caption: `of ${jobs.length} jobs`,
    },
    { title: "Interviews Booked", value: interviewsCount, icon: Calendar, caption: "upcoming" },
    { title: "Offers Sent", value: offersSent, icon: CheckSquare, caption: "at offer stage" },
  ]

  const pipeline = [
    {
      label: "Applied",
      count: candidates.filter((c) => c.status === "Applied").length,
      color: "bg-sec-blue",
      glow: "rgba(59,127,245,0.3)",
    },
    {
      label: "In Process",
      count: candidates.filter((c) => c.status === "In Process").length,
      color: "bg-sec-orange",
      glow: "rgba(196,127,0,0.3)",
    },
    {
      label: "Interviewing",
      count: candidates.filter((c) => c.status === "Interviewing").length,
      color: "bg-primary",
      glow: "rgba(108,99,255,0.3)",
    },
    {
      label: "Offered",
      count: candidates.filter((c) => c.status === "Offer").length,
      color: "bg-sec-green",
      glow: "rgba(27,158,60,0.3)",
    },
    {
      label: "Archived",
      count: candidates.filter((c) => c.status === "Archived" || c.status === "Withdrawn").length,
      color: "bg-sec-gray",
      glow: "rgba(107,116,133,0.3)",
    },
  ]
  const maxCount = totalCandidates || 1

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Header */}
      <div className="relative z-10">
        <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight">
          <span className="premium-gradient-text text-glow">
            {greeting}, {firstName}
          </span>{" "}
          👋
        </h1>
        <p className="text-body text-txt-body mt-1 font-semibold opacity-90">
          {activeJobs} active opening{activeJobs !== 1 ? "s" : ""} · {totalCandidates} candidates in
          pipeline
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 relative z-10">
        {stats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <Card
              key={idx}
              className={`p-6 flex flex-col justify-between h-36 relative overflow-hidden ${statsAccents[idx]}`}
            >
              <div className="flex items-start justify-between relative z-10">
                <span className="text-[11px] font-bold tracking-wider text-txt-caption uppercase">
                  {stat.title}
                </span>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-light to-primary-light/60 border border-primary-border/40 flex items-center justify-center text-primary shadow-[0_0_12px_rgba(108,99,255,0.08)] group-hover:shadow-[0_0_18px_rgba(108,99,255,0.2)] transition-shadow">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="text-[30px] font-black text-txt-title leading-none tabular-nums">
                  {stat.value}
                </span>
                <span className="text-[11.5px] text-txt-caption font-semibold">{stat.caption}</span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-10">
        {/* Recent Activities */}
        <Card className="xl:col-span-2 p-6 flex flex-col gap-5 glass-panel border-bg-border/60 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-card-title font-bold text-txt-heading text-glow">
                Recent Activities
              </h3>
              <p className="text-caption text-txt-caption mt-0.5 font-medium">
                Latest status updates across jobs
              </p>
            </div>
            <button
              onClick={() => setActiveView("Analytics")}
              className="flex items-center gap-1 text-[13px] text-primary hover:text-primary-hover font-bold transition-all cursor-pointer hover:translate-x-1"
            >
              <span>View Analytics</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {notifications.slice(0, 5).map((notif) => {
              const target = notif.actionView as string | undefined
              const content = (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                    <span className="text-[13.5px] font-semibold text-txt-heading truncate">
                      {notif.title}
                    </span>
                  </div>
                  <span className="text-caption text-txt-caption font-bold shrink-0">
                    {notif.time}
                  </span>
                </>
              )
              const rowCls =
                "flex items-center justify-between gap-3 p-3.5 rounded-[16px] bg-bg-primary/40 border border-bg-border/30 text-left w-full"
              const conversationId = notificationConversationId(notif)
              return conversationId || isRecruiterView(target) ? (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    if (conversationId) {
                      setActiveView("Messages")
                      openConversation(conversationId).catch(() => {})
                    } else if (isRecruiterView(target)) setActiveView(target)
                  }}
                  className={`${rowCls} hover:border-primary/30 hover:bg-bg-hover transition-colors cursor-pointer`}
                >
                  {content}
                </button>
              ) : (
                <div key={notif.id} className={rowCls}>
                  {content}
                </div>
              )
            })}
            {notifications.length === 0 && (
              <div className="py-10 flex flex-col items-center gap-2 text-center">
                <TrendingUp className="w-8 h-8 text-txt-disabled" />
                <p className="text-[13px] text-txt-caption font-semibold">No recent activity yet</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pipeline Distribution */}
        <Card className="p-6 glass-panel border-bg-border/60">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-card-title font-bold text-txt-heading text-glow">Pipeline</h3>
            <button
              onClick={() => setActiveView("Candidates")}
              className="flex items-center gap-1 text-[12px] text-primary hover:text-primary-hover font-bold transition-all cursor-pointer hover:translate-x-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {pipeline.map((col, idx) => {
              const pct = Math.round((col.count / maxCount) * 100)
              return (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[12.5px] font-semibold">
                    <span className="text-txt-body">{col.label}</span>
                    <span className="text-txt-heading font-bold">
                      {col.count} <span className="text-txt-caption font-medium">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-bg-primary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${col.color}`}
                      style={{
                        width: `${pct}%`,
                        boxShadow: pct > 0 ? `0 0 8px ${col.glow}` : "none",
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mini total callout */}
          <div className="mt-5 pt-4 border-t border-bg-border/40 flex items-center justify-between">
            <span className="text-[11.5px] text-txt-caption font-semibold uppercase tracking-wider">
              Total in Pipeline
            </span>
            <span className="text-[18px] font-black text-txt-title tabular-nums">
              {totalCandidates}
            </span>
          </div>
        </Card>
      </div>
    </div>
  )
}
