import {
  Button,
  Card,
  ConfirmDialog,
  errorMessage,
  NOTIFICATION_TYPE_LABEL,
  notificationConversationId,
  SEEKER_VIEW,
  useJobStore,
  useToast,
  type NotificationItem,
  type NotificationType,
} from "hyrr.shared"
import { Bell, Briefcase, Calendar, Check, MessageSquare, Search, Star, Trash2 } from "lucide-react"
import { useState } from "react"

const notifIcons: Record<NotificationType, typeof Bell> = {
  APPLICATION: Briefcase,
  INTERVIEW: Calendar,
  MESSAGE: MessageSquare,
  OFFER: Star,
  JOB_ALERT: Search,
  SYSTEM: Bell,
}

const notifColors: Record<NotificationType, string> = {
  APPLICATION: "bg-primary-light text-primary",
  INTERVIEW: "bg-sec-orange/10 text-sec-orange",
  MESSAGE: "bg-sec-blue/10 text-sec-blue",
  OFFER: "bg-sec-green/10 text-sec-green",
  JOB_ALERT: "bg-primary-light text-primary",
  SYSTEM: "bg-bg-primary text-txt-caption",
}

type Filter = "All" | "Unread" | "Applications" | "Interviews" | "Messages"

const filterTypes: Partial<Record<Filter, NotificationType[]>> = {
  Applications: ["APPLICATION", "OFFER", "JOB_ALERT"],
  Interviews: ["INTERVIEW"],
  Messages: ["MESSAGE"],
}

export function NotificationsPage() {
  const {
    notifications,
    markNotificationsAsRead,
    markNotificationRead,
    clearNotifications,
    setCandidateActiveView,
    openConversation,
  } = useJobStore()
  const { toast } = useToast()
  const [filter, setFilter] = useState<Filter>("All")
  const [confirmClear, setConfirmClear] = useState(false)

  const filtered = notifications.filter((n) => {
    if (filter === "Unread") return !n.read
    const types = filterTypes[filter]
    return types ? types.includes(n.type) : true
  })

  const unreadCount = notifications.filter((n) => !n.read).length
  const filters: Filter[] = ["All", "Unread", "Applications", "Interviews", "Messages"]

  const openNotification = (n: NotificationItem) => {
    markNotificationRead(n.id).catch(() => {})
    const conversationId = notificationConversationId(n)
    if (conversationId) {
      setCandidateActiveView(SEEKER_VIEW.MESSAGES)
      openConversation(conversationId).catch(() => {})
    } else if (n.actionView) setCandidateActiveView(n.actionView)
  }

  const handleMarkAll = async () => {
    try {
      await markNotificationsAsRead()
      toast("Done", "All marked as read", "success")
    } catch (err) {
      toast("Couldn't update notifications", errorMessage(err), "error")
    }
  }

  const handleClear = async () => {
    try {
      await clearNotifications()
      toast("Cleared", "Notifications cleared", "success")
    } catch (err) {
      toast("Couldn't clear notifications", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight">
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
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            className="gap-1.5 cursor-pointer text-[13px]"
          >
            <Check className="w-3.5 h-3.5" /> Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClear(true)}
            disabled={notifications.length === 0}
            className="gap-1.5 cursor-pointer text-[13px] text-sec-red hover:text-sec-red"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label="Filter notifications"
        className="flex max-w-full gap-1 overflow-x-auto custom-scrollbar-none bg-bg-secondary p-1 border border-bg-border rounded-[14px] w-fit"
      >
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-4 py-1.5 rounded-[11px] text-[13.5px] font-semibold cursor-pointer transition-all ${
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
              <button
                type="button"
                key={n.id}
                onClick={() => openNotification(n)}
                className={`w-full text-left flex items-start gap-4 p-4 transition-colors hover:bg-bg-hover/50 cursor-pointer ${n.read ? "opacity-70" : ""}`}
              >
                <div
                  className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 ${notifColors[n.type] ?? notifColors.SYSTEM}`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[13px] leading-snug break-words ${n.read ? "text-txt-body" : "text-txt-heading font-medium"}`}
                  >
                    {n.title}
                  </p>
                  <p className="text-[12.5px] text-txt-caption mt-0.5">
                    {NOTIFICATION_TYPE_LABEL[n.type] ?? "Notification"} · {n.time}
                  </p>
                </div>
                {!n.read && (
                  <div
                    className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2"
                    aria-label="Unread"
                  />
                )}
              </button>
            )
          })
        )}
      </Card>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all notifications?"
        description="This permanently deletes all of your notifications."
        confirmLabel="Clear all"
        onConfirm={handleClear}
      />
    </div>
  )
}
