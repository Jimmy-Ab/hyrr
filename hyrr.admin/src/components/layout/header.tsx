import * as React from "react"
import { useState, useEffect } from "react"
import {
  Search, Bell, Sun, Moon, Command, HelpCircle, ChevronsLeft
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "hyrr.shared"
import { useAdminStore } from "../../store/useAdminStore"
import { useToast } from "hyrr.shared"

function HyrrIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="10" fill="#6C63FF" />
      <rect x="8" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="24" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="8" y="15.5" width="20" height="4" rx="2" fill="white" />
      <circle cx="28.5" cy="8.5" r="3" fill="#FFB547" />
    </svg>
  )
}

export function AdminHeader() {
  const { theme, toggleTheme, notifications, markAllRead } = useAdminStore()
  const { toast } = useToast()
  const [searchFocused, setSearchFocused] = useState(false)
  const [search, setSearch] = useState("")

  const unreadCount = 8 // fixed mock to match screenshot exactly

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        document.getElementById("admin-search")?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className="h-[68px] border-b border-bg-border bg-bg-secondary flex items-center justify-between px-6 select-none shrink-0 animate-in fade-in duration-200">
      {/* Left: Brand logo & Collapse */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <HyrrIcon size={32} />
          <span className="font-extrabold text-[18px] text-txt-title tracking-tight font-sans">HYRR</span>
        </div>
        <button className="p-1 rounded-lg text-txt-caption hover:text-txt-heading hover:bg-bg-hover cursor-pointer transition-colors outline-none">
          <ChevronsLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Search anything input */}
      <div className={`relative transition-all duration-200 ${searchFocused ? "w-[540px]" : "w-[440px]"}`}>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
        <input
          id="admin-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search anything..."
          className="w-full h-[40px] pl-10 pr-12 rounded-input border border-transparent bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:bg-bg-secondary focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-[5px] bg-bg-secondary border border-bg-border/60 text-txt-caption text-[10px] font-bold">
          <span className="text-[10px] font-medium opacity-70">⌘</span>K
        </div>
      </div>

      {/* Right side options */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer">
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-bg-secondary px-0.5">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <button onClick={() => { markAllRead(); toast("Done", "All marked read", "success") }} className="text-[10px] text-primary font-semibold cursor-pointer hover:underline">Mark all read</button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.slice(0, 5).map((n) => (
              <DropdownMenuItem key={n.id} className="flex items-start gap-2 p-3">
                <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.read ? "bg-bg-border" : "bg-sec-red"}`} />
                <div>
                  <p className="text-[12.5px] text-txt-heading font-medium leading-snug">{n.title}</p>
                  <p className="text-[11px] text-txt-caption mt-0.5">{n.time}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help */}
        <button onClick={() => toast("Help", "Documentation opening...", "info")} className="w-9 h-9 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer">
          <HelpCircle className="w-4.5 h-4.5" />
        </button>

        {/* Dark/Light mode theme */}
        <button onClick={toggleTheme} className="w-9 h-9 rounded-full flex items-center justify-center text-txt-caption hover:text-txt-heading hover:bg-bg-hover transition-all cursor-pointer">
          {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-bg-border/60 mx-1" />

        {/* User profile avatar */}
        <img
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"
          alt="Admin Profile"
          className="w-8 h-8 rounded-full object-cover border border-bg-border/60 cursor-pointer"
        />
      </div>
    </div>
  )
}
