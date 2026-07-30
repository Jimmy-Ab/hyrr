import {
  Bell,
  Briefcase,
  ChevronDown,
  Command,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown"
import { useToast } from "../ui/toast"

/** HYRR custom brand icon — geometric "H" monogram with accent mark */
function HyrrIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="HYRR logo"
    >
      {/* Background pill */}
      <rect width="36" height="36" rx="10" fill="#7C5CFC" />
      {/* Left vertical bar of H */}
      <rect x="8" y="9" width="4" height="18" rx="2" fill="white" />
      {/* Right vertical bar of H */}
      <rect x="24" y="9" width="4" height="18" rx="2" fill="white" />
      {/* Cross bar of H */}
      <rect x="8" y="15.5" width="20" height="4" rx="2" fill="white" />
      {/* Accent dot — top right */}
      <circle cx="28.5" cy="8.5" r="3" fill="#FFB547" />
    </svg>
  )
}

export function Header() {
  const {
    searchQuery,
    setSearchQuery,
    theme,
    toggleTheme,
    notifications,
    markNotificationsAsRead,
    markNotificationRead,
    clearNotifications,
    setActiveView,
    workspaceName,
    setWorkspaceName,
    setAddCandidateOpen,
    setAddJobOpen,
    user,
    logout,
  } = useJobStore()
  const { toast } = useToast()
  const [searchFocused, setSearchFocused] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

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

  return (
    <div className="h-[68px] border-b border-bg-border bg-bg-secondary flex items-center justify-between px-6 select-none shrink-0 animate-in fade-in duration-200">
      {/* ─── Left: Logo + Brand name ─── */}
      <div className="flex items-center gap-3">
        <HyrrIcon size={36} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 font-bold text-txt-title hover:text-primary transition-colors cursor-pointer outline-none text-[15px]">
              <span>{workspaceName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-txt-caption" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                setWorkspaceName("Acme Careers")
                toast("Workspace Switched", "Active: Acme Careers", "success")
              }}
            >
              Acme Careers {workspaceName === "Acme Careers" && "(Active)"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setWorkspaceName("Beta Labs")
                toast("Workspace Switched", "Active: Beta Labs", "success")
              }}
            >
              Beta Labs {workspaceName === "Beta Labs" && "(Active)"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const name = prompt("Enter new workspace name:")
                if (name && name.trim()) {
                  setWorkspaceName(name.trim())
                  toast("Workspace Created", `Switched to ${name.trim()}`, "success")
                }
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 text-txt-body" />
              Add Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ─── Centre: Search ─── */}
      <div
        className={`relative w-[480px] transition-all duration-200 ${searchFocused ? "w-[540px]" : ""}`}
      >
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
        <input
          type="text"
          id="global-search"
          placeholder="Search candidates, jobs, skills…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full h-[44px] pl-10 pr-12 rounded-input border border-transparent bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:bg-bg-secondary focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] bg-bg-secondary border border-bg-border/60 text-txt-caption text-[10px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <Command className="w-2.5 h-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* ─── Right: Actions ─── */}
      <div className="flex items-center gap-4">
        {/* Quick Add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="w-8 h-8 p-0 rounded-full border border-bg-border hover:border-primary/20 shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4 text-txt-heading" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end">
            <DropdownMenuLabel>Quick Add</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setAddCandidateOpen(true, "Applied")}>
              <User className="w-3.5 h-3.5 mr-1.5 text-txt-body" />
              Add Candidate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddJobOpen(true)}>
              <Briefcase className="w-3.5 h-3.5 mr-1.5 text-txt-body" />
              Add Job Listing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Team Avatars Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex -space-x-2 cursor-pointer outline-none hover:opacity-90 transition-opacity">
              {[
                {
                  src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80",
                  alt: "Emily",
                },
                {
                  src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80",
                  alt: "Michael",
                },
                {
                  src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80",
                  alt: "Sarah",
                },
              ].map((av) => (
                <img
                  key={av.alt}
                  src={av.src}
                  alt={av.alt}
                  className="w-8 h-8 rounded-full object-cover border-2 border-bg-secondary"
                />
              ))}
              <div className="w-8 h-8 rounded-full bg-bg-primary border border-bg-border flex items-center justify-center text-[10px] font-bold text-txt-body z-10">
                +2
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end">
            <DropdownMenuLabel>Team Directory</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-60 overflow-y-auto py-1">
              {[
                {
                  name: "Sarah Martinez",
                  role: "Staff HR (You)",
                  status: "Active Now",
                  online: true,
                  img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80",
                },
                {
                  name: "Emily Carter",
                  role: "Senior Developer",
                  status: "Active 5m ago",
                  online: true,
                  img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80",
                },
                {
                  name: "Michael Chen",
                  role: "UI Engineer",
                  status: "Active Now",
                  online: true,
                  img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80",
                },
                {
                  name: "Sarah Johnson",
                  role: "React Developer",
                  status: "Active 1h ago",
                  online: false,
                  img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80",
                },
                {
                  name: "David Kim",
                  role: "Frontend Engineer",
                  status: "Offline",
                  online: false,
                  img: "https://images.unsplash.com/photo-1500000000000?w=80",
                },
              ].map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-3 py-1.5 hover:bg-bg-hover transition-colors rounded-[8px] mx-1"
                >
                  <img
                    src={member.img}
                    alt={member.name}
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-txt-heading truncate">
                      {member.name}
                    </p>
                    <p className="text-[10px] text-txt-caption truncate">{member.role}</p>
                  </div>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${member.online ? "bg-sec-green" : "bg-txt-disabled"}`}
                  />
                </div>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const email = prompt("Enter email to invite:")
                if (email && email.trim())
                  toast("Invitation Sent", `Invite sent to ${email.trim()}`, "success")
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5 text-txt-body" />
              Invite Member
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          className="text-txt-caption hover:text-txt-heading p-1.5 rounded-full hover:bg-bg-hover transition-colors cursor-pointer outline-none"
          title={theme === "light" ? "Switch to dark" : "Switch to light"}
        >
          {theme === "light" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              id="notifications-btn"
              className="text-txt-caption hover:text-txt-heading p-1.5 rounded-full hover:bg-bg-hover transition-colors cursor-pointer relative outline-none"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sec-red ring-2 ring-bg-secondary" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuLabel className="flex justify-between items-center py-1">
              <span>Notifications</span>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    markNotificationsAsRead()
                    toast("Notifications", "All notifications marked as read.", "success")
                  }}
                  className="text-[10px] text-primary hover:underline cursor-pointer font-semibold outline-none bg-transparent border-0 p-0"
                >
                  Mark all read
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearNotifications()
                    toast("Notifications", "Cleared all notifications.", "success")
                  }}
                  className="text-[10px] text-sec-red hover:underline cursor-pointer font-semibold outline-none bg-transparent border-0 p-0"
                >
                  Clear all
                </button>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-60 overflow-y-auto custom-scrollbar-none">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    markNotificationRead(notif.id)
                    toast("Notification Detail", notif.title, "info")
                  }}
                  className={`p-3 text-[12px] border-b border-bg-border/30 last:border-0 hover:bg-bg-hover transition-colors cursor-pointer ${
                    !notif.read ? "bg-primary-light/10 font-semibold" : "font-normal"
                  }`}
                >
                  <p className="text-txt-heading">{notif.title}</p>
                  <span className="text-[11px] text-txt-caption mt-0.5 block">{notif.time}</span>
                </div>
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
            <button id="profile-btn" className="outline-none cursor-pointer">
              <img
                src={
                  user?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.email || "Recruiter")}&background=6C63FF&color=fff`
                }
                alt={user?.name || "User Profile"}
                className="w-8 h-8 rounded-full object-cover border border-bg-border/60 hover:ring-2 hover:ring-primary/20 transition-all"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="end">
            <DropdownMenuLabel>
              <p className="text-txt-heading font-semibold text-[13px] truncate">
                {user?.name || "Recruiter Account"}
              </p>
              <p className="text-txt-caption text-[11px] font-normal truncate">
                {user?.email || workspaceName}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setActiveView("Dashboard")
                toast("Navigate", "Navigating to Overview Dashboard", "info")
              }}
            >
              <User className="w-3.5 h-3.5 mr-2 text-txt-body" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => toast("Settings", "Account settings panel coming soon.", "info")}
            >
              <Settings className="w-3.5 h-3.5 mr-2 text-txt-body" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout()
                toast("Signed Out", "You have been logged out successfully.", "success")
              }}
              className="text-sec-red hover:bg-red-50 focus:text-sec-red cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
