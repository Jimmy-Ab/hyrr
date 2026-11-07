import {
  APP_HEADER_CLASS,
  BrandMark,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  notificationConversationId,
  useToast,
  VerifiedBadge,
} from "hyrr.shared"
import {
  Bell,
  Briefcase,
  Command,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
  Users,
  Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import {
  avatarFallback,
  errorMessage,
  isRecruiterView,
  useCompanyVerified,
} from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { TeamDialog } from "../team/team-dialog"

function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  )
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return prefersDark
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const {
    searchQuery,
    setSearchQuery,
    theme,
    setTheme,
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
    clearNotifications,
    setActiveView,
    openConversation,
    setAddCandidateOpen,
    setAddJobOpen,
    user,
    logout,
    workspaceName,
    wallet,
  } = useJobStore()
  const companyVerified = useCompanyVerified()
  const { toast } = useToast()
  const [teamOpen, setTeamOpen] = useState(false)
  const team = useJobStore((s) => s.team)
  const joinRequests = useJobStore((s) => s.joinRequests)
  const fetchJoinRequests = useJobStore((s) => s.fetchJoinRequests)
  const isOwner = team.some((m) => m.userId === user?.id && m.role === "OWNER")
  // Owners see a dot on Team when colleagues ask to join.
  useEffect(() => {
    if (isOwner) void fetchJoinRequests().catch(() => undefined)
  }, [isOwner, fetchJoinRequests])
  const prefersDark = usePrefersDark()

  const unreadCount = notifications.filter((n) => !n.read).length
  const isDark = theme === "dark" || (theme === "system" && prefersDark)

  // Global CMD/CTRL + K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        document.getElementById("global-search")?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const run = async (action: () => Promise<unknown>, success: string | null, failTitle: string) => {
    try {
      await action()
      if (success) toast(success, undefined, "success")
    } catch (err) {
      toast(failTitle, errorMessage(err), "error")
    }
  }

  const toggleTheme = () =>
    run(() => setTheme(isDark ? "light" : "dark"), null, "Could not save theme")

  return (
    <header className={`${APP_HEADER_CLASS} justify-between`}>
      {/* ─── Left: Menu + Logo ─── */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden p-1.5 rounded-full text-txt-caption hover:text-txt-heading hover:bg-bg-hover cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <BrandMark app="Recruiter" tone="blue" />
      </div>

      {/* ─── Centre: Search ─── */}
      <div className="relative hidden md:block flex-1 max-w-[540px]">
        <label htmlFor="global-search" className="sr-only">
          Search
        </label>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
        <input
          type="search"
          id="global-search"
          placeholder="Search candidates, jobs, skills…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-[44px] pl-10 pr-12 rounded-input border border-transparent bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:bg-bg-secondary focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] bg-bg-secondary border border-bg-border/60 text-txt-caption text-[10px] font-bold">
          <Command className="w-2.5 h-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* ─── Right: Actions ─── */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Momentum balance */}
        {wallet && (
          <button
            type="button"
            onClick={() => setActiveView("Momentum")}
            aria-label={`Momentum balance: ${wallet.balance.toLocaleString()} credits. Open Momentum`}
            title="Momentum credits"
            className="flex items-center gap-1.5 h-9 px-3 rounded-full border border-primary-border/40 bg-primary-light text-primary text-[13px] font-semibold hover:bg-primary/15 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            <span className="tabular-nums">{wallet.balance.toLocaleString()}</span>
          </button>
        )}
        {/* Quick Add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Quick add"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-bg-border bg-bg-secondary hover:border-primary/20 hover:bg-bg-hover cursor-pointer"
            >
              <Plus className="w-4 h-4 text-txt-heading" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end">
            <DropdownMenuLabel>Quick Add</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setAddCandidateOpen(true, "Applied")}>
              <User className="w-3.5 h-3.5 mr-1.5 text-txt-body" />
              Add Candidate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAddJobOpen(true)}>
              <Briefcase className="w-3.5 h-3.5 mr-1.5 text-txt-body" />
              Add Job Listing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Team */}
        <button
          type="button"
          onClick={() => setTeamOpen(true)}
          aria-label="Team"
          title="Team"
          className="relative text-txt-caption hover:text-txt-heading p-1.5 rounded-full hover:bg-bg-hover transition-colors cursor-pointer"
        >
          <Users className="w-[18px] h-[18px]" />
          {joinRequests.length > 0 && (
            <span
              className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-sec-orange ring-2 ring-bg-secondary"
              aria-label={`${joinRequests.length} pending join request${joinRequests.length === 1 ? "" : "s"}`}
            />
          )}
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          id="theme-toggle"
          onClick={toggleTheme}
          className="text-txt-caption hover:text-txt-heading p-1.5 rounded-full hover:bg-bg-hover transition-colors cursor-pointer"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              id="notifications-btn"
              aria-label={
                unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
              }
              className="text-txt-caption hover:text-txt-heading p-1.5 rounded-full hover:bg-bg-hover transition-colors cursor-pointer relative"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sec-red ring-2 ring-bg-secondary" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 max-w-[calc(100vw-32px)]" align="end">
            <div className="flex justify-between items-center px-2 py-1.5">
              <span className="text-[13px] font-semibold text-txt-heading">Notifications</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () => markAllNotificationsRead(),
                      "All notifications marked as read",
                      "Could not update notifications"
                    )
                  }
                  className="text-[11px] text-primary hover:underline cursor-pointer font-semibold"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () => clearNotifications(),
                      "Notifications cleared",
                      "Could not clear notifications"
                    )
                  }
                  className="text-[11px] text-sec-red hover:underline cursor-pointer font-semibold"
                >
                  Clear all
                </button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto custom-scrollbar-none">
              {notifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  onSelect={() => {
                    const target = notif.actionView as string | undefined
                    const conversationId = notificationConversationId(notif)
                    if (conversationId) {
                      setActiveView("Messages")
                      openConversation(conversationId).catch(() => {})
                    } else if (isRecruiterView(target)) setActiveView(target)
                    if (!notif.read) {
                      run(
                        () => markNotificationRead(notif.id),
                        null,
                        "Could not update notification"
                      )
                    }
                  }}
                  className={`flex flex-col items-start gap-0.5 p-3 text-[12px] cursor-pointer ${
                    !notif.read ? "bg-primary-light/40 font-semibold" : "font-normal"
                  }`}
                >
                  <span className="text-txt-heading">
                    {!notif.read && <span className="sr-only">Unread: </span>}
                    {notif.title}
                  </span>
                  <span className="text-[11px] text-txt-caption">{notif.time}</span>
                </DropdownMenuItem>
              ))}
              {notifications.length === 0 && (
                <p className="p-4 text-center text-[12px] text-txt-caption">No notifications</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              id="profile-btn"
              aria-label="Account menu"
              className="cursor-pointer rounded-full"
            >
              <img
                src={user?.avatar || avatarFallback(user?.name || user?.email || "Recruiter")}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-bg-border/60 hover:ring-2 hover:ring-primary/20 transition-all"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <p className="text-txt-heading font-semibold text-[13px] truncate">
                {user?.name || "Recruiter Account"}
              </p>
              <p className="text-txt-caption text-[11px] font-normal truncate">{user?.email}</p>
              {workspaceName && (
                <p className="mt-1 flex items-center gap-1 text-txt-body text-[11px] font-medium min-w-0">
                  <span className="truncate">{workspaceName}</span>
                  {companyVerified && <VerifiedBadge />}
                </p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setActiveView("Settings")}>
              <Settings className="w-3.5 h-3.5 mr-2 text-txt-body" />
              Settings
            </DropdownMenuItem>
            {/* Defer so the menu finishes closing before the dialog takes focus */}
            <DropdownMenuItem onSelect={() => setTimeout(() => setTeamOpen(true), 0)}>
              <Users className="w-3.5 h-3.5 mr-2 text-txt-body" />
              Team
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleTheme}>
              {isDark ? (
                <Sun className="w-3.5 h-3.5 mr-2 text-txt-body" />
              ) : (
                <Moon className="w-3.5 h-3.5 mr-2 text-txt-body" />
              )}
              {isDark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                logout()
                toast("Signed Out", "You have been logged out successfully.", "success")
              }}
              className="text-sec-red focus:text-sec-red cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TeamDialog open={teamOpen} onOpenChange={setTeamOpen} />
    </header>
  )
}
