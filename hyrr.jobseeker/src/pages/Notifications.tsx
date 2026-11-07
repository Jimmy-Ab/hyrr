import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  errorMessage,
  FilterChips,
  IconTile,
  NOTIFICATION_TYPE_LABEL,
  notificationConversationId,
  notificationTone,
  PageHeader,
  SEEKER_VIEW,
  useJobStore,
  useToast,
  type NotificationItem,
  type NotificationType,
  type Tone,
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

type Filter = "All" | "Unread" | "Applications" | "Interviews" | "Messages"
const FILTER_TONE: Record<Filter, Tone> = {
  All: "violet",
  Unread: "rose",
  Applications: "blue",
  Interviews: "violet",
  Messages: "teal",
}

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
      <PageHeader
        icon={Bell}
        tone="amber"
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "All caught up!"
        }
        actions={
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
        }
      />

      {/* Filter tabs */}
      <FilterChips
        id="notifications"
        label="Filter notifications"
        value={filter}
        onChange={setFilter}
        className="w-fit"
        options={filters.map((f) => ({
          value: f,
          label: f,
          count:
            f === "All"
              ? notifications.length
              : f === "Unread"
                ? unreadCount
                : notifications.filter((n) => filterTypes[f]?.includes(n.type)).length,
          tone: FILTER_TONE[f],
        }))}
      />

      {/* Notifications list */}
      <Card className="divide-y divide-bg-border/30">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            tone="amber"
            title="No notifications"
            description="Nothing here for the selected filter."
            className="border-0 bg-transparent"
          />
        ) : (
          filtered.map((n) => {
            const Icon = notifIcons[n.type] ?? Bell
            return (
              <button
                type="button"
                key={n.id}
                onClick={() => openNotification(n)}
                className={`group w-full text-left flex items-start gap-4 p-4 transition-colors hover:bg-bg-hover/50 cursor-pointer ${n.read ? "opacity-70" : ""}`}
              >
                <IconTile
                  icon={Icon}
                  tone={notificationTone(n.type)}
                  size="sm"
                  className="mt-0.5"
                />
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
