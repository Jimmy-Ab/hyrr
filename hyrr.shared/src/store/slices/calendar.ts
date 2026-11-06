import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { mapEvent, normalizeIso, toError } from "../mappers"
import type { JobState } from "../types"

export type CalendarSlice = Pick<
  JobState,
  "events" | "eventsLoading" | "fetchEvents" | "createEvent" | "deleteEvent"
>

export const createCalendarSlice: StateCreator<JobState, [], [], CalendarSlice> = (set, get) => ({
  // ── Calendar ───────────────────────────────────────────────────────────────

  events: [],
  eventsLoading: false,

  fetchEvents: async () => {
    set({ eventsLoading: true })
    try {
      const data = await apiFetch("/calendar")
      set({ events: (data || []).map(mapEvent) })
    } catch (e) {
      console.warn("Failed to load calendar events.", e)
    } finally {
      set({ eventsLoading: false })
    }
  },

  createEvent: async (data) => {
    const created = await apiFetch("/calendar", {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        startTime: normalizeIso(data.startTime),
        endTime: normalizeIso(data.endTime),
        type: data.type?.toUpperCase(),
        applicationId: data.applicationId || undefined,
        meetingUrl: data.meetingUrl || undefined,
        location: data.location || undefined,
        notes: data.notes || undefined,
      }),
    })
    const mapped = mapEvent({
      ...created,
      meetingUrl: created?.meetingUrl ?? data.meetingUrl,
      location: created?.location ?? data.location,
    })
    set((state) => ({ events: [...state.events, mapped] }))
  },

  deleteEvent: async (id) => {
    const previous = get().events
    set({ events: previous.filter((e) => e.id !== id) })
    try {
      await apiFetch(`/calendar/${id}`, { method: "DELETE" })
    } catch (err) {
      set({ events: previous })
      throw toError(err, "Failed to delete event")
    }
  },
})
