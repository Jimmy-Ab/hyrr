import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageHeader,
  date,
  dateTime,
  eventTone,
  toIsoFromLocal,
  toneClass,
  useToast,
  type CalendarEvent,
  type Candidate,
} from "hyrr.shared"
import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { JobFilter } from "../components/jobs/job-filter"
import { ConfirmDialog } from "../components/layout/confirm-dialog"
import { errorMessage } from "../lib/recruiter"
import { useJobStore } from "../store/useJobStore"

/** Event chip colours come from the shared tone map (interview violet, deadline rose, …). */
const typeStyle = (type: string) =>
  `${toneClass(eventTone(type))} bg-[var(--tone-bg)] border-[var(--tone-ring)] text-[var(--tone-fg)]`

const TYPE_LABEL: Record<string, string> = {
  interview: "Interview",
  deadline: "Deadline",
  offer: "Offer / Onboarding",
  other: "Other",
}

const fieldCls =
  "w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-txt-heading text-[13px] focus:outline-none focus:border-primary/30 transition-all font-medium"
const labelCls = "text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1"

const pad = (n: number) => String(n).padStart(2, "0")
const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
const formatDateTime = (iso: string) => dateTime(iso)

function AddEventDialog({
  open,
  onOpenChange,
  candidates,
  preselectedDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: Candidate[]
  preselectedDate?: string
}) {
  const { createEvent } = useJobStore()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [candidateId, setCandidateId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("10:00")
  const [type, setType] = useState<CalendarEvent["type"]>("interview")
  const [meetingUrl, setMeetingUrl] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle("")
      setCandidateId("")
      setDate(preselectedDate || "")
      setTime("10:00")
      setType("interview")
      setMeetingUrl("")
      setLocation("")
      setNotes("")
    }
  }, [open, preselectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date || !time) return
    const candidateName = candidates.find((c) => c.id === candidateId)?.name
    setSaving(true)
    try {
      await createEvent({
        title: candidateName ? `${title.trim()} - ${candidateName}` : title.trim(),
        startTime: toIsoFromLocal(date, time),
        type,
        applicationId: candidateId || undefined,
        meetingUrl: meetingUrl.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast("Event scheduled", "Calendar event successfully created.", "success")
      onOpenChange(false)
    } catch (err) {
      toast("Could not schedule event", errorMessage(err), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Event</DialogTitle>
          <DialogDescription>Add an interview or other event to your calendar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          <div>
            <label htmlFor="event-title" className={labelCls}>
              Title *
            </label>
            <input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Technical Round 1"
              required
              className={fieldCls}
            />
          </div>
          <div>
            <label htmlFor="event-candidate" className={labelCls}>
              Candidate (optional)
            </label>
            <select
              id="event-candidate"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              className={`${fieldCls} cursor-pointer`}
            >
              <option value="">No candidate / general slot</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.title ? ` (${c.title})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="event-date" className={labelCls}>
                Date *
              </label>
              <input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={`${fieldCls} cursor-pointer`}
              />
            </div>
            <div>
              <label htmlFor="event-time" className={labelCls}>
                Time *
              </label>
              <input
                id="event-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className={`${fieldCls} cursor-pointer`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="event-type" className={labelCls}>
              Type
            </label>
            <select
              id="event-type"
              value={type}
              onChange={(e) => setType(e.target.value as CalendarEvent["type"])}
              className={`${fieldCls} cursor-pointer`}
            >
              <option value="interview">Interview</option>
              <option value="deadline">Deadline</option>
              <option value="offer">Offer / Onboarding</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="event-url" className={labelCls}>
              Meeting link (optional)
            </label>
            <input
              id="event-url"
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className={fieldCls}
            />
          </div>
          <div>
            <label htmlFor="event-location" className={labelCls}>
              Location (optional)
            </label>
            <input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Office Room 4B"
              className={fieldCls}
            />
          </div>
          <div>
            <label htmlFor="event-notes" className={labelCls}>
              Notes
            </label>
            <textarea
              id="event-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details or instructions"
              rows={2}
              className="w-full p-2.5 rounded-[10px] border border-bg-border bg-bg-primary text-txt-heading text-[13px] focus:outline-none focus:border-primary/30 transition-all resize-none font-medium"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Add event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EventDetailsDialog({
  event,
  candidateName,
  onOpenChange,
  onDelete,
}: {
  event: CalendarEvent | null
  candidateName?: string
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="max-w-md overflow-y-auto">
        {event && (
          <>
            <DialogHeader>
              <span
                className={`self-start text-[11px] font-bold px-2 py-0.5 rounded-full border ${typeStyle(event.type)}`}
              >
                {TYPE_LABEL[event.type] ?? event.type}
              </span>
              <DialogTitle className="pr-8 break-words">{event.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0" />
                {formatDateTime(event.startTime)}
                {event.endTime && ` – ${formatTime(event.endTime)}`}
              </DialogDescription>
            </DialogHeader>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex items-start gap-2">
                <dt className="flex items-center gap-1.5 text-txt-caption w-24 shrink-0">
                  <User className="w-4 h-4" /> Candidate
                </dt>
                <dd className="text-txt-heading font-medium">{candidateName || "—"}</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="flex items-center gap-1.5 text-txt-caption w-24 shrink-0">
                  <MapPin className="w-4 h-4" /> Location
                </dt>
                <dd className="text-txt-heading font-medium break-words">
                  {event.location || "—"}
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="flex items-center gap-1.5 text-txt-caption w-24 shrink-0">
                  <ExternalLink className="w-4 h-4" /> Meeting
                </dt>
                <dd className="min-w-0">
                  {event.meetingUrl ? (
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold hover:underline break-all"
                    >
                      Join meeting
                    </a>
                  ) : (
                    <span className="text-txt-heading">—</span>
                  )}
                </dd>
              </div>
              {event.notes && (
                <div className="flex items-start gap-2">
                  <dt className="text-txt-caption w-24 shrink-0">Notes</dt>
                  <dd className="text-txt-body whitespace-pre-wrap break-words">{event.notes}</dd>
                </div>
              )}
            </dl>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                className="gap-1.5 text-sec-red hover:text-sec-red"
              >
                <Trash2 className="w-4 h-4" />
                Delete event
              </Button>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function CalendarPage() {
  const { toast } = useToast()
  const {
    events: allEvents,
    eventsLoading,
    fetchEvents,
    deleteEvent,
    candidates,
    selectedJobId,
  } = useJobStore()
  // Job filter: keep events linked to that job's applications.
  const jobOf = new Map(candidates.map((c) => [c.id, c.jobId]))
  const events = selectedJobId
    ? allEvents.filter((e) => !!e.applicationId && jobOf.get(e.applicationId) === selectedJobId)
    : allEvents
  const eventCounts: Record<string, number> = {}
  for (const e of allEvents) {
    const jobId = e.applicationId ? jobOf.get(e.applicationId) : undefined
    if (jobId) eventCounts[jobId] = (eventCounts[jobId] ?? 0) + 1
  }
  const [currentDate, setCurrentDate] = useState(new Date())
  const [addOpen, setAddOpen] = useState(false)
  const [selectedDateStr, setSelectedDateStr] = useState("")
  const [dayEventsDate, setDayEventsDate] = useState<string | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    fetchEvents().catch((err: unknown) =>
      toast("Could not load events", errorMessage(err), "error")
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" })

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDayOffset = new Date(year, month, 1).getDay()
  const calendarDays: (number | null)[] = [
    ...Array.from({ length: startDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const today = new Date()
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year

  const eventsByDay: Record<number, CalendarEvent[]> = {}
  events.forEach((e) => {
    const d = new Date(e.startTime)
    if (d.getMonth() === month && d.getFullYear() === year) {
      ;(eventsByDay[d.getDate()] ??= []).push(e)
    }
  })
  Object.values(eventsByDay).forEach((list) =>
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  )

  const upcoming = events
    .filter((e) => new Date(e.startTime) >= new Date())
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const detailsEvent = events.find((e) => e.id === detailsId) ?? null
  const candidateNameFor = (e: CalendarEvent | null) =>
    e?.applicationId ? candidates.find((c) => c.id === e.applicationId)?.name : undefined

  const dayEvents = dayEventsDate
    ? events
        .filter((e) => {
          const d = new Date(e.startTime)
          return toDateStr(d.getFullYear(), d.getMonth(), d.getDate()) === dayEventsDate
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    : []

  const openAdd = (dateStr = "") => {
    setSelectedDateStr(dateStr)
    setAddOpen(true)
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteEvent(pendingDelete.id)
      toast("Event deleted", `"${pendingDelete.title}" was removed.`, "success")
      if (detailsId === pendingDelete.id) setDetailsId(null)
    } catch (err) {
      toast("Could not delete event", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative min-w-0">
      {/* Header */}
      <PageHeader
        icon={CalendarDays}
        tone="violet"
        title="Interview Calendar"
        subtitle="Schedule and track interviews, deadlines and offers."
        actions={
          <Button onClick={() => openAdd()} className="cursor-pointer font-semibold shrink-0">
            Book Interview Slot
          </Button>
        }
      />
      <JobFilter id="calendar" counts={eventCounts} total={allEvents.length} />

      {/* Calendar Controls */}
      <div className="flex justify-between items-center gap-3 bg-bg-secondary p-4 rounded-card border border-bg-border/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <CalendarIcon className="w-5 h-5 text-primary shrink-0" />
          <h2
            className="text-[16px] md:text-[18px] font-bold text-txt-heading truncate"
            aria-live="polite"
          >
            {monthName}
          </h2>
          {eventsLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month - 1))}
            aria-label="Previous month"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer border border-bg-border"
          >
            <ChevronLeft className="w-4 h-4 text-txt-caption" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="px-3 h-8 rounded-[8px] text-[11.5px] font-semibold hover:bg-bg-hover transition-colors cursor-pointer text-txt-caption border border-bg-border"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month + 1))}
            aria-label="Next month"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer border border-bg-border"
          >
            <ChevronRight className="w-4 h-4 text-txt-caption" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Calendar Grid */}
        <Card className="p-2 sm:p-4 border border-bg-border/60 shadow-card bg-bg-secondary overflow-hidden xl:col-span-3 min-w-0">
          <div
            className="grid grid-cols-7 border-b border-bg-border/30 pb-2 mb-2 text-center text-[10px] sm:text-caption font-bold text-txt-caption uppercase tracking-wider"
            aria-hidden="true"
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />
              const dayEvts = eventsByDay[day] || []
              const isToday = isCurrentMonth && day === today.getDate()
              const dateStr = toDateStr(year, month, day)
              const dateLabel = date(new Date(year, month, day))

              return (
                <div
                  key={day}
                  className={`p-1 sm:p-2 rounded-[12px] sm:rounded-card border flex flex-col min-h-[56px] sm:min-h-[96px] group ${
                    isToday
                      ? "border-primary bg-primary-light/35"
                      : dayEvts.length
                        ? "border-bg-border/40 bg-bg-primary/20"
                        : "border-bg-border/10 bg-bg-secondary"
                  }`}
                >
                  <div className="flex justify-between items-center shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        dayEvts.length ? setDayEventsDate(dateStr) : openAdd(dateStr)
                      }
                      aria-label={`${dateLabel}${dayEvts.length ? `, ${dayEvts.length} event${dayEvts.length > 1 ? "s" : ""}` : ", no events. Add event"}`}
                      aria-current={isToday ? "date" : undefined}
                      className={`text-[12px] sm:text-[13px] font-bold rounded-md px-1 cursor-pointer hover:bg-bg-hover ${isToday ? "text-primary" : "text-txt-heading"}`}
                    >
                      {day}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAdd(dateStr)}
                      aria-label={`Add event on ${dateLabel}`}
                      className="hidden sm:block text-txt-caption hover:text-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 p-0.5 rounded-full hover:bg-bg-hover transition-all shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mobile: dots */}
                  {dayEvts.length > 0 && (
                    <div className="flex sm:hidden gap-0.5 mt-1 flex-wrap" aria-hidden="true">
                      {dayEvts.slice(0, 3).map((evt) => (
                        <span key={evt.id} className="w-1.5 h-1.5 rounded-full bg-primary" />
                      ))}
                    </div>
                  )}

                  {/* sm+: event chips */}
                  <div className="hidden sm:flex flex-1 flex-col gap-1 mt-2 min-h-0 justify-end">
                    {dayEvts.slice(0, 2).map((evt) => (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => setDetailsId(evt.id)}
                        className={`text-left border text-[10px] p-1.5 rounded-[8px] font-bold flex flex-col gap-0.5 leading-none cursor-pointer hover:shadow-card-hover min-w-0 ${typeStyle(evt.type)}`}
                      >
                        <span className="truncate">{formatTime(evt.startTime)}</span>
                        <span className="truncate font-extrabold">{evt.title}</span>
                      </button>
                    ))}
                    {dayEvts.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setDayEventsDate(dateStr)}
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

        {/* Legend + Upcoming */}
        <div className="flex flex-col gap-4 min-w-0">
          <Card className="p-5 border border-bg-border/60 bg-bg-secondary shadow-card">
            <h3 className="text-[14px] font-bold text-txt-heading mb-3">Legend</h3>
            <div className="space-y-2.5">
              {[
                { type: "interview", label: "Interview" },
                { type: "deadline", label: "Deadline" },
                { type: "offer", label: "Offer / Onboarding" },
                { type: "other", label: "Other" },
              ].map((l) => (
                <div
                  key={l.label}
                  className={`flex items-center gap-2 text-[12.5px] text-txt-body font-medium ${toneClass(eventTone(l.type))}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--tone-fg)] shadow-[0_0_8px_var(--tone-glow)]" />
                  {l.label}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 border border-bg-border/60 bg-bg-secondary shadow-card">
            <h3 className="text-[14px] font-bold text-txt-heading mb-4">Upcoming Schedule</h3>
            <ul className="space-y-3">
              {upcoming.length === 0 ? (
                <li className="text-caption text-txt-caption text-center py-4">
                  No upcoming events
                </li>
              ) : (
                upcoming.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setDetailsId(e.id)}
                      className={`w-full text-left p-3 rounded-[12px] border cursor-pointer hover:shadow-card-hover ${typeStyle(e.type)}`}
                    >
                      <p className="text-[12.5px] font-semibold break-words">{e.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] opacity-75">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDateTime(e.startTime)}</span>
                      </div>
                      {e.location && (
                        <p className="flex items-center gap-1 text-[11px] opacity-70 mt-1 font-medium">
                          <MapPin className="w-3 h-3" /> {e.location}
                        </p>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>

      <AddEventDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) setSelectedDateStr("")
        }}
        candidates={candidates}
        preselectedDate={selectedDateStr}
      />

      {/* Events on a given day */}
      <Dialog open={!!dayEventsDate} onOpenChange={(o) => !o && setDayEventsDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dayEventsDate && date(`${dayEventsDate}T00:00`)}</DialogTitle>
            <DialogDescription>
              {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 space-y-2">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDayEventsDate(null)
                    setDetailsId(e.id)
                  }}
                  className={`w-full text-left p-3 rounded-[12px] border cursor-pointer ${typeStyle(e.type)}`}
                >
                  <span className="text-[11.5px] opacity-75">{formatTime(e.startTime)}</span>
                  <p className="text-[13px] font-semibold break-words">{e.title}</p>
                </button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const d = dayEventsDate || ""
                setDayEventsDate(null)
                openAdd(d)
              }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventDetailsDialog
        event={detailsEvent}
        candidateName={candidateNameFor(detailsEvent)}
        onOpenChange={(o) => !o && setDetailsId(null)}
        onDelete={() => {
          if (detailsEvent) setPendingDelete(detailsEvent)
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete event?"
        description={`"${pendingDelete?.title ?? ""}" will be removed from the calendar.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
