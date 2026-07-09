import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { useToast } from "../components/ui/toast"

export function CalendarPage() {
  const { toast } = useToast()
  
  // July 2026 starts on Wednesday (offset 3)
  const daysInMonth = 31
  const startDayOffset = 3 
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDaysBefore = Array.from({ length: startDayOffset }, () => null)
  
  const calendarDays = [...emptyDaysBefore, ...days]

  // Mock events for specific days
  const events: Record<number, { time: string; name: string; type: string }[]> = {
    4: [{ time: "10:00 AM", name: "Emily Carter", type: "Technical Stage" }],
    10: [{ time: "02:00 PM", name: "James Wilson", type: "System Design" }],
    15: [
      { time: "11:30 AM", name: "Robert Brown", type: "HM Interview" },
      { time: "04:00 PM", name: "Jessica Davis", type: "Culture Fit" }
    ],
    22: [{ time: "09:00 AM", name: "Christopher Taylor", type: "Offer Call" }],
    28: [{ time: "01:00 PM", name: "Lisa Park", type: "Screening" }]
  }

  const handleAddEvent = (day: number) => {
    toast("Schedule Interview", `Booking interview slot for July ${day}, 2026`, "info")
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
          onClick={() => toast("Feature coming soon", "Calendar booking details.", "info")}
          className="cursor-pointer font-semibold shadow-button"
        >
          Book Interview Slot
        </Button>
      </div>

      {/* Calendar Controls */}
      <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-card border border-bg-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] shrink-0">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <span className="text-[18px] font-bold text-txt-heading">July 2026</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="h-9 w-9 p-0 rounded-full cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" className="px-4 h-9 font-semibold rounded-button cursor-pointer">
            Today
          </Button>
          <Button variant="secondary" size="sm" className="h-9 w-9 p-0 rounded-full cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4 border border-bg-border/60 shadow-card bg-bg-secondary overflow-hidden">
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
            const dayEvents = day ? events[day] : null
            
            return (
              <div
                key={idx}
                className={`p-2.5 rounded-card border transition-all duration-200 flex flex-col justify-between ${
                  day
                    ? "border-bg-border/30 bg-bg-primary/20 hover:bg-bg-primary/60 cursor-pointer"
                    : "border-transparent bg-transparent pointer-events-none"
                }`}
                onClick={() => day && handleAddEvent(day)}
              >
                {day ? (
                  <>
                    <div className="flex justify-between items-center shrink-0">
                      <span className="text-[13px] font-bold text-txt-heading">
                        {day}
                      </span>
                      <button className="text-txt-caption hover:text-primary opacity-0 hover:opacity-100 p-0.5 rounded-full hover:bg-bg-hover transition-all shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {/* Events list */}
                    <div className="flex-1 flex flex-col gap-1.5 mt-2 min-h-0 justify-end">
                      {dayEvents?.map((evt, eIdx) => (
                        <div
                          key={eIdx}
                          onClick={(e) => {
                            e.stopPropagation()
                            toast("Interview Session", `${evt.name}: ${evt.type} at ${evt.time}`, "success")
                          }}
                          className="bg-primary-light border border-primary-border/40 text-[10px] p-1.5 rounded-[8px] text-primary font-bold flex flex-col gap-0.5 leading-none transition-shadow hover:shadow-[0_2px_8px_rgba(108,99,255,0.1)] truncate"
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{evt.time}</span>
                          </div>
                          <span className="truncate">{evt.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
