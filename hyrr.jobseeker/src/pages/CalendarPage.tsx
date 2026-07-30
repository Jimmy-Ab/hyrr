import { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { Card, Button, useToast, useJobStore } from "hyrr.shared";
import type { CalendarEvent } from "hyrr.shared";

const typeStyle = (type: string) => {
  if (type === "interview")
    return "bg-primary-light border-primary-border/30 text-primary";
  if (type === "deadline")
    return "bg-sec-orange/10 border-sec-orange/20 text-sec-orange";
  if (type === "offer")
    return "bg-sec-green/10 border-sec-green/20 text-sec-green";
  return "bg-bg-primary border-bg-border text-txt-body";
};

function AddEventModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (e: Omit<CalendarEvent, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [type, setType] = useState<CalendarEvent["type"]>("interview");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    onAdd({ title, startTime: `${date}T${time}:00`, type, notes: undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-secondary border border-bg-border/60 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-txt-heading">
            Add Calendar Event
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-bg-hover text-txt-caption cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Technical Interview · Stripe"
              required
              className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all"
              />
            </div>
            <div>
              <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-9 px-3 rounded-[10px] border border-bg-border bg-bg-primary text-[13px] focus:outline-none focus:border-primary/30 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] font-bold text-txt-caption uppercase tracking-wider block mb-1">
              Type
            </label>
            <select
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
              className="flex-1 cursor-pointer shadow-button"
            >
              Add Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CandidateCalendar() {
  const { toast } = useToast();
  const { events, eventsLoading, fetchEvents, createEvent, deleteEvent } =
    useJobStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []); // eslint-disable-line

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = new Date(year, month).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOffset = new Date(year, month, 1).getDay();
  const calendarDays = [
    ...Array.from({ length: startDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Map events to day numbers for the current month
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  events.forEach((ev) => {
    const d = new Date(ev.startTime);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  });

  const today = new Date();
  const isCurrentMonth =
    today.getMonth() === month && today.getFullYear() === year;

  const upcoming = events
    .filter((ev) => new Date(ev.startTime) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      {addModalOpen && (
        <AddEventModal
          onClose={() => setAddModalOpen(false)}
          onAdd={async (data) => {
            await createEvent(data);
            toast(
              "Event Added",
              "Calendar event saved successfully.",
              "success",
            );
          }}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">Calendar</span>
          </h1>
          <p className="text-body text-txt-body mt-1 font-medium">
            Interviews, deadlines, and important dates for your job search.
          </p>
        </div>
        <Button
          onClick={() => setAddModalOpen(true)}
          className="cursor-pointer font-semibold shadow-button"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Event
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h2 className="text-[18px] font-bold text-txt-heading">
                {monthName}
              </h2>
              {eventsLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1))}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-txt-caption" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 h-8 rounded-[8px] text-[11.5px] font-semibold hover:bg-bg-hover transition-colors cursor-pointer text-txt-caption"
              >
                Today
              </button>
              <button
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
                className="text-center text-[11px] font-bold text-txt-caption uppercase tracking-wider py-2"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const dayEvts = eventsByDay[day] || [];
              const isToday = isCurrentMonth && day === today.getDate();
              const hasEvent = dayEvts.length > 0;

              return (
                <div
                  key={day}
                  onClick={() =>
                    hasEvent &&
                    toast(
                      "Events",
                      dayEvts.map((e) => e.title).join(" | "),
                      "info",
                    )
                  }
                  className={`relative aspect-square flex flex-col items-center justify-start pt-2 rounded-[10px] cursor-pointer transition-all group ${
                    isToday
                      ? "bg-primary text-white shadow-button"
                      : hasEvent
                        ? "hover:bg-primary-light/50 hover:border-primary/20 border border-transparent"
                        : "hover:bg-bg-hover/60 border border-transparent"
                  }`}
                >
                  <span
                    className={`text-[13px] font-semibold ${isToday ? "text-white" : hasEvent ? "text-txt-heading" : "text-txt-body"}`}
                  >
                    {day}
                  </span>
                  {hasEvent && (
                    <div className="absolute bottom-1.5 flex gap-0.5">
                      {dayEvts.slice(0, 2).map((e, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${e.type === "interview" ? (isToday ? "bg-white" : "bg-primary") : e.type === "deadline" ? "bg-sec-orange" : "bg-sec-green"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Upcoming events + legend */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-txt-heading">
                Upcoming Events
              </h3>
              <button
                onClick={() => setAddModalOpen(true)}
                className="text-[11px] text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-caption text-txt-caption text-center py-4">
                  No upcoming events
                </p>
              ) : (
                upcoming.map((e, i) => {
                  const type = e.type;
                  const label = e.title;
                  const timeStr = new Date(e.startTime).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-[12px] border ${typeStyle(type)} group relative`}
                    >
                      <p className="text-[13px] font-semibold pr-6">{label}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] opacity-75">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeStr}</span>
                      </div>
                      <button
                        onClick={() => deleteEvent(e.id)}
                        className="absolute top-2 right-2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-sec-red"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-bold text-txt-heading mb-3">
              Legend
            </h3>
            <div className="space-y-2">
              {[
                { color: "bg-primary", label: "Interview" },
                { color: "bg-sec-orange", label: "Deadline" },
                { color: "bg-sec-green", label: "Offer / Onboarding" },
              ].map((l) => (
                <div
                  key={l.label}
                  className="flex items-center gap-2 text-[12.5px] text-txt-body"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  {l.label}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
