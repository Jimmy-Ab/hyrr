import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  errorMessage,
  useJobStore,
  useToast,
} from "hyrr.shared"
import { LogOut, Menu, Moon, ShieldCheck, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { queryClient } from "../../lib/api"
import { Avatar } from "../ui/common"

export function HyrrIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="#6C63FF" />
      <rect x="8" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="24" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="8" y="15.5" width="20" height="4" rx="2" fill="white" />
      <circle cx="28.5" cy="8.5" r="3" fill="#FFB547" />
    </svg>
  )
}

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

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useJobStore((s) => s.user)
  const theme = useJobStore((s) => s.theme)
  const setTheme = useJobStore((s) => s.setTheme)
  const logout = useJobStore((s) => s.logout)
  const { toast } = useToast()
  const prefersDark = usePrefersDark()
  const isDark = theme === "dark" || (theme === "system" && prefersDark)

  const toggleTheme = async () => {
    try {
      await setTheme(isDark ? "light" : "dark")
    } catch (err: any) {
      toast("Could not save theme", errorMessage(err), "error")
    }
  }

  const signOut = async () => {
    queryClient.clear()
    await logout()
  }

  const name = user?.name || user?.email || "Admin"

  return (
    <header className="glass relative z-30 flex h-[64px] shrink-0 select-none items-center justify-between gap-3 border-b border-bg-border/70 px-4 md:px-6">
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation"
            className="cursor-pointer rounded-full p-1.5 text-txt-caption hover:bg-bg-hover hover:text-txt-heading lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <HyrrIcon size={30} />
        <span className="text-[15px] font-bold text-txt-title">HYRR</span>
        <span className="tone-violet rounded-full bg-[var(--tone-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tone-fg)] ring-1 ring-[var(--tone-ring)]">
          Admin
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          id="theme-toggle"
          onClick={toggleTheme}
          className="cursor-pointer rounded-full p-1.5 text-txt-caption transition-colors hover:bg-bg-hover hover:text-txt-heading"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Avatar name={name} src={user?.avatar} size={30} />
              <span className="hidden max-w-[160px] truncate text-[13px] font-semibold text-txt-heading sm:inline">
                {name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end">
            <DropdownMenuLabel>
              <span className="block truncate text-[13px] text-txt-heading">{name}</span>
              <span className="block truncate text-[12px] font-normal text-txt-caption">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            {user?.twoFactorEnabled && (
              <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[12px] text-txt-body">
                <ShieldCheck className="tone-emerald h-3.5 w-3.5 text-[var(--tone-fg)]" />
                Two-factor on
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={toggleTheme}>
              {isDark ? (
                <Sun className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Moon className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isDark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
