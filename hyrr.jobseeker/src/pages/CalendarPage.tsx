import type { CalendarEvent } from "hyrr.shared"
import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  errorMessage,
  eventTone,
  PageHeader,
  toIsoFromLocal,
  toneClass,
  useJobStore,
  useToast,
} from "hyrr.shared"
import {
  Briefcase,
  Building2,
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
  UserRound,
  Video,
  X,
} from "lucide-react"
import { useState } from "react"
import { PendingInterviewInvites } from "../components/interview-invites"

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

/** Who the event is with: company (and recruiter) for interviews, else nothing. */
const withWhom = (e: CalendarEvent) => [e.companyName, e.organizerName].filter(Boolean).join(" · ")

/** Details of one event (side panel), like the recruiter calendar. */
function EventDetails({
  event,
  onClose,
  onDelete,
}: {
  event: CalendarEvent | null
  onClose: () => void
  onDelete: (e: CalendarEvent) => void
}) {
  const e = event
  const when = e
    ? `${new Date(e.startTime).toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}, ${formatTime(e.startTime)}${e.endTime ? ` – ${formatTime(e.endTime)}` : ""}`
    : ""
  const row = "flex items-start gap-3 text-[13.5px] text-txt-body"
  return (
    <Dialog open={!!e} onOpenChange={(open) => !open && onClose()}>
      <DialogContent variant="sheet" className="max-w-md overflow-y-auto">
        {e && (
          <>
            <DialogHeader>
              <span
                className={`mb-2 inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${typeStyle(e.type)}`}
              >
                {e.type}
              </span>
              <DialogTitle className="break-words">{e.title}</DialogTitle>
              <DialogDescription>{when}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex flex-col gap-3">
              {e.companyName && (
                <p className={row}>
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-txt-caption" />
                  {e.companyName}
                </p>
              )}
              {e.jobTitle && (
                <p className={row}>
                  <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-txt-caption" />
                  {e.jobTitle}
                </p>
              )}
              {e.organizerName && (
                <p className={row}>
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-txt-caption" />
                  With {e.organizerName}
                </p>
              )}
              {e.location && (
                <p className={`${row} break-words`}>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-txt-caption" />
                  {e.location}
                </p>
              )}
              {e.meetingUrl && /^https?:\/\//i.test(e.meetingUrl) && (
                <a
                  href={e.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary/90"
                >
                  <Video className="h-4 w-4" /> Join meeting
                </a>
              )}
              {e.notes && (
                <p className="whitespace-pre-line rounded-xl bg-bg-hover/60 p-3 text-[13px] text-txt-body">
                  {e.notes}
                </p>
              )}
            </div>
            {!e.organizerName && (
              <div className="mt-6">
                <Button variant="ghost" className="text-sec-red" onClick={() => onDelete(e)}>
                  <X className="mr-1.5 h-4 w-4" /> Delete event
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Event colours come from the shared tone map (interview violet, deadline rose, …). */
const typeStyle = (type: string) =>
  `${toneClass(eventTone(type))} bg-[var(--tone-bg)] border-[var(--tone-ring)] text-[var(--tone-fg)]`

function AddEventModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (e: Omit<CalendarEvent, "id">) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("10:00")
  const [type, setType] = useState<CalendarEvent["type"]>("interview")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    try {
      await onAdd({ title: title.trim(), startTime: toIsoFromLocal(date, time), type })
      onClose()
    } catch {
      // Error toast is raised by the caller; keep the form open.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-event-title"
        className="bg-bg-secondary border border-bg-border/60 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-sm max-h-[90dvh] overflow-y-auto p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 id="add-event-title" className="text-[15px] font-bold text-txt-heading">
            Add Calendar Event
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full hover:bg-bg-hover text-txt-caption cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="event-title"
              className="text-[12.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1"
            >
              Title
            </label>
            <input
              id="event-title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Technical Interview · Stripe"
              required
              className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="event-date"
                className="text-[12.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1"
              >
                Date
              </label>
              <input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all"
              />
            </div>
            <div>
              <label
                htmlFor="event-time"
                className="text-[12.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1"
              >
                Time
              </label>
              <input
                id="event-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="event-type"
              className="text-[12.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1"
            >
              Type
            </label>
            <select
              id="event-type"
              value={type}
              onChange={(e) => setType(e.target.value as CalendarEvent["type"])}
              className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all"
            >
              <option value="interview">Interview</option>
              <option value="deadline">Deadline</option>
              <option value="offer">Offer / Onboarding</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="flex-1 cursor-pointer shadow-button"
            >
              {saving ? "Saving…" : "Add Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CandidateCalendar() {
  const { toast } = useToast()
  const { events, eventsLoading, createEvent, deleteEvent } = useJobStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const details = events.find((e) => e.id === detailsId) ?? null

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteEvent(pendingDelete.id)
      toast("Event deleted", `${pendingDelete.title} was removed.`, "success")
    } catch (err) {
      toast("Couldn't delete event", errorMessage(err), "error")
      throw err
    }
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthName = new Date(year, month).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDayOffset = new Date(year, month, 1).getDay()
  const calendarDays = [
    ...Array.from({ length: startDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Map events to day numbers for the current month
  const eventsByDay: Record<number, CalendarEvent[]> = {}
  events.forEach((ev) => {
    const d = new Date(ev.startTime)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push(ev)
    }
  })

  const today = new Date()
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year

  const upcoming = events
    .filter((ev) => new Date(ev.startTime) >= new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 4)

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      {addModalOpen && (
        <AddEventModal
          onClose={() => setAddModalOpen(false)}
          onAdd={async (data) => {
            try {
              await createEvent(data)
              toast("Event added", "Calendar event saved successfully.", "success")
            } catch (err) {
              toast("Couldn't add event", errorMessage(err), "error")
              throw err
            }
          }}
        />
      )}
      <EventDetails
        event={details}
        onClose={() => setDetailsId(null)}
        onDelete={(e) => {
          setDetailsId(null)
          setPendingDelete(e)
        }}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete event?"
        description={`${pendingDelete?.title ?? "This event"} will be removed from your calendar.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      <PageHeader
        icon={CalendarDays}
        tone="violet"
        title="Calendar"
        subtitle="Interviews, deadlines and important dates for your job search."
        actions={
          <Button onClick={() => setAddModalOpen(true)} className="cursor-pointer font-semibold">
            <Plus className="w-4 h-4 mr-2" /> Add Event
          </Button>
        }
      />

      <PendingInterviewInvites />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h2 className="text-[18px] font-bold text-txt-heading">{monthName}</h2>
              {eventsLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setCurrentDate(new Date(year, month - 1))}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-txt-caption" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 h-8 rounded-[8px] text-[12.5px] font-semibold hover:bg-bg-hover transition-colors cursor-pointer text-txt-caption"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setCurrentDate(new Date(year, month + 1))}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-txt-caption" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-[12px] font-bold text-txt-caption uppercase tracking-wider py-2"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />
              const dayEvts = eventsByDay[day] || []
              const isToday = isCurrentMonth && day === today.getDate()
              const dateLabel = new Date(year, month, day).toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })

              return (
                <div
                  key={day}
                  aria-current={isToday ? "date" : undefined}
                  className={`p-1 sm:p-2 rounded-[12px] border flex flex-col min-h-[56px] sm:min-h-[96px] min-w-0 ${
                    isToday
                      ? "border-primary bg-primary-light/35"
                      : dayEvts.length
                        ? "border-bg-border/40 bg-bg-primary/20"
                        : "border-bg-border/10 bg-bg-secondary"
                  }`}
                >
                  <span
                    className={`text-[12px] sm:text-[13px] font-bold px-1 ${isToday ? "text-primary" : "text-txt-heading"}`}
                  >
                    {day}
                  </span>

                  {/* Mobile: dots open the first event */}
                  {dayEvts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDetailsId(dayEvts[0].id)}
                      aria-label={`${dateLabel}: ${dayEvts.map((e) => e.title).join(", ")}`}
                      className="flex sm:hidden gap-0.5 mt-1 flex-wrap cursor-pointer"
                    >
                      {dayEvts.slice(0, 3).map((evt) => (
                        <span
                          key={evt.id}
                          className={`w-1.5 h-1.5 rounded-full ${toneClass(eventTone(evt.type))} bg-[var(--tone-fg)]`}
                        />
                      ))}
                    </button>
                  )}

                  {/* sm+: event chips with time, title and company / recruiter */}
                  <div className="hidden sm:flex flex-1 flex-col gap-1 mt-2 min-h-0 justify-end">
                    {dayEvts.slice(0, 2).map((evt) => (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => setDetailsId(evt.id)}
                        aria-label={`${evt.title}, ${dateLabel} ${formatTime(evt.startTime)}${withWhom(evt) ? `, ${withWhom(evt)}` : ""}`}
                        className={`text-left border text-[10px] p-1.5 rounded-[8px] font-bold flex flex-col gap-0.5 leading-tight cursor-pointer hover:shadow-card-hover min-w-0 ${typeStyle(evt.type)}`}
                      >
                        <span className="truncate">{formatTime(evt.startTime)}</span>
                        <span className="truncate font-extrabold">{evt.title}</span>
                        {withWhom(evt) && (
                          <span className="truncate font-semibold opacity-80">{withWhom(evt)}</span>
                        )}
                      </button>
                    ))}
                    {dayEvts.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setDetailsId(dayEvts[2].id)}
                        className="text-[10px] font-semibold text-txt-caption hover:text-primary text-left cursor-pointer"
                      >
                        +{dayEvts.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Upcoming events + legend */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-txt-heading">Upcoming Events</h3>
              <button
                onClick={() => setAddModalOpen(true)}
                className="text-[12px] text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-caption text-txt-caption text-center py-4">No upcoming events</p>
              ) : (
                upcoming.map((e) => {
                  const type = e.type
                  const label = e.title
                  const timeStr = new Date(e.startTime).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })

                  return (
                    <div
                      key={e.id}
                      className={`p-3 rounded-[12px] border ${typeStyle(type)} group relative`}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailsId(e.id)}
                        className="text-left text-[13px] font-semibold pr-6 break-words cursor-pointer hover:underline"
                      >
                        {label}
                      </button>
                      {withWhom(e) && (
                        <p className="mt-0.5 text-[12.5px] font-medium opacity-90 break-words">
                          {withWhom(e)}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] opacity-75">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeStr}</span>
                      </div>
                      {e.location && (
                        <p className="mt-1 text-[12.5px] opacity-75 break-words">{e.location}</p>
                      )}
                      {e.meetingUrl && /^https?:\/\//i.test(e.meetingUrl) && (
                        <a
                          href={e.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-[12.5px] font-semibold underline"
                        >
                          Join meeting
                        </a>
                      )}
                      {!e.organizerName && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(e)}
                          aria-label={`Delete ${label}`}
                          className="absolute top-2 right-2 p-0.5 rounded opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer hover:text-sec-red"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-bold text-txt-heading mb-3">Legend</h3>
            <div className="space-y-2">
              {[
                { type: "interview", label: "Interview" },
                { type: "deadline", label: "Deadline" },
                { type: "offer", label: "Offer / Onboarding" },
                { type: "other", label: "Other" },
              ].map((l) => (
                <div
                  key={l.label}
                  className={`flex items-center gap-2 text-[13.5px] text-txt-body ${toneClass(eventTone(l.type))}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--tone-fg)] shadow-[0_0_8px_var(--tone-glow)]" />
                  {l.label}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
