import { APPLICATION_STATUS, useJobStore } from "hyrr.shared"
import {
  Bell,
  Calendar,
  Compass,
  FileText,
  Home,
  LayoutList,
  MessageSquare,
  Settings,
  User,
  X,
} from "lucide-react"
import { type ElementType, useEffect } from "react"

function HyrrMark() {
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-sm font-black text-white">
        H
      </span>
      <span className="leading-none">
        <b className="block text-[15px] text-txt-title">HYRR</b>
        <small className="block text-[9px] font-bold tracking-wide text-primary">CAREERS</small>
      </span>
    </div>
  )
}

interface SidebarProps {
  /** Off-canvas drawer state below the `lg` breakpoint */
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const {
    candidateActiveView,
    setCandidateActiveView,
    notifications,
    jobApplications,
    user,
    seekerProfile,
    unreadMessageCount,
  } = useJobStore()

  const unreadNotifs = notifications.filter((n) => !n.read).length
  const offerCount = jobApplications.filter((a) => a.status === APPLICATION_STATUS.OFFER).length

  type CandidateView = typeof candidateActiveView

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const navItems: { id: CandidateView; label: string; icon: ElementType; badge?: number }[] = [
    { id: "Dashboard", label: "Dashboard", icon: Home },
    { id: "Discover", label: "Discover Jobs", icon: Compass },
    {
      id: "Applications",
      label: "Applications",
      icon: LayoutList,
      badge: offerCount > 0 ? offerCount : undefined,
    },
    {
      id: "Messages",
      label: "Messages",
      icon: MessageSquare,
      badge: unreadMessageCount > 0 ? unreadMessageCount : undefined,
    },
    {
      id: "Notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotifs > 0 ? unreadNotifs : undefined,
    },
    { id: "Calendar", label: "Calendar", icon: Calendar },
    { id: "Documents", label: "Documents", icon: FileText },
    { id: "Profile", label: "Profile", icon: User },
    { id: "Settings", label: "Settings", icon: Settings },
  ]

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        id="seeker-sidebar"
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] transform transition-transform duration-200 lg:static lg:z-auto lg:w-[260px] lg:max-w-none lg:translate-x-0 ${
          open ? "translate-x-0 shadow-floating" : "-translate-x-full"
        } shrink-0 bg-bg-sidebar border-r border-bg-border flex flex-col h-dvh p-3 justify-between select-none overflow-y-auto`}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <HyrrMark />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="grid h-8 w-8 place-items-center rounded-md text-txt-caption hover:bg-bg-hover hover:text-txt-heading lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-2">
            <p className="text-[16px] font-bold tracking-tight text-txt-title">Job Seeker</p>
            <p className="mt-1 text-[11px] text-txt-caption">Career workspace</p>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = candidateActiveView === item.id
              return (
                <button
                  key={item.id}
                  id={`seeker-nav-${item.id.toLowerCase()}`}
                  onClick={() => setCandidateActiveView(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center justify-between h-[40px] px-3.5 rounded-xl transition-colors duration-150 group text-left cursor-pointer outline-none w-full ${
                    isActive
                      ? "bg-primary-light text-primary font-semibold"
                      : "text-txt-body hover:bg-bg-hover hover:text-txt-heading font-medium"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? "text-primary" : "text-txt-caption group-hover:text-txt-heading"}`}
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
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-bg-primary border border-bg-border">
          <img
            src={
              user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}`
            }
            alt={user?.name || "User Avatar"}
            className="w-8 h-8 rounded-full object-cover border border-bg-border/50 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-txt-heading truncate">
              {user?.name || "Job Seeker"}
            </p>
            <p className="text-[11.5px] text-txt-caption truncate">
              {seekerProfile?.title || "Candidate"}
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
