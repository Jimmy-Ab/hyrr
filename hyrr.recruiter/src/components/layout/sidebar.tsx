import {
  BarChart2,
  BriefcaseBusiness,
  Calendar,
  CheckSquare,
  Home,
  MessageSquare,
  Plus,
  Users,
  X,
} from "lucide-react"
import { useEffect, type ElementType } from "react"
import { type RecruiterView } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const dotColorClasses: Record<string, string> = {
  purple: "bg-primary",
  blue: "bg-sec-blue",
  green: "bg-sec-green",
  orange: "bg-sec-orange",
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const {
    jobs,
    selectedJobId,
    selectJob,
    activeView,
    setActiveView,
    unreadMessageCount,
    setAddJobOpen,
  } = useJobStore()

  const navItems: { id: RecruiterView; label: string; icon: ElementType; badge?: number }[] = [
    { id: "Dashboard", label: "Dashboard", icon: Home },
    { id: "Jobs", label: "Jobs", icon: BriefcaseBusiness },
    { id: "Candidates", label: "Candidates", icon: Users },
    { id: "Applications", label: "Applications", icon: CheckSquare },
    { id: "Calendar", label: "Calendar", icon: Calendar },
    {
      id: "Messages",
      label: "Messages",
      icon: MessageSquare,
      badge: unreadMessageCount > 0 ? unreadMessageCount : undefined,
    },
    { id: "Analytics", label: "Analytics", icon: BarChart2 },
  ]

  // Escape closes the mobile drawer
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] shrink-0 bg-bg-sidebar border-r border-bg-border/60 flex flex-col p-5 gap-5 overflow-y-auto select-none transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:max-w-none ${
          open ? "translate-x-0 shadow-floating" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between lg:hidden">
          <span className="text-[15px] font-bold text-txt-title">HYRR</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="p-1.5 rounded-full text-txt-caption hover:text-txt-heading hover:bg-bg-hover cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Top nav ─── */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id

            return (
              <button
                key={item.id}
                id={`nav-${item.id.toLowerCase()}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setActiveView(item.id)
                  // The Applications entry opens the board for all jobs; a specific job is
                  // picked from the job list below or the board's job filter.
                  if (item.id === "Applications") selectJob("")
                  onClose()
                }}
                className={`flex items-center justify-between h-[40px] px-3.5 rounded-xl transition-colors duration-150 group text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30 w-full ${
                  isActive
                    ? "bg-primary-light text-primary font-semibold"
                    : "text-txt-body hover:bg-bg-hover hover:text-txt-heading font-medium"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? "text-primary" : "text-txt-caption group-hover:text-txt-heading"
                    }`}
                  />
                  <span className="text-[13.5px]">{item.label}</span>
                </div>

                {item.badge != null && (
                  <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
                    <span className="sr-only">Unread: </span>
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
              type="button"
              onClick={() => {
                setAddJobOpen(true)
                onClose()
              }}
              className="text-txt-caption hover:text-txt-heading hover:bg-bg-hover p-1 rounded-full transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Create new job"
              title="Create new job"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {jobs.map((job) => {
              const isJobActive = selectedJobId === job.id && activeView === "Applications"
              const dotColor = dotColorClasses[job.color] ?? "bg-primary"

              return (
                <button
                  key={job.id}
                  id={`job-${job.id}`}
                  onClick={() => {
                    selectJob(job.id)
                    setActiveView("Applications")
                    onClose()
                  }}
                  title={job.title}
                  className={`flex items-center gap-2.5 h-[36px] px-3.5 rounded-xl transition-colors duration-150 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30 w-full ${
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
            {jobs.length === 0 && (
              <p className="px-3.5 text-[12px] text-txt-caption">No jobs yet.</p>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
