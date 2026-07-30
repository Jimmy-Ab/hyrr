import * as React from "react";
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Command,
  Settings,
  LogOut,
  User,
  ExternalLink,
} from "lucide-react";
import { useJobStore } from "hyrr.shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "hyrr.shared";
import { useToast } from "hyrr.shared";
import { Button } from "hyrr.shared";

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
      <rect width="36" height="36" rx="10" fill="#6C63FF" />
      <rect x="8" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="24" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="8" y="15.5" width="20" height="4" rx="2" fill="white" />
      <circle cx="28.5" cy="8.5" r="3" fill="#FFB547" />
    </svg>
  );
}

export function Header() {
  const {
    theme,
    toggleTheme,
    notifications,
    markNotificationsAsRead,
    markNotificationRead,
    clearNotifications,
    setCandidateActiveView,
    discoverSearch,
    setDiscoverSearch,
    user,
    logout,
  } = useJobStore();
  const { toast } = useToast();
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("seeker-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-[68px] border-b border-bg-border bg-bg-secondary flex items-center justify-between px-6 select-none shrink-0 animate-in fade-in duration-200">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <HyrrIcon size={36} />
        <div className="flex flex-col">
          <span className="font-bold text-[15px] text-txt-title leading-tight">
            HYRR
          </span>
          <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
            Careers
          </span>
        </div>
      </div>

      {/* Center: Search */}
      <div
        className={`relative flex-1 max-w-sm mx-8 transition-all ${searchFocused ? "max-w-md" : ""}`}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
        <input
          id="seeker-search"
          type="text"
          value={discoverSearch}
          onChange={(event) => setDiscoverSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setCandidateActiveView("Discover");
          }}
          placeholder="Search jobs, companies, skills…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full h-9 pl-9 pr-14 rounded-[11px] border border-bg-border bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-txt-caption pointer-events-none">
          <Command className="w-3 h-3" />
          <span className="text-[11px] font-semibold">K</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Theme */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
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
                    markNotificationsAsRead();
                    toast("Done", "All marked as read", "success");
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
                  <p className="text-[11px] text-txt-caption mt-0.5">
                    {n.time}
                  </p>
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
                setCandidateActiveView("Notifications");
                setNotifOpen(false);
              }}
              className="text-center text-[12px] text-primary font-semibold"
            >
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Recruiter switch */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.open(import.meta.env.VITE_RECRUITER_APP_URL || "http://localhost:5173", "_blank", "noopener,noreferrer")}
          className="h-8 px-3 rounded-[10px] text-[12px] gap-1.5 cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Recruiter
        </Button>

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
                <span className="text-[10.5px] text-txt-caption">
                  Candidate
                </span>
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
            <DropdownMenuItem
              onClick={() => setCandidateActiveView("Settings")}
            >
              <Settings className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                toast("Signed out", "See you next time!", "success");
              }}
              className="text-sec-red focus:text-sec-red"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
