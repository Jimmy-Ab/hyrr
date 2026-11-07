import { ActiveIndicator } from "hyrr.shared"
import {
  BarChart3,
  Building2,
  LayoutDashboard,
  ScrollText,
  Settings2,
  ShieldAlert,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { useEffect } from "react"
import { useAdminQuery } from "../../lib/api"
import { useNav, type AdminView } from "../../lib/nav"
import type { Dashboard } from "../../lib/types"

const NAV: { id: AdminView; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "moderation", label: "Moderation", icon: ShieldAlert },
  { id: "users", label: "Users", icon: Users },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "money", label: "Money", icon: Wallet },
  { id: "settings", label: "AI & settings", icon: Settings2 },
  { id: "audit", label: "Audit log", icon: ScrollText },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const view = useNav((s) => s.view)
  const go = useNav((s) => s.go)
  // Shares the dashboard's cached "today" query for the moderation badge.
  const { data } = useAdminQuery<Dashboard>("/dashboard", { period: "today" })
  const queue = data ? data.attention.flaggedJobs + data.attention.pendingReports : 0

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
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] max-w-[85vw] shrink-0 select-none flex-col gap-5 overflow-y-auto border-r border-bg-border/60 bg-bg-sidebar p-5 transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 ${
          open ? "translate-x-0 shadow-floating" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between lg:hidden">
          <span className="text-[15px] font-bold text-txt-title">HYRR Admin</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="cursor-pointer rounded-full p-1.5 text-txt-caption hover:bg-bg-hover hover:text-txt-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            const badge = item.id === "moderation" && queue > 0 ? queue : null
            return (
              <button
                key={item.id}
                type="button"
                id={`nav-${item.id}`}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  go(item.id)
                  onClose()
                }}
                className={`press group relative isolate flex h-[40px] w-full cursor-pointer items-center justify-between rounded-xl px-3.5 text-left outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-primary/25 ${
                  active
                    ? "font-semibold text-primary"
                    : "font-medium text-txt-body hover:bg-bg-hover/70 hover:text-txt-heading"
                }`}
              >
                {active && <ActiveIndicator layoutId="admin-nav-active" />}
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-[color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 ${
                      active ? "text-primary" : "text-txt-caption group-hover:text-txt-heading"
                    }`}
                  />
                  <span className="text-[13.5px]">{item.label}</span>
                </span>
                {badge != null && (
                  <span className="tone-amber flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[var(--tone-bg)] px-1.5 text-[11px] font-bold text-[var(--tone-fg)] ring-1 ring-[var(--tone-ring)]">
                    <span className="sr-only">Items to review: </span>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <p className="mt-auto px-3.5 text-[11px] leading-relaxed text-txt-caption">
          Every action here is recorded in the audit log.
        </p>
      </aside>
    </>
  )
}
