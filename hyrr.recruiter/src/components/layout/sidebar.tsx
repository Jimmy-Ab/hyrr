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
    unreadMessageCount,
  } = useJobStore()
  const { toast } = useToast()

  type ViewId = typeof activeView

  const navItems: { id: ViewId; label: string; icon: ElementType; badge?: number }[] = [
    { id: "Dashboard",    label: "Dashboard",    icon: Home },
    { id: "Jobs",         label: "Jobs",         icon: BriefcaseBusiness },
    { id: "Candidates",  label: "Candidates",   icon: Users },
    { id: "Applications", label: "Applications", icon: CheckSquare },
    { id: "Calendar",    label: "Calendar",     icon: Calendar },
    { id: "Messages",    label: "Messages",     icon: MessageSquare, badge: unreadMessageCount > 0 ? unreadMessageCount : undefined },
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
                className={`flex items-center justify-between h-[40px] px-3.5 rounded-xl transition-colors duration-150 group text-left cursor-pointer outline-none w-full ${
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
                  <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
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
            <span className="text-[11px] font-bold tracking-wider text-txt-caption uppercase">
              YOUR JOBS
            </span>
            <button
              onClick={() => toast("Coming soon", "Job creation via the sidebar will be available in the next release.", "info")}
              className="text-txt-caption hover:text-txt-heading hover:bg-bg-hover p-1 rounded-full transition-colors cursor-pointer outline-none"
              title="Create new job"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {jobs.map((job) => {
              const isJobActive = selectedJobId === job.id && activeView === "Applications"
              const dotColor = dotColorClasses[job.color] ?? "bg-[#7C5CFC]"

              return (
                <button
                  key={job.id}
                  id={`job-${job.id}`}
                  onClick={() => {
                    selectJob(job.id)
                    setActiveView("Applications")
                  }}
                  title={job.title}
                  className={`flex items-center gap-2.5 h-[36px] px-3.5 rounded-xl transition-colors duration-150 text-left cursor-pointer outline-none w-full ${
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

      {/* ─── Upgrade card ─── */}
      <div className="bg-white border border-bg-border/80 rounded-2xl p-4 flex flex-col gap-3 relative shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-[13px] font-bold text-txt-title">Upgrade to Pro</span>
          </div>
          <p className="text-[12px] text-txt-caption leading-snug">
            Unlock unlimited jobs, premium features, and advanced analytics.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="w-full font-semibold rounded-xl text-[13px] cursor-pointer bg-primary-light hover:bg-primary-border/60 text-primary border-0 shadow-none py-2"
          onClick={() => toast("Upgrade", "Redirecting to billing…", "info")}
        >
          Upgrade Now
        </Button>
      </div>
    </div>
  )
}
