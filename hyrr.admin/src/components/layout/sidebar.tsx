import { type ElementType } from "react"
import {
  Home, Users, UserCheck, Building2, Briefcase, FileText,
  Flag, BarChart2, Zap, CreditCard, Bell, ScrollText,
  Bot, Settings, ChevronsLeft, Activity, ChevronRight, MoreVertical
} from "lucide-react"
import { useAdminStore, type AdminView } from "../../store/useAdminStore"
import { Button } from "hyrr.shared"

interface NavItem {
  id: AdminView
  label: string
  icon: ElementType
}

const navItems: NavItem[] = [
  { id: "Dashboard",     label: "Dashboard",         icon: Home },
  { id: "Users",         label: "Users",             icon: Users },
  { id: "Recruiters",    label: "Recruiters",        icon: UserCheck },
  { id: "Companies",     label: "Companies",         icon: Building2 },
  { id: "Jobs",          label: "Jobs",              icon: Briefcase },
  { id: "Applications",  label: "Applications",      icon: FileText },
  { id: "Reports",       label: "Reports",           icon: Flag },
  { id: "Analytics",     label: "Analytics",         icon: BarChart2 },
  { id: "Momentum",      label: "Momentum",          icon: Zap },
  { id: "Payments",      label: "Payments",          icon: CreditCard },
  { id: "Notifications", label: "Notifications",     icon: Bell },
  { id: "AuditLogs",     label: "Audit Logs",        icon: ScrollText },
  { id: "AI",            label: "AI Management",     icon: Bot },
  { id: "Settings",      label: "Platform Settings", icon: Settings },
]

export function AdminSidebar() {
  const { activeView, setActiveView } = useAdminStore()

  return (
    <div className="w-[260px] shrink-0 bg-bg-sidebar border-r border-bg-border/60 flex flex-col h-[calc(100vh-68px)] justify-between select-none overflow-y-auto">
      {/* Navigation List */}
      <div className="flex flex-col gap-0.5 p-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex items-center justify-between w-full h-[38px] px-3.5 rounded-[13px] transition-all duration-150 cursor-pointer outline-none group text-left ${
                isActive
                  ? "bg-primary-light text-primary font-semibold"
                  : "text-txt-body hover:bg-bg-hover hover:text-txt-heading font-medium"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-[17px] h-[17px] shrink-0 ${isActive ? "text-primary" : "text-txt-caption group-hover:text-txt-heading"}`} />
                <span className="text-[13px]">{item.label}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer Widget Area */}
      <div className="p-4 space-y-4 border-t border-bg-border/30">
        {/* Platform Health Widget */}
        <div className="bg-bg-secondary border border-bg-border/60 rounded-[20px] p-4 flex flex-col gap-3 relative overflow-hidden group">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-txt-caption uppercase tracking-wider">Platform Health</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sec-green animate-pulse" />
              <span className="text-[12.5px] font-bold text-txt-heading">Healthy</span>
            </div>
            <span className="text-[11px] text-txt-caption">All systems operational</span>
          </div>

          {/* Mini Sparkline Chart */}
          <div className="h-6 flex items-end gap-0.5 overflow-hidden w-full opacity-60">
            {[40, 50, 45, 60, 55, 70, 65, 80, 75, 90, 85, 95].map((val, idx) => (
              <div
                key={idx}
                className="bg-sec-green/40 hover:bg-sec-green transition-colors rounded-t-[1px] flex-1"
                style={{ height: `${val}%` }}
              />
            ))}
          </div>

          <button
            onClick={() => setActiveView("Dashboard")}
            className="flex items-center justify-between w-full text-[11px] font-bold text-primary hover:text-primary-hover transition-colors outline-none cursor-pointer border border-bg-border rounded-[10px] py-1.5 px-3 bg-bg-primary hover:bg-bg-hover"
          >
            <span>View System Status</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Profile Footer */}
        <div className="flex items-center justify-between p-1 bg-bg-secondary/40 rounded-[14px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"
              alt="Admin"
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-bg-border"
            />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-txt-heading truncate">Admin User</p>
              <p className="text-[10px] text-txt-caption truncate">Super Administrator</p>
            </div>
          </div>
          <button className="p-1 rounded-lg text-txt-caption hover:text-txt-heading hover:bg-bg-hover cursor-pointer transition-colors outline-none">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
