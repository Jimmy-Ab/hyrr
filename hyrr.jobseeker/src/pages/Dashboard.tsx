import { Briefcase, ArrowUpRight, Star, Calendar, Bookmark, CheckCircle2, Archive, TrendingUp, Zap } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { useJobStore } from "hyrr.shared"

const colorDot: Record<string, string> = {
  purple: "bg-primary",
  blue: "bg-sec-blue",
  green: "bg-sec-green",
  orange: "bg-sec-orange",
}

export function CandidateDashboard() {
  const { jobApplications, publicJobs, setCandidateActiveView, notifications } = useJobStore()

  const applied    = jobApplications.filter((a) => a.status === "Applied").length
  const inProcess  = jobApplications.filter((a) => a.status === "In Process").length
  const offers     = jobApplications.filter((a) => a.status === "Offer").length
  const saved      = jobApplications.filter((a) => a.status === "Saved").length
  const archived   = jobApplications.filter((a) => a.status === "Archived").length

  const stats = [
    { title: "Saved Jobs",       value: saved,     icon: Bookmark,     change: "Ready to apply",          trend: "neutral" },
    { title: "Applied",          value: applied,   icon: Briefcase,    change: `${applied} submissions`,   trend: "up" },
    { title: "In Process",       value: inProcess, icon: TrendingUp,   change: "Active pipelines",         trend: "up" },
    { title: "Offers Received",  value: offers,    icon: CheckCircle2, change: offers > 0 ? "🎉 Congrats!" : "Keep pushing!", trend: offers > 0 ? "up" : "neutral" },
  ]

  const upcomingInterview = jobApplications.find((a) => a.interviewDate)
  const offerApps         = jobApplications.filter((a) => a.status === "Offer")
  const recentActivity    = jobApplications.slice().reverse().slice(0, 4)
  const recommended       = publicJobs.filter((j) => j.featured).slice(0, 3)

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Greeting */}
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Good morning, Emily 👋</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          You have {inProcess} active application{inProcess !== 1 ? "s" : ""} in progress
          {offers > 0 ? ` and ${offers} offer${offers !== 1 ? "s" : ""} waiting for your decision` : ""}.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <Card
              key={idx}
              hoverEffect
              className="p-6 flex flex-col justify-between h-36 relative overflow-hidden group"
            >
              {/* Subtle gradient shimmer on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-inherit" />
              <div className="flex items-start justify-between relative z-10">
                <span className="text-[11.5px] font-bold tracking-wider text-txt-caption uppercase">{stat.title}</span>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-light to-primary-light/60 border border-primary-border/40 flex items-center justify-center text-primary shadow-[0_0_12px_rgba(108,99,255,0.08)] group-hover:shadow-[0_0_18px_rgba(108,99,255,0.2)] transition-shadow">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2 relative z-10">
                <span className="text-[30px] font-extrabold text-txt-title leading-none tabular-nums">{stat.value}</span>
                <span className="text-[12px] text-txt-caption font-semibold">{stat.change}</span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent Activity */}
        <Card className="xl:col-span-2 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-card-title font-semibold text-txt-heading">Recent Activity</h3>
              <p className="text-caption text-txt-caption mt-0.5">Your latest application status updates</p>
            </div>
            <button
              onClick={() => setCandidateActiveView("Applications")}
              className="flex items-center gap-1 text-[13px] text-primary hover:text-primary-hover font-semibold transition-colors cursor-pointer"
            >
              <span>View Board</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {recentActivity.map((app) => (
              <div key={app.id} className="flex items-center justify-between p-3.5 rounded-[16px] bg-bg-primary/50 border border-bg-border/30 hover:border-primary/20 hover:bg-bg-primary/80 hover:shadow-[0_2px_12px_rgba(108,99,255,0.06)] transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${colorDot[app.companyColor] ?? "bg-primary"} shadow-[0_0_6px_currentColor]`} />
                  <div>
                    <span className="text-[14px] font-medium text-txt-heading">{app.title}</span>
                    <span className="text-[12px] text-txt-caption ml-2">at {app.company}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={app.status === "Offer" ? "success" : app.status === "Archived" ? "secondary" : app.status === "In Process" ? "warning" : "primary"}>
                    {app.tag ?? app.status}
                  </Badge>
                  <span className="text-caption text-txt-caption font-semibold">{app.appliedDate}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Upcoming interview */}
          {upcomingInterview && (
            <Card className="p-5 border-l-4 border-l-primary relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-primary/5 blur-2xl pointer-events-none group-hover:bg-primary/10 transition-colors" />
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-bold text-primary uppercase tracking-wider">Upcoming Interview</span>
              </div>
              <h4 className="text-[14px] font-bold text-txt-heading">{upcomingInterview.title}</h4>
              <p className="text-[12.5px] text-txt-body mt-0.5">{upcomingInterview.company}</p>
              <div className="mt-3 p-2.5 rounded-[10px] bg-primary-light border border-primary-border/30">
                <p className="text-[12px] font-bold text-primary">{upcomingInterview.interviewDate}</p>
              </div>
              <Button variant="primary" size="sm" className="w-full mt-3 cursor-pointer text-[12px]">
                Prepare for Interview
              </Button>
            </Card>
          )}

          {/* Offers pending */}
          {offerApps.length > 0 && (
            <Card className="p-5 border-l-4 border-l-sec-green">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-sec-green" />
                <span className="text-[13px] font-bold text-sec-green uppercase tracking-wider">Offer Received</span>
              </div>
              {offerApps.map((app) => (
                <div key={app.id}>
                  <h4 className="text-[14px] font-bold text-txt-heading">{app.title}</h4>
                  <p className="text-[12.5px] text-txt-body">{app.company}</p>
                  {app.offerAmount && (
                    <div className="mt-2 p-2.5 rounded-[10px] bg-sec-green/10 border border-sec-green/20">
                      <p className="text-[13px] font-extrabold text-sec-green">{app.offerAmount}</p>
                    </div>
                  )}
                </div>
              ))}
              <Button variant="secondary" size="sm" className="w-full mt-3 cursor-pointer text-[12px]">
                Review Offer Details
              </Button>
            </Card>
          )}

          {/* Resume strength */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-txt-heading">Profile Strength</h3>
              <span className="text-[12px] font-bold text-primary">78%</span>
            </div>
            <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: "78%" }} />
            </div>
            <div className="mt-3 space-y-1.5">
              {["Add portfolio link", "Upload certificates"].map((tip) => (
                <div key={tip} className="flex items-center gap-2 text-[11.5px] text-txt-caption">
                  <div className="w-1.5 h-1.5 rounded-full bg-sec-orange shrink-0" />
                  {tip}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recommended Jobs */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-card-title font-semibold text-txt-heading">Recommended for You</h3>
            <p className="text-caption text-txt-caption mt-0.5">Based on your profile and activity</p>
          </div>
          <button
            onClick={() => setCandidateActiveView("Discover")}
            className="flex items-center gap-1 text-[13px] text-primary hover:text-primary-hover font-semibold transition-colors cursor-pointer"
          >
            <span>Browse All Jobs</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommended.map((job) => (
            <div
              key={job.id}
              onClick={() => setCandidateActiveView("Discover")}
              className="p-4 rounded-card border border-bg-border/60 bg-bg-secondary hover:border-primary/30 hover:shadow-card transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`w-9 h-9 rounded-[10px] ${colorDot[job.companyColor] ?? "bg-primary"} flex items-center justify-center text-white font-bold text-[13px] shrink-0`}>
                  {job.company[0]}
                </div>
                <Badge variant="primary" className="text-[10px]">Featured</Badge>
              </div>
              <h4 className="text-[13.5px] font-bold text-txt-heading group-hover:text-primary transition-colors">{job.title}</h4>
              <p className="text-[12px] text-txt-body mt-0.5">{job.company}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[11.5px] text-txt-caption">{job.location}</span>
                <span className="text-[11.5px] font-semibold text-primary">{job.salary}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-card-title font-semibold text-txt-heading mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Discover Jobs",     icon: Briefcase,    view: "Discover" as const },
            { label: "View Applications", icon: TrendingUp,   view: "Applications" as const },
            { label: "Update Profile",    icon: Star,         view: "Profile" as const },
            { label: "Check Calendar",    icon: Calendar,     view: "Calendar" as const },
          ].map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={() => setCandidateActiveView(action.view)}
                className="flex items-center gap-2.5 p-3.5 rounded-[13px] border border-bg-border/60 bg-bg-secondary hover:border-primary/30 hover:bg-bg-hover transition-all cursor-pointer group text-left"
              >
                <div className="w-8 h-8 rounded-[10px] bg-primary-light flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[12.5px] font-semibold text-txt-heading group-hover:text-primary transition-colors">{action.label}</span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
