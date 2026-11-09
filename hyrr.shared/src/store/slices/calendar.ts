import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { mapEvent, mapInterviewInvite, normalizeIso, toError } from "../mappers"
import type { JobState } from "../types"

export type CalendarSlice = Pick<
  JobState,
  | "events"
  | "eventsLoading"
  | "fetchEvents"
  | "createEvent"
  | "deleteEvent"
  | "interviewInvites"
  | "fetchInterviewInvites"
  | "createInterviewInvite"
  | "bookInterviewSlot"
  | "cancelInterviewInvite"
  | "upsertInterviewInvite"
  | "fetchScorecards"
  | "submitScorecard"
  | "setScorecardCompetencies"
>

export const createCalendarSlice: StateCreator<JobState, [], [], CalendarSlice> = (set, get) => ({
  // ── Calendar ───────────────────────────────────────────────────────────────

  events: [],
  eventsLoading: false,
  interviewInvites: [],

  fetchScorecards: (applicationId) => apiFetch(`/scorecards/applications/${applicationId}`),

  submitScorecard: (applicationId, input) =>
    apiFetch(`/scorecards/applications/${applicationId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  setScorecardCompetencies: async (jobId, competencies) => {
    const res = await apiFetch(`/scorecards/jobs/${jobId}/competencies`, {
      method: "PUT",
      body: JSON.stringify({ competencies }),
    })
    return res?.competencies ?? competencies
  },

  fetchInterviewInvites: async (applicationId) => {
    const qs = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : ""
    const data = await apiFetch(`/calendar/invites${qs}`)
    const fresh = (data || []).map(mapInterviewInvite)
    set((state) => ({
      // Recruiters load per application: keep invites of other applications.
      interviewInvites: applicationId
        ? [...state.interviewInvites.filter((i) => i.applicationId !== applicationId), ...fresh]
        : fresh,
    }))
  },

  createInterviewInvite: async (input) => {
    const created = mapInterviewInvite(
      await apiFetch("/calendar/invites", {
        method: "POST",
        body: JSON.stringify({
          applicationId: input.applicationId,
          title: input.title,
          durationMin: input.durationMin,
          slots: input.slots.map((startTime) => ({ startTime })),
          location: input.location || undefined,
          meetingUrl: input.meetingUrl || undefined,
          note: input.note || undefined,
        }),
      })
    )
    get().upsertInterviewInvite(created)
    return created
  },

  bookInterviewSlot: async (inviteId, slotId) => {
    const result = await apiFetch(`/calendar/invites/${inviteId}/book`, {
      method: "POST",
      body: JSON.stringify({ slotId }),
    })
    get().upsertInterviewInvite(result?.invite, result?.event)
  },

  cancelInterviewInvite: async (inviteId) => {
    const previous = get().interviewInvites
    set({
      interviewInvites: previous.map((i) =>
        i.id === inviteId ? { ...i, status: "CANCELED" as const } : i
      ),
    })
    try {
      await apiFetch(`/calendar/invites/${inviteId}/cancel`, { method: "POST" })
    } catch (err) {
      set({ interviewInvites: previous })
      throw toError(err, "Could not withdraw the interview times")
    }
  },

  upsertInterviewInvite: (raw, rawEvent) => {
    if (!raw?.id) return
    const invite = mapInterviewInvite(raw)
    const event = rawEvent?.id
      ? {
          ...mapEvent(rawEvent),
          companyName: invite.companyName,
          jobTitle: invite.jobTitle,
          organizerName: invite.organizerName,
        }
      : null
    set((state) => ({
      interviewInvites: [invite, ...state.interviewInvites.filter((i) => i.id !== invite.id)],
      ...(event ? { events: [...state.events.filter((e) => e.id !== event.id), event] } : {}),
    }))
  },

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
