import { useEffect, useState } from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus, X, Loader2 } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { useToast } from "../components/ui/toast"
import { useJobStore, type CalendarEvent } from "../store/useJobStore"

const typeStyle = (type: string) => {
  if (type === "interview") return "bg-primary-light border-primary-border/30 text-primary"
  if (type === "deadline") return "bg-sec-orange/10 border-sec-orange/20 text-sec-orange"
  if (type === "offer") return "bg-sec-green/10 border-sec-green/20 text-sec-green"
  return "bg-bg-primary border-bg-border text-txt-body"
}

function AddEventModal({ onClose, onAdd, candidates, preselectedDate }: { onClose: () => void; onAdd: (e: Omit<CalendarEvent, "id">) => void; candidates: any[]; preselectedDate?: string }) {
  const [title, setTitle] = useState("")
  const [candidateId, setCandidateId] = useState("")
  const [date, setDate] = useState(preselectedDate || "")
  const [time, setTime] = useState("10:00")
  const [type, setType] = useState<CalendarEvent["type"]>("interview")
  const [notes, setNotes] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date) return
    onAdd({
      title: candidateId ? `${title} - ${candidates.find(c => c.id === candidateId)?.name || ""}` : title,
      startTime: `${date}T${time}:00`,
      type,
      applicationId: candidateId || undefined,
      notes: notes || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-secondary border border-bg-border/60 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-txt-heading">Schedule Interview Slot</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-bg-hover text-txt-caption cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Meeting Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Technical Round 1"
              required
              className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all font-medium"
            />
          </div>
          <div>
            <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Select Candidate (Optional)</label>
            <select
              value={candidateId}
              onChange={e => setCandidateId(e.target.value)}
              className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all font-medium cursor-pointer"
            >
              <option value="">-- No Candidate / General Slot --</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.title})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all font-medium cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all font-medium cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as CalendarEvent["type"])}
              className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all font-medium cursor-pointer"
            >
              <option value="interview">Interview Slot</option>
              <option value="deadline">Application Deadline</option>
              <option value="offer">Offer / Onboarding Discussion</option>
              <option value="other">Other Event</option>
            </select>
          </div>
          <div>
            <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Meeting link, details, etc."
              rows={2}
              className="w-full p-2.5 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all resize-none font-medium"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 cursor-pointer font-semibold">Cancel</Button>
            <Button type="submit" className="flex-1 cursor-pointer font-semibold shadow-button">Add Slot</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CalendarPage() {
  const { toast } = useToast()
  const { events, eventsLoading, fetchEvents, createEvent, deleteEvent, candidates } = useJobStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedDateStr, setSelectedDateStr] = useState("")

  useEffect(() => {
    fetchEvents()
  }, []) // eslint-disable-line

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" })

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDayOffset = new Date(year, month, 1).getDay()

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDaysBefore = Array.from({ length: startDayOffset }, () => null)
  const calendarDays = [...emptyDaysBefore, ...days]

  const today = new Date()
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year

  // Map events to days
  const eventsByDay: Record<number, CalendarEvent[]> = {}
  events.forEach((e) => {
    const d = new Date(e.startTime)
    if (d.getMonth() === month && d.getFullYear() === year) {
      const dateNum = d.getDate()
      if (!eventsByDay[dateNum]) eventsByDay[dateNum] = []
      eventsByDay[dateNum].push(e)
    }
  })

  // Get upcoming events
  const upcoming = events.filter((e) => new Date(e.startTime) >= new Date())

  const handleAddSlot = async (data: Omit<CalendarEvent, "id">) => {
    try {
      await createEvent(data)
      toast("Interview Scheduled", "Calendar event successfully created.", "success")
    } catch {
      toast("Error", "Failed to schedule event. Please try again.", "error")
    }
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Interview Calendar</h1>
          <p className="text-body text-txt-body mt-1 font-medium">
            Schedule and track interview panel discussions.
          </p>
        </div>
        <Button
          onClick={() => setAddModalOpen(true)}
          className="cursor-pointer font-semibold shadow-button"
        >
          Book Interview Slot
        </Button>
      </div>

      {/* Calendar Controls */}
      <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-card border border-bg-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] shrink-0">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <h2 className="text-[18px] font-bold text-txt-heading">{monthName}</h2>
          {eventsLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1))}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer border border-bg-border"
          >
            <ChevronLeft className="w-4 h-4 text-txt-caption" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 h-8 rounded-[8px] text-[11.5px] font-semibold hover:bg-bg-hover transition-colors cursor-pointer text-txt-caption border border-bg-border"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1))}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer border border-bg-border"
          >
            <ChevronRight className="w-4 h-4 text-txt-caption" />
          </button>
        </div>
      </div>

      {/* Grid: Calendar vs Legend/Upcoming */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Calendar Grid */}
        <Card className="p-4 border border-bg-border/60 shadow-card bg-bg-secondary overflow-hidden xl:col-span-3">
          {/* Days of week */}
          <div className="grid grid-cols-7 border-b border-bg-border/30 pb-2 mb-2 text-center text-caption font-bold text-txt-caption uppercase tracking-wider">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2 min-h-[480px]">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />
              const dayEvts = eventsByDay[day] || []
              const isToday = isCurrentMonth && day === today.getDate()
              const hasEvent = dayEvts.length > 0

              return (
                <div
                  key={day}
                  className={`p-2.5 rounded-card border transition-all duration-200 flex flex-col justify-between aspect-square group ${
                    isToday
                      ? "border-primary bg-primary-light/35 hover:bg-primary-light/50 cursor-pointer"
                      : hasEvent
                      ? "border-bg-border/40 bg-bg-primary/20 hover:bg-bg-primary/60 cursor-pointer"
                      : "border-bg-border/10 bg-bg-secondary hover:bg-bg-primary/30 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (hasEvent) {
                      toast("Events", dayEvts.map(e => e.title).join(" | "), "info")
                    } else {
                      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                      setSelectedDateStr(dateStr)
                      setAddModalOpen(true)
                    }
                  }}
                >
                  <div className="flex justify-between items-center shrink-0">
                    <span className={`text-[13px] font-bold ${isToday ? "text-primary" : "text-txt-heading"}`}>
                      {day}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        setSelectedDateStr(dateStr)
                        setAddModalOpen(true)
                      }}
                      className="text-txt-caption hover:text-primary opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-bg-hover transition-all shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Events list */}
                  <div className="flex-1 flex flex-col gap-1 mt-2 min-h-0 justify-end">
                    {dayEvts.slice(0, 2).map((evt, eIdx) => {
                      const type = evt.type
                      const label = evt.title
                      const timeStr = new Date(evt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

                      return (
                        <div
                          key={eIdx}
                          onClick={(e) => {
                            e.stopPropagation()
                            toast("Interview Session", `${label} at ${timeStr}`, "success")
                          }}
                          className={`border text-[9px] p-1.5 rounded-[8px] font-bold flex flex-col gap-0.5 leading-none transition-shadow hover:shadow-[0_2px_8px_rgba(108,99,255,0.1)] truncate ${typeStyle(type)}`}
                        >
                          <span className="truncate">{timeStr}</span>
                          <span className="truncate font-extrabold">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Legend + Upcoming */}
        <div className="flex flex-col gap-4">
          <Card className="p-5 border border-bg-border/60 bg-bg-secondary shadow-card">
            <h3 className="text-[14px] font-bold text-txt-heading mb-3">Legend</h3>
            <div className="space-y-2.5">
              {[
                { color: "bg-primary", label: "Interview Slot" },
                { color: "bg-sec-orange", label: "Deadline" },
                { color: "bg-sec-green", label: "Offer / Onboarding" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2 text-[12.5px] text-txt-body font-medium">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 border border-bg-border/60 bg-bg-secondary shadow-card">
            <h3 className="text-[14px] font-bold text-txt-heading mb-4">Upcoming Schedule</h3>
            <div className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-caption text-txt-caption text-center py-4">No upcoming events</p>
              ) : upcoming.map((e, i) => {
                return (
                  <div key={i} className={`p-3 rounded-[12px] border ${typeStyle(e.type)} group relative`}>
                    <p className="text-[12.5px] font-semibold pr-6">{e.title}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] opacity-75">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(e.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <button
                      onClick={() => deleteEvent(e.id)}
                      className="absolute top-2 right-2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-sec-red"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {addModalOpen && (
        <AddEventModal
          onClose={() => {
            setAddModalOpen(false)
            setSelectedDateStr("")
          }}
          onAdd={handleAddSlot}
          candidates={candidates}
          preselectedDate={selectedDateStr}
        />
      )}
    </div>
  )
}
