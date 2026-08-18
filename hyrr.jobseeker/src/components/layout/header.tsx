import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useJobStore,
  useToast,
} from "hyrr.shared"
import {
  Bell,
  ChevronDown,
  Command,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react"
import * as React from "react"

export function Header() {
  const {
    theme,
    toggleTheme,
    notifications,
    markNotificationsAsRead,
    markNotificationRead,
    setCandidateActiveView,
    discoverSearch,
    setDiscoverSearch,
    user,
    logout,
  } = useJobStore()
  const { toast } = useToast()
  const [searchFocused, setSearchFocused] = React.useState(false)
  const [notifOpen, setNotifOpen] = React.useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

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
    <div className="relative h-12 border-b border-slate-100 bg-white flex items-center justify-center px-5 select-none shrink-0 animate-in fade-in duration-200">
      {/* Center: Search */}
      <div
        className={`relative w-full max-w-[330px] transition-all ${searchFocused ? "max-w-md" : ""}`}
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
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full h-7 pl-8 pr-12 rounded-md border border-slate-100 bg-slate-50 text-[9px] text-txt-heading placeholder:text-slate-400 focus:outline-none focus:border-primary/30 transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-txt-caption pointer-events-none">
          <Command className="w-3 h-3" />
          <span className="text-[11px] font-semibold">K</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="absolute right-5 flex items-center gap-2">
        {/* Theme */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button className="relative w-8 h-8 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
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
                  onClick={() => {
                    markNotificationsAsRead()
                    toast("Done", "All marked as read", "success")
                  }}
                  className="text-[11px] text-primary font-semibold cursor-pointer hover:underline"
                >
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.slice(0, 5).map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className="flex items-start gap-2 p-3"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.read ? "bg-bg-border" : "bg-primary"}`}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12.5px] leading-snug ${n.read ? "text-txt-body" : "text-txt-heading font-medium"}`}
                  >
                    {n.title}
                  </p>
                  <p className="text-[11px] text-txt-caption mt-0.5">{n.time}</p>
                </div>
              </DropdownMenuItem>
            ))}
            {notifications.length === 0 && (
              <div className="py-6 text-center text-[12.5px] text-txt-caption">
                No notifications yet
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setCandidateActiveView("Notifications")
                setNotifOpen(false)
              }}
              className="text-center text-[12px] text-primary font-semibold"
            >
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-bg-hover px-2.5 py-1.5 rounded-[10px] transition-all cursor-pointer outline-none">
              <img
                src={
                  user?.avatar ||
                  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"
                }
                alt={user?.name || "User Avatar"}
                className="w-7 h-7 rounded-full object-cover border border-bg-border/50"
              />
              <div className="flex flex-col items-start">
                <span className="text-[12.5px] font-semibold text-txt-heading leading-tight">
                  {user?.name || "Job Seeker"}
                </span>
                <span className="text-[10.5px] text-txt-caption">Candidate</span>
              </div>
              <ChevronDown className="w-3 h-3 text-txt-caption ml-0.5" />
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
                logout()
                toast("Signed out", "See you next time!", "success")
              }}
              className="text-sec-red focus:text-sec-red"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
