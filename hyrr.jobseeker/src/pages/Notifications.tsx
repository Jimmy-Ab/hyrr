import { Button, Card, useJobStore, useToast } from "hyrr.shared"
import {
  Archive,
  Bell,
  Briefcase,
  Calendar,
  Check,
  MessageSquare,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"

const notifIcons: Record<string, typeof Bell> = {
  application: Briefcase,
  interview: Calendar,
  message: MessageSquare,
  offer: Star,
  system: Bell,
}

type Filter = "All" | "Unread" | "Applications" | "Interviews" | "Messages"

export function NotificationsPage() {
  const {
    notifications,
    markNotificationsAsRead,
    markNotificationRead,
    clearNotifications,
    fetchNotifications,
  } = useJobStore()
  const { toast } = useToast()
  const [filter, setFilter] = useState<Filter>("All")

  useEffect(() => {
    fetchNotifications()
  }, []) // eslint-disable-line

  const formatted = notifications.map((n) => ({
    ...n,
    type: n.title.toLowerCase().includes("interview")
      ? "interview"
      : n.title.toLowerCase().includes("offer")
        ? "offer"
        : n.title.toLowerCase().includes("message")
          ? "message"
          : "application",
  }))

  const filtered = formatted.filter((n) => {
    if (filter === "Unread") return !n.read
    if (filter === "Applications") return n.type === "application"
    if (filter === "Interviews") return n.type === "interview"
    if (filter === "Messages") return n.type === "message"
    return true
  })

  const unreadCount = formatted.filter((n) => !n.read).length
  const filters: Filter[] = ["All", "Unread", "Applications", "Interviews", "Messages"]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">Notifications</span>
          </h1>
          <p className="text-body text-txt-body mt-1 font-medium">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              markNotificationsAsRead()
              toast("Done", "All marked as read", "success")
            }}
            className="gap-1.5 cursor-pointer text-[12px]"
          >
            <Check className="w-3.5 h-3.5" /> Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearNotifications()
              toast("Cleared", "Notifications cleared", "success")
            }}
            className="gap-1.5 cursor-pointer text-[12px] text-sec-red hover:text-sec-red"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-bg-secondary p-1 border border-bg-border rounded-[14px] w-fit">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-[11px] text-[12.5px] font-semibold cursor-pointer transition-all ${
              filter === f
                ? "bg-primary text-white"
                : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <Card className="divide-y divide-bg-border/30">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <Bell className="w-10 h-10 text-txt-disabled" />
            <p className="text-[14px] font-semibold text-txt-heading">No notifications</p>
            <p className="text-caption text-txt-caption">Nothing here for the selected filter.</p>
          </div>
        ) : (
          filtered.map((n) => {
            const Icon = notifIcons[n.type] ?? Bell
            return (
              <div
                key={n.id}
                className={`flex items-start gap-4 p-4 transition-colors hover:bg-bg-hover/50 ${n.read ? "opacity-70" : ""}`}
              >
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === "offer"
                      ? "bg-sec-green/10 text-sec-green"
                      : n.type === "interview"
                        ? "bg-sec-orange/10 text-sec-orange"
                        : n.type === "message"
                          ? "bg-sec-blue/10 text-sec-blue"
                          : "bg-primary-light text-primary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[13px] leading-snug ${n.read ? "text-txt-body" : "text-txt-heading font-medium"}`}
                  >
                    {n.title}
                  </p>
                  <p className="text-[11.5px] text-txt-caption mt-0.5">{n.time}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                  <button
                    onClick={() => markNotificationRead(n.id)}
                    className="p-1.5 rounded-[8px] hover:bg-bg-hover text-txt-caption hover:text-txt-heading transition-colors cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
