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
  SEEKER_VIEW,
  useJobStore,
  useToast,
} from "hyrr.shared"
import {
  Bell,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react"
import * as React from "react"

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const {
    theme,
    setTheme,
    notifications,
    markNotificationsAsRead,
    markNotificationRead,
    setCandidateActiveView,
    openConversation,
    discoverSearch,
    setDiscoverSearch,
    user,
    logout,
  } = useJobStore()
  const { toast } = useToast()
  const [searchFocused, setSearchFocused] = React.useState(false)
  const [notifOpen, setNotifOpen] = React.useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)

  const handleThemeToggle = async () => {
    try {
      await setTheme(isDark ? "light" : "dark")
    } catch (err) {
      toast("Theme not saved", err instanceof Error ? err.message : "Please try again", "error")
    }
  }

  const handleMarkAll = async () => {
    try {
      await markNotificationsAsRead()
      toast("Done", "All marked as read", "success")
    } catch (err) {
      toast("Couldn't update", err instanceof Error ? err.message : "Please try again", "error")
    }
  }

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        document.getElementById("seeker-search")?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <header className={APP_HEADER_CLASS}>
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="seeker-sidebar"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-txt-caption hover:bg-bg-hover hover:text-txt-heading lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      <BrandMark app="Careers" tone="violet" className="mr-2" />
      {/* Center: Search */}
      <div
        className={`relative min-w-0 flex-1 lg:mx-auto lg:flex-none lg:w-full max-w-[330px] transition-all ${searchFocused ? "lg:max-w-md" : ""}`}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
        <input
          id="seeker-search"
          type="text"
          value={discoverSearch}
          onChange={(event) => setDiscoverSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setCandidateActiveView("Discover")
          }}
          placeholder="Search jobs, companies, skills…"
          aria-label="Search jobs"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full h-8 pl-8 pr-12 rounded-md border border-bg-border bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-txt-caption pointer-events-none">
          <Command className="w-3 h-3" />
          <span className="text-[12px] font-semibold">K</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:absolute lg:right-5">
        {/* Theme */}
        <button
          type="button"
          onClick={handleThemeToggle}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="w-8 h-8 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-[12px] text-primary font-semibold cursor-pointer hover:underline"
                >
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.slice(0, 5).map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => {
                  markNotificationRead(n.id).catch(() => {})
                  const conversationId = notificationConversationId(n)
                  if (conversationId) {
                    setCandidateActiveView(SEEKER_VIEW.MESSAGES)
                    openConversation(conversationId).catch(() => {})
                  } else if (n.actionView) setCandidateActiveView(n.actionView)
                }}
                className="flex items-start gap-2 p-3"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.read ? "bg-bg-border" : "bg-primary"}`}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[13.5px] leading-snug ${n.read ? "text-txt-body" : "text-txt-heading font-medium"}`}
                  >
                    {n.title}
                  </p>
                  <p className="text-[12px] text-txt-caption mt-0.5">{n.time}</p>
                </div>
              </DropdownMenuItem>
            ))}
            {notifications.length === 0 && (
              <div className="py-6 text-center text-[13.5px] text-txt-caption">
                No notifications yet
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setCandidateActiveView("Notifications")
                setNotifOpen(false)
              }}
              className="text-center text-[13px] text-primary font-semibold"
            >
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex items-center gap-2 hover:bg-bg-hover px-1.5 sm:px-2.5 py-1.5 rounded-[10px] transition-all cursor-pointer outline-none"
            >
              <img
                src={
                  user?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}`
                }
                alt={user?.name || "User Avatar"}
                className="w-7 h-7 rounded-full object-cover border border-bg-border/50"
              />
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[13.5px] font-semibold text-txt-heading leading-tight">
                  {user?.name || "Job Seeker"}
                </span>
                <span className="text-[11.5px] text-txt-caption">Candidate</span>
              </div>
              <ChevronDown className="hidden sm:block w-3 h-3 text-txt-caption ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCandidateActiveView("Profile")}>
              <User className="w-4 h-4 mr-2" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCandidateActiveView("Settings")}>
              <Settings className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void logout()
                toast("Signed out", "See you next time!", "success")
              }}
              className="text-sec-red focus:text-sec-red"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
