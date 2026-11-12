import {
  APPLICATION_STATUS,
  APPLICATION_STATUS_LABEL,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  VerifiedBadge,
  dateTime,
  stageTone,
  useJobStore,
} from "hyrr.shared"
import {
  ArrowUpRight,
  Briefcase,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Home,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { ProfileStrengthCard } from "../components/profile/profile-strength"

const colorDot: Record<string, string> = {
  purple: "bg-primary",
  blue: "bg-sec-blue",
  green: "bg-sec-green",
  orange: "bg-sec-orange",
}

export function CandidateDashboard() {
  const { jobApplications, recommendedJobs, setCandidateActiveView, user, events } = useJobStore()

  const applied = jobApplications.filter((a) => a.status === APPLICATION_STATUS.APPLIED).length
  const inProcess = jobApplications.filter(
    (a) =>
      a.status === APPLICATION_STATUS.IN_PROCESS || a.status === APPLICATION_STATUS.INTERVIEWING
  ).length
  const interviewing = jobApplications.filter(
    (a) => a.status === APPLICATION_STATUS.INTERVIEWING
  ).length
  const offers = jobApplications.filter((a) => a.status === APPLICATION_STATUS.OFFER).length

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()
  const firstName = user?.name?.split(" ")[0] || "there"

  const stats = [
    {
      title: "Applied",
      value: applied,
      icon: Briefcase,
      change: `${applied} submissions`,
      trend: "up",
    },
    {
      title: "In Process",
      value: inProcess,
      icon: TrendingUp,
      change: "Active pipelines",
      trend: "up",
    },
    {
      title: "Interviewing",
      value: interviewing,
      icon: CalendarCheck,
      change: interviewing > 0 ? "🎯 Keep it up!" : "No interviews yet",
      trend: interviewing > 0 ? "up" : "neutral",
    },
    {
      title: "Offers",
      value: offers,
      icon: Trophy,
      change: offers > 0 ? "🎉 Congrats!" : "Keep pushing!",
      trend: offers > 0 ? "up" : "neutral",
    },
  ]

  const now = Date.now()
  const nextInterview = events
    .filter((e) => e.type === "interview" && new Date(e.startTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
  const interviewApp = nextInterview?.applicationId
    ? jobApplications.find((a) => a.id === nextInterview.applicationId)
    : undefined
  const upcomingInterview = nextInterview
    ? {
        title: interviewApp?.title || nextInterview.title,
        company: interviewApp?.company || nextInterview.title,
        when: dateTime(nextInterview.startTime),
      }
    : null
  const offerApps = jobApplications.filter((a) => a.status === APPLICATION_STATUS.OFFER)
  // Newest first (store order is already newest-first; sort by last update to be explicit)
  const recentActivity = jobApplications
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4)
  const recommended = recommendedJobs.slice(0, 3)
  const hasRecentActivity = recentActivity.length > 0
  const hasRecommended = recommended.length > 0

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Background ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Greeting */}
      <PageHeader
        icon={Home}
        tone="violet"
        className="relative z-10"
        title={`${greeting}, ${firstName}`}
        subtitle={`You have ${inProcess} active application${inProcess !== 1 ? "s" : ""} in progress${
          offers > 0
            ? ` and ${offers} offer${offers !== 1 ? "s" : ""} waiting for your decision`
            : ""
        }.`}
      />

      {/* Stats Grid */}
      <div className="stagger grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5 relative z-10">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            caption={stat.change}
            icon={stat.icon}
            tone={stageTone(stat.title)}
            onClick={() => setCandidateActiveView("Applications")}
          />
        ))}
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative z-10">
        {/* Recent Activity */}
        <Card className="xl:col-span-2 p-6 flex flex-col gap-5 glass-panel hover-lift border-bg-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-card-title font-bold text-txt-heading text-glow">
                Recent Activity
              </h3>
              <p className="text-caption text-txt-caption mt-0.5 font-medium">
                Your latest application status updates
              </p>
            </div>
            <button
              onClick={() => setCandidateActiveView("Applications")}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] text-primary hover:text-primary-hover font-bold transition-all cursor-pointer hover:translate-x-1"
            >
              <span>View Board</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {hasRecentActivity ? (
              recentActivity.map((app) => (
                <button
                  type="button"
                  key={app.id}
                  onClick={() => setCandidateActiveView("Applications")}
                  className="w-full text-left flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-[16px] bg-bg-primary/40 dark:bg-bg-primary/20 border border-bg-border/30 hover:border-primary/30 hover:bg-bg-primary/80 dark:hover:bg-bg-primary/40 hover:shadow-[0_2px_12px_rgba(108,99,255,0.06)] transition-all duration-200 cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 shrink-0 rounded-full ${colorDot[app.companyColor] ?? "bg-primary"} shadow-[0_0_8px_currentColor]`}
                    />
                    <div className="min-w-0">
                      <span className="text-[14px] font-semibold text-txt-heading">
                        {app.title}
                      </span>
                      <span className="text-[13px] text-txt-caption ml-2 font-medium">
                        at {app.company}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        app.status === APPLICATION_STATUS.OFFER
                          ? "success"
                          : app.status === APPLICATION_STATUS.ARCHIVED ||
                              app.status === APPLICATION_STATUS.WITHDRAWN
                            ? "secondary"
                            : app.status === APPLICATION_STATUS.INTERVIEWING
                              ? "primary"
                              : app.status === APPLICATION_STATUS.IN_PROCESS
                                ? "warning"
                                : "info"
                      }
                    >
                      {app.tag ?? APPLICATION_STATUS_LABEL[app.status]}
                    </Badge>
                    <span className="text-caption text-txt-caption font-bold">
                      {app.appliedDate}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                icon={Briefcase}
                tone="violet"
                title="No activity yet"
                description="Start applying to jobs and your activity will appear here."
                className="min-h-[220px] border-0 bg-transparent"
                action={
                  <Button size="sm" onClick={() => setCandidateActiveView("Discover")}>
                    Browse open positions
                  </Button>
                }
              />
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Upcoming interview */}
          {upcomingInterview && (
            <Card className="p-5 border-l-4 border-l-primary relative overflow-hidden group hover-lift glass-panel">
              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-primary/5 blur-2xl pointer-events-none group-hover:bg-primary/10 transition-colors" />
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-extrabold text-primary uppercase tracking-wider">
                  Upcoming Interview
                </span>
              </div>
              <h4 className="text-[14.5px] font-bold text-txt-heading">
                {upcomingInterview.title}
              </h4>
              <p className="text-[13.5px] text-txt-body mt-0.5 font-medium">
                {upcomingInterview.company}
              </p>
              <div className="mt-3 p-2.5 rounded-[10px] bg-primary-light dark:bg-primary-light/10 border border-primary-border/30">
                <p className="text-[13.5px] font-bold text-primary">{upcomingInterview.when}</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCandidateActiveView("Calendar")}
                className="w-full mt-3 cursor-pointer text-[13px] font-bold premium-shimmer-btn text-white border-0"
              >
                Prepare for Interview
              </Button>
            </Card>
          )}

          {/* Offers pending */}
          {offerApps.length > 0 && (
            <Card className="p-5 border-l-4 border-l-sec-green glass-panel hover-lift">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-sec-green" />
                <span className="text-[13px] font-extrabold text-sec-green uppercase tracking-wider">
                  Offer Received
                </span>
              </div>
              {offerApps.map((app) => (
                <div key={app.id}>
                  <h4 className="text-[14.5px] font-bold text-txt-heading">{app.title}</h4>
                  <p className="text-[13.5px] text-txt-body font-medium">{app.company}</p>
                  {app.offerAmount && (
                    <div className="mt-2 p-2.5 rounded-[10px] bg-sec-green/10 border border-sec-green/20">
                      <p className="text-[13px] font-black text-sec-green">{app.offerAmount}</p>
                    </div>
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCandidateActiveView("Applications")}
                className="w-full mt-3 cursor-pointer text-[13px] font-bold"
              >
                Review Offer Details
              </Button>
            </Card>
          )}

          {/* Profile strength (server-computed) */}
          <ProfileStrengthCard limit={3} className="glass-panel hover-lift border-bg-border/60" />
        </div>
      </div>

      {/* Recommended Jobs */}
      <Card className="p-6 relative z-10 glass-panel border-bg-border/60">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-card-title font-bold text-txt-heading text-glow">
              Recommended for You
            </h3>
            <p className="text-caption text-txt-caption mt-0.5 font-medium">
              Based on your profile and activity
            </p>
          </div>
          <button
            onClick={() => setCandidateActiveView("Discover")}
            className="flex items-center gap-1 text-[13px] text-primary hover:text-primary-hover font-bold transition-all cursor-pointer hover:translate-x-1"
          >
            <span>Browse All Jobs</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hasRecommended ? (
            recommended.map((job) => (
              <button
                type="button"
                key={job.id}
                onClick={() => setCandidateActiveView("Discover")}
                className="text-left p-5 rounded-card border border-bg-border/50 bg-bg-secondary hover:border-primary/40 hover:shadow-xl transition-all cursor-pointer group hover:-translate-y-1 duration-200"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={`w-9 h-9 rounded-[10px] ${colorDot[job.companyColor] ?? "bg-primary"} flex items-center justify-center text-white font-black text-[13px] shrink-0`}
                  >
                    {job.company[0]}
                  </div>
                  <Badge variant="primary" className="text-[11px] font-bold">
                    Featured
                  </Badge>
                </div>
                <h4 className="text-[14px] font-bold text-txt-heading group-hover:text-primary transition-colors">
                  {job.title}
                </h4>
                <p className="text-[13px] text-txt-body mt-0.5 font-semibold flex items-center gap-1">
                  {job.company}
                  {job.companyVerified && <VerifiedBadge focusable={false} />}
                </p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-bg-border/30">
                  <span className="text-[12.5px] text-txt-caption font-semibold">
                    {job.location}
                  </span>
                  <span className="text-[13px] font-bold text-primary">{job.salary}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="md:col-span-3 flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-txt-heading">No featured jobs yet</p>
                <p className="text-[13px] text-txt-caption mt-1">
                  Browse all open positions to find opportunities that match your profile.
                </p>
              </div>
              <button
                onClick={() => setCandidateActiveView("Discover")}
                className="text-[13.5px] font-bold text-primary hover:text-primary-hover transition-colors cursor-pointer"
              >
                Browse all jobs →
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6 relative z-10 glass-panel border-bg-border/60">
        <h3 className="text-card-title font-bold text-txt-heading mb-4 text-glow">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Discover Jobs", icon: Briefcase, view: "Discover" as const },
            { label: "View Applications", icon: TrendingUp, view: "Applications" as const },
            { label: "Update Profile", icon: Star, view: "Profile" as const },
            { label: "Check Calendar", icon: Calendar, view: "Calendar" as const },
          ].map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={() => setCandidateActiveView(action.view)}
                className="flex items-center gap-2.5 p-3.5 rounded-[13px] border border-bg-border/60 bg-bg-secondary hover:border-primary/30 hover:bg-bg-hover transition-all cursor-pointer group text-left hover:-translate-y-0.5 duration-200 shadow-sm"
              >
                <div className="w-8 h-8 rounded-[10px] bg-primary-light dark:bg-primary-light/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[13.5px] font-bold text-txt-heading group-hover:text-primary transition-colors">
                  {action.label}
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
