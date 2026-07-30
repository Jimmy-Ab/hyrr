import { type ElementType } from "react"
import {
  Home, Compass, LayoutList, MessageSquare, Bell,
  Calendar, FileText, User, Settings,
} from "lucide-react"
import { useJobStore, APPLICATION_STATUS } from "hyrr.shared"

export function Sidebar() {
  const { candidateActiveView, setCandidateActiveView, notifications, jobApplications, user, seekerProfile, unreadMessageCount } = useJobStore()

  const unreadNotifs = notifications.filter((n) => !n.read).length
  const offerCount = jobApplications.filter((a) => a.status === APPLICATION_STATUS.OFFER).length

  type CandidateView = typeof candidateActiveView

  const navItems: { id: CandidateView; label: string; icon: ElementType; badge?: number }[] = [
    { id: "Dashboard",     label: "Dashboard",      icon: Home },
    { id: "Discover",      label: "Discover Jobs",  icon: Compass },
    { id: "Applications",  label: "Applications",   icon: LayoutList, badge: offerCount > 0 ? offerCount : undefined },
    { id: "Messages",      label: "Messages",       icon: MessageSquare, badge: unreadMessageCount > 0 ? unreadMessageCount : undefined },
    { id: "Notifications", label: "Notifications",  icon: Bell, badge: unreadNotifs > 0 ? unreadNotifs : undefined },
    { id: "Calendar",      label: "Calendar",       icon: Calendar },
    { id: "Documents",     label: "Documents",      icon: FileText },
    { id: "Profile",       label: "Profile",        icon: User },
    { id: "Settings",      label: "Settings",       icon: Settings },
  ]

  return (
    <div className="w-[260px] shrink-0 bg-bg-sidebar border-r border-bg-border/60 flex flex-col h-[calc(100vh-68px)] p-5 justify-between select-none">
      <div className="flex flex-col gap-5">
        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = candidateActiveView === item.id
            return (
              <button
                key={item.id}
                id={`seeker-nav-${item.id.toLowerCase()}`}
                onClick={() => setCandidateActiveView(item.id)}
                className={`flex items-center justify-between h-[40px] px-3.5 rounded-xl transition-colors duration-150 group text-left cursor-pointer outline-none w-full ${
                  isActive
                    ? "bg-primary-light text-primary font-semibold"
                    : "text-txt-body hover:bg-bg-hover hover:text-txt-heading font-medium"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? "text-primary" : "text-txt-caption group-hover:text-txt-heading"}`} />
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

      {/* Bottom: Profile snippet */}
      <div className="flex items-center gap-3 p-3.5 rounded-[13px] bg-bg-primary border border-bg-border/40">
        <img
          src={user?.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"}
          alt={user?.name || "User Avatar"}
          className="w-8 h-8 rounded-full object-cover border border-bg-border/50 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-txt-heading truncate">{user?.name || "Job Seeker"}</p>
          <p className="text-[10.5px] text-txt-caption truncate">{seekerProfile?.title || "Candidate"}</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-sec-green shrink-0" title="Available" />
      </div>
    </div>
  )
}
