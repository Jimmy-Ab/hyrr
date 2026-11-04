import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  notificationConversationId,
  useToast,
  VerifiedBadge,
  type TeamMember,
} from "hyrr.shared"
import {
  Bell,
  Briefcase,
  Command,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  User,
  Users,
} from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import {
  avatarFallback,
  errorMessage,
  isRecruiterView,
  useCompanyVerified,
} from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { ConfirmDialog } from "./confirm-dialog"

/** HYRR custom brand icon — geometric "H" monogram with accent mark */
function HyrrIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="10" fill="#7C5CFC" />
      <rect x="8" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="24" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="8" y="15.5" width="20" height="4" rx="2" fill="white" />
      <circle cx="28.5" cy="8.5" r="3" fill="#FFB547" />
    </svg>
  )
}

type InviteRole = "RECRUITER" | "HIRING_MANAGER" | "VIEWER"

const ROLE_LABEL: Record<TeamMember["role"], string> = {
  OWNER: "Owner",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  VIEWER: "Viewer",
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

function TeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { team, fetchTeam, addTeamMember, removeTeamMember, user, workspaceName } = useJobStore()
  const companyVerified = useCompanyVerified()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InviteRole>("RECRUITER")
  const [inviting, setInviting] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      await fetchTeam()
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load your team."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = team.some((m) => m.userId === user?.id && m.role === "OWNER")

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast("Invalid email", "Enter a valid email address.", "error")
      return
    }
    setInviting(true)
    try {
      await addTeamMember(trimmed, role)
      toast("Member added", `${trimmed} joined your team as ${ROLE_LABEL[role]}.`, "success")
      setEmail("")
    } catch (err) {
      toast("Could not add member", errorMessage(err), "error")
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async () => {
    if (!pendingRemove) return
    try {
      await removeTeamMember(pendingRemove.id)
      toast(
        "Member removed",
        `${pendingRemove.name || pendingRemove.email} was removed.`,
        "success"
      )
    } catch (err) {
      toast("Could not remove member", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Team</DialogTitle>
            <DialogDescription>
              People with access to{" "}
              {workspaceName ? (
                <span className="inline-flex items-center gap-1 font-semibold text-txt-heading">
                  {workspaceName}
                  {companyVerified && <VerifiedBadge />}
                </span>
              ) : (
                "your company workspace"
              )}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-72 overflow-y-auto flex flex-col gap-1">
            {loading && team.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : loadError ? (
              <div role="alert" className="flex flex-col items-center gap-2 py-6 text-center">
                <p className="text-[13px] text-sec-red">{loadError}</p>
                <Button size="sm" variant="secondary" onClick={load}>
                  Retry
                </Button>
              </div>
            ) : team.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-txt-caption">No team members yet.</p>
            ) : (
              team.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-[12px] hover:bg-bg-hover"
                >
                  <img
                    src={member.avatar || avatarFallback(member.name || member.email)}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-txt-heading truncate">
                      {member.name || member.email}
                      {member.userId === user?.id && (
                        <span className="text-txt-caption font-normal"> (you)</span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-txt-caption truncate">
                      {member.email} · {ROLE_LABEL[member.role]}
                    </p>
                  </div>
                  {isOwner && member.userId !== user?.id && (
                    <button
                      type="button"
                      onClick={() => setPendingRemove(member)}
                      aria-label={`Remove ${member.name || member.email}`}
                      className="p-1.5 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {isOwner && (
            <form
              onSubmit={handleInvite}
              className="mt-4 pt-4 border-t border-bg-border/40 flex flex-col gap-3"
            >
              <p className="text-[12px] font-semibold text-txt-heading uppercase tracking-wider">
                Add a member
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label htmlFor="team-invite-email" className="sr-only">
                    Email
                  </label>
                  <Input
                    id="team-invite-email"
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <label htmlFor="team-invite-role" className="sr-only">
                  Role
                </label>
                <select
                  id="team-invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InviteRole)}
                  className="h-11 px-3 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading cursor-pointer"
                >
                  <option value="RECRUITER">Recruiter</option>
                  <option value="HIRING_MANAGER">Hiring Manager</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <Button type="submit" disabled={inviting} className="gap-1.5">
                  {inviting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </Button>
              </div>
              <p className="text-[11.5px] text-txt-caption">
                The person must already have a HYRR recruiter account that isn't part of another
                company.
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(o) => !o && setPendingRemove(null)}
        title="Remove team member?"
        description={`${pendingRemove?.name || pendingRemove?.email || "This member"} will lose access to your company's jobs and candidates.`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />
    </>
  )
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
  } = useJobStore()
  const companyVerified = useCompanyVerified()
  const { toast } = useToast()
  const [teamOpen, setTeamOpen] = useState(false)
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
    <header className="h-[68px] border-b border-bg-border bg-bg-secondary flex items-center justify-between gap-3 px-4 md:px-6 select-none shrink-0">
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
        <HyrrIcon size={32} />
        <span className="hidden sm:inline font-bold text-txt-title text-[15px]">HYRR</span>
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
          className="text-txt-caption hover:text-txt-heading p-1.5 rounded-full hover:bg-bg-hover transition-colors cursor-pointer"
        >
          <Users className="w-[18px] h-[18px]" />
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
