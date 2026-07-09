import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Video } from "lucide-react"
import { Card } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { useToast } from "hyrr.shared"
import { useJobStore } from "hyrr.shared"

export function CandidateCalendar() {
  const { toast } = useToast()
  const { jobApplications } = useJobStore()

  // July 2026 starts on Wednesday (offset 3)
  const daysInMonth = 31
  const startDayOffset = 3
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDaysBefore = Array.from({ length: startDayOffset }, () => null)
  const calendarDays = [...emptyDaysBefore, ...days]

  const events: Record<number, { time: string; label: string; type: "interview" | "deadline" | "offer" }[]> = {
    5:  [{ time: "10:00 AM", label: "Technical Interview · Stripe", type: "interview" }],
    10: [{ time: "2:00 PM",  label: "Portfolio Review · Vercel",   type: "interview" }],
    15: [{ time: "11:00 AM", label: "Final Round · Figma",         type: "interview" }, { time: "5:00 PM", label: "Offer Decision Deadline · Figma", type: "deadline" }],
    22: [{ time: "9:00 AM",  label: "Onboarding Call · Figma",     type: "offer" }],
  }

  const typeStyle = (type: string) => {
    if (type === "interview") return "bg-primary-light border-primary-border/30 text-primary"
    if (type === "deadline")  return "bg-sec-orange/10 border-sec-orange/20 text-sec-orange"
    if (type === "offer")     return "bg-sec-green/10 border-sec-green/20 text-sec-green"
    return "bg-bg-primary border-bg-border text-txt-body"
  }

  const upcoming = Object.entries(events)
    .filter(([day]) => Number(day) >= 5)
    .flatMap(([day, evts]) => evts.map((e) => ({ ...e, day: Number(day) })))
    .slice(0, 4)

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Calendar</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Interviews, deadlines, and important dates for your job search.</p>
        </div>
        <Button onClick={() => toast("Coming soon", "Meeting scheduler is in development.", "info")} className="cursor-pointer font-semibold shadow-button">
          <Video className="w-4 h-4 mr-2" /> Schedule Meeting
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h2 className="text-[18px] font-bold text-txt-heading">July 2026</h2>
            </div>
            <div className="flex gap-1">
              <button className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-txt-caption" /></button>
              <button className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-txt-caption" /></button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-[11px] font-bold text-txt-caption uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />
              const dayEvents = events[day] ?? []
              const isToday = day === 1
              const hasEvent = dayEvents.length > 0
              return (
                <div
                  key={day}
                  onClick={() => hasEvent && toast("Events", dayEvents.map((e) => e.label).join(" | "), "info")}
                  className={`relative aspect-square flex flex-col items-center justify-start pt-2 rounded-[10px] cursor-pointer transition-all group ${
                    isToday ? "bg-primary text-white" :
                    hasEvent ? "hover:bg-bg-hover" : "hover:bg-bg-hover/60"
                  }`}
                >
                  <span className={`text-[13px] font-semibold ${isToday ? "text-white" : hasEvent ? "text-txt-heading" : "text-txt-body"}`}>{day}</span>
                  {hasEvent && (
                    <div className="absolute bottom-1.5 flex gap-0.5">
                      {dayEvents.slice(0, 2).map((e, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${e.type === "interview" ? "bg-primary" : e.type === "deadline" ? "bg-sec-orange" : "bg-sec-green"}`} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Upcoming events */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h3 className="text-[14px] font-bold text-txt-heading mb-4">Upcoming Events</h3>
            <div className="space-y-3">
              {upcoming.map((e, i) => (
                <div key={i} className={`p-3 rounded-[12px] border ${typeStyle(e.type)}`}>
                  <p className="text-[13px] font-semibold">{e.label}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] opacity-75">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Jul {e.day} · {e.time}</span>
                  </div>
                </div>
              ))}
              {upcoming.length === 0 && <p className="text-caption text-txt-caption text-center py-4">No upcoming events</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-bold text-txt-heading mb-3">Legend</h3>
            <div className="space-y-2">
              {[
                { color: "bg-primary", label: "Interview" },
                { color: "bg-sec-orange", label: "Deadline" },
                { color: "bg-sec-green", label: "Offer / Onboarding" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2 text-[12.5px] text-txt-body">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
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
