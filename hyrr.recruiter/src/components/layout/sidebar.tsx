import { type ElementType } from "react"
import {
  Home,
  BriefcaseBusiness,
  Users,
  CheckSquare,
  Calendar,
  MessageSquare,
  BarChart2,
  Plus,
  Sparkles,
  ExternalLink,
} from "lucide-react"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { useToast } from "../ui/toast"

export function Sidebar() {
  const {
    jobs,
    selectedJobId,
    selectJob,
    activeView,
    setActiveView,
  } = useJobStore()
  const { toast } = useToast()

  const unreadMessagesCount = 3

  type ViewId = typeof activeView

  const navItems: { id: ViewId; label: string; icon: ElementType; badge?: number }[] = [
    { id: "Dashboard",    label: "Dashboard",    icon: Home },
    { id: "Jobs",         label: "Jobs",         icon: BriefcaseBusiness },
    { id: "Candidates",  label: "Candidates",   icon: Users },
    { id: "Applications", label: "Applications", icon: CheckSquare },
    { id: "Calendar",    label: "Calendar",     icon: Calendar },
    { id: "Messages",    label: "Messages",     icon: MessageSquare, badge: unreadMessagesCount },
    { id: "Analytics",   label: "Analytics",    icon: BarChart2 },
  ]

  const dotColorClasses: Record<string, string> = {
    purple: "bg-[#6C63FF]",
    blue:   "bg-[#4F8EF7]",
    green:  "bg-[#34C759]",
    orange: "bg-[#FFB547]",
  }

  return (
    <div className="w-[260px] shrink-0 bg-bg-sidebar border-r border-bg-border/60 flex flex-col h-[calc(100vh-68px)] p-5 justify-between select-none">
      {/* ─── Top nav ─── */}
      <div className="flex flex-col gap-5">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id

            return (
              <button
                key={item.id}
                id={`nav-${item.id.toLowerCase()}`}
                onClick={() => {
                  setActiveView(item.id)
                  if (item.id === "Applications" && !selectedJobId && jobs.length > 0) {
                    selectJob(jobs[0].id)
                  }
                }}
                className={`flex items-center justify-between h-[42px] px-3.5 rounded-[13px] transition-all duration-150 group text-left cursor-pointer outline-none w-full ${
                  isActive
                    ? "bg-primary-light text-primary font-semibold"
                    : "text-txt-body hover:bg-bg-hover hover:text-txt-heading font-medium"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive
                        ? "text-primary"
                        : "text-txt-caption group-hover:text-txt-heading"
                    }`}
                  />
                  <span className="text-[13.5px]">{item.label}</span>
                </div>

                {item.badge != null && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ─── Your Jobs ─── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-3.5">
            <span className="text-[10.5px] font-bold tracking-widest text-txt-caption uppercase">
              Your Jobs
            </span>
            <button
              onClick={() => toast("Coming soon", "Job creation via the sidebar will be available in the next release.", "info")}
              className="text-txt-caption hover:text-txt-heading hover:bg-bg-hover p-1 rounded-full transition-colors cursor-pointer outline-none"
              title="Create new job"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {jobs.map((job) => {
              const isJobActive = selectedJobId === job.id && activeView === "Applications"
              const dotColor = dotColorClasses[job.color] ?? "bg-[#6C63FF]"

              return (
                <button
                  key={job.id}
                  id={`job-${job.id}`}
                  onClick={() => {
                    selectJob(job.id)
                    setActiveView("Applications")
                  }}
                  title={job.title}
                  className={`flex items-center gap-2.5 h-[38px] px-3.5 rounded-[13px] transition-all duration-150 text-left cursor-pointer outline-none w-full ${
                    isJobActive
                      ? "bg-primary-light text-primary font-semibold"
                      : "text-txt-body hover:bg-bg-hover hover:text-txt-heading font-medium"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                  <span className="text-[13px] truncate">{job.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Preview Job Board ─── */}
      <button
        onClick={() => setActiveView("Careers")}
        className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-[13px] border border-dashed border-bg-border hover:border-primary/40 hover:bg-primary-light/20 transition-all cursor-pointer group mb-1"
      >
        <span className="text-[12.5px] font-semibold text-txt-body group-hover:text-primary transition-colors">
          Preview Job Board
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-txt-caption group-hover:text-primary transition-colors" />
      </button>

      {/* ─── Upgrade card ─── */}
      <div className="bg-bg-secondary border border-bg-border/60 rounded-[20px] p-4 shadow-card flex flex-col gap-3 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors pointer-events-none" />
        <div className="flex flex-col gap-1 relative">
          <div className="flex items-center gap-1.5 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Upgrade to Pro</span>
          </div>
          <p className="text-[11.5px] text-txt-body leading-relaxed font-medium">
            Unlock unlimited roles, advanced analytics, and AI-assisted screening.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="w-full font-bold rounded-button text-[12px] cursor-pointer shadow-button"
          onClick={() => toast("Upgrade", "Redirecting to billing…", "info")}
        >
          Upgrade Now
        </Button>
      </div>
    </div>
  )
}
