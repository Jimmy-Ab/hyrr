import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { employmentTypeCode, type JobType } from "../../lib/contracts"
import { jobFilterParams } from "../../lib/job-filters"
import {
  mapAlert,
  mapCvSuggestions,
  mapPublicJob,
  mapSavedSearch,
  mapScreeningQuestion,
  mapTimelineEntry,
  stringList,
  toError,
} from "../mappers"
import type { StoreSet } from "../session"
import type { JobState, PublicJob, SavedSearchFilters } from "../types"

/** UI filters → API filters (job type label → EmploymentType code; "All" dropped). */
const toApiFilters = (filters: SavedSearchFilters) => {
  const { type, ...rest } = filters
  const code = type && type !== "All" ? employmentTypeCode(type as JobType) : undefined
  return { ...rest, ...(code ? { type: code } : {}) }
}

export type SeekerToolsSlice = Pick<
  JobState,
  | "matchedJobs"
  | "matchTab"
  | "matchedJobsLoading"
  | "profileStrength"
  | "profileMissing"
  | "thinProfile"
  | "fetchMatchedJobs"
  | "matchedJobsCursor"
  | "matchedJobsLoadingMore"
  | "fetchMoreMatchedJobs"
  | "matchFilters"
  | "refreshProfileStrength"
  | "alerts"
  | "alertsLoading"
  | "fetchAlerts"
  | "createAlert"
  | "updateAlert"
  | "deleteAlert"
  | "savedSearches"
  | "fetchSavedSearches"
  | "createSavedSearch"
  | "updateSavedSearch"
  | "deleteSavedSearch"
  | "importProfileFromCv"
  | "fetchScreeningQuestions"
  | "fetchTimeline"
>

/** Copies profileStrength / missing from a GET /profile (or PUT) payload, when present. */
export const applyProfileStrength = (set: StoreSet, profile: any) => {
  if (!profile || typeof profile !== "object") return
  if (typeof profile.profileStrength === "number") {
    set({
      profileStrength: Math.max(0, Math.min(100, Math.round(profile.profileStrength))),
      profileMissing: stringList(profile.missing),
    })
  }
}

/** Monotonic token: an older fetchMatchedJobs response never overwrites a newer tab. */
let matchSeq = 0
const MATCH_PAGE_SIZE = 20

export const createSeekerToolsSlice: StateCreator<JobState, [], [], SeekerToolsSlice> = (
  set,
  get
) => ({
  matchedJobs: [],
  matchTab: "for-you",
  matchedJobsLoading: false,
  matchedJobsCursor: null,
  matchedJobsLoadingMore: false,
  matchFilters: {},
  profileStrength: 0,
  profileMissing: [],
  thinProfile: false,

  fetchMatchedJobs: async (tab, filters, opts) => {
    const seq = ++matchSeq
    const active = filters ?? get().matchFilters
    set({ matchTab: tab, matchedJobsLoading: true, matchFilters: active })
    try {
      const res = await apiFetch(
        `/matching/jobs?${new URLSearchParams({
          tab,
          limit: String(MATCH_PAGE_SIZE),
          ...jobFilterParams(active),
          ...(opts?.refresh ? { refresh: "true" } : {}),
        })}`
      )
      if (seq !== matchSeq) return
      set({
        matchedJobs: Array.isArray(res?.jobs) ? res.jobs.map(mapPublicJob) : [],
        matchedJobsCursor: typeof res?.nextCursor === "string" ? res.nextCursor : null,
        thinProfile: !!res?.thinProfile,
      })
      if (Array.isArray(res?.missing)) applyProfileStrength(set, res)
      else if (typeof res?.profileStrength === "number") {
        set({ profileStrength: Math.max(0, Math.min(100, Math.round(res.profileStrength))) })
      }
    } catch (err) {
      throw toError(err, "Failed to load jobs")
    } finally {
      if (seq === matchSeq) set({ matchedJobsLoading: false })
    }
  },

  fetchMoreMatchedJobs: async () => {
    const {
      matchedJobsCursor: cursor,
      matchedJobsLoadingMore,
      matchedJobsLoading,
      matchTab,
      matchFilters,
    } = get()
    // One request at a time, and nothing past the last page.
    if (!cursor || matchedJobsLoadingMore || matchedJobsLoading) return
    const seq = matchSeq
    set({ matchedJobsLoadingMore: true })
    try {
      const res = await apiFetch(
        `/matching/jobs?${new URLSearchParams({
          tab: matchTab,
          limit: String(MATCH_PAGE_SIZE),
          cursor,
          ...jobFilterParams(matchFilters),
        })}`
      )
      // The tab changed (or was reloaded) meanwhile: drop this page.
      if (seq !== matchSeq) return
      const page: PublicJob[] = Array.isArray(res?.jobs) ? res.jobs.map(mapPublicJob) : []
      set((state) => {
        const seen = new Set(state.matchedJobs.map((j) => j.id))
        return {
          matchedJobs: [...state.matchedJobs, ...page.filter((j) => !seen.has(j.id))],
          matchedJobsCursor: typeof res?.nextCursor === "string" ? res.nextCursor : null,
        }
      })
    } catch (err) {
      throw toError(err, "Could not load more jobs")
    } finally {
      set({ matchedJobsLoadingMore: false })
    }
  },

  refreshProfileStrength: async () => {
    const profile = await apiFetch("/profile")
    applyProfileStrength(set, profile)
  },

  // ── Alerts ─────────────────────────────────────────────────────────────────
  alerts: [],
  alertsLoading: false,

  fetchAlerts: async () => {
    set({ alertsLoading: true })
    try {
      const data = await apiFetch("/alerts")
      set({ alerts: (Array.isArray(data) ? data : []).map(mapAlert) })
    } finally {
      set({ alertsLoading: false })
    }
  },

  createAlert: async (input) => {
    const created = mapAlert(
      await apiFetch("/alerts", { method: "POST", body: JSON.stringify(input) })
    )
    set((state) => ({ alerts: [created, ...state.alerts.filter((a) => a.id !== created.id)] }))
    return created
  },

  updateAlert: async (id, patch) => {
    const previous = get().alerts.find((a) => a.id === id)
    if (previous) {
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }))
    }
    try {
      const updated = await apiFetch(`/alerts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
      if (updated?.id) {
        const mapped = mapAlert(updated)
        set((state) => ({ alerts: state.alerts.map((a) => (a.id === id ? mapped : a)) }))
      }
    } catch (err) {
      if (previous) {
        set((state) => ({ alerts: state.alerts.map((a) => (a.id === id ? previous : a)) }))
      }
      throw toError(err, "Failed to update alert")
    }
  },

  deleteAlert: async (id) => {
    const previous = get().alerts
    set({ alerts: previous.filter((a) => a.id !== id) })
    try {
      await apiFetch(`/alerts/${encodeURIComponent(id)}`, { method: "DELETE" })
    } catch (err) {
      set({ alerts: previous })
      throw toError(err, "Failed to delete alert")
    }
  },

  // ── Saved searches ─────────────────────────────────────────────────────────
  savedSearches: [],

  fetchSavedSearches: async () => {
    const data = await apiFetch("/saved-searches")
    set({ savedSearches: (Array.isArray(data) ? data : []).map(mapSavedSearch) })
  },

  createSavedSearch: async (input) => {
    const created = mapSavedSearch(
      await apiFetch("/saved-searches", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          ...(input.query ? { query: input.query } : {}),
          filters: toApiFilters(input.filters),
        }),
      })
    )
    set((state) => ({
      savedSearches: [created, ...state.savedSearches.filter((s) => s.id !== created.id)],
    }))
    return created
  },

  updateSavedSearch: async (id, patch) => {
    const previous = get().savedSearches.find((s) => s.id === id)
    if (previous) {
      set((state) => ({
        savedSearches: state.savedSearches.map((s) =>
          s.id === id ? { ...s, ...patch, query: patch.query ?? s.query } : s
        ),
      }))
    }
    try {
      const updated = await apiFetch(`/saved-searches/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(
          patch.filters ? { ...patch, filters: toApiFilters(patch.filters) } : patch
        ),
      })
      if (updated?.id) {
        const mapped = mapSavedSearch(updated)
        set((state) => ({
          savedSearches: state.savedSearches.map((s) => (s.id === id ? mapped : s)),
        }))
      }
    } catch (err) {
      if (previous) {
        set((state) => ({
          savedSearches: state.savedSearches.map((s) => (s.id === id ? previous : s)),
        }))
      }
      throw toError(err, "Failed to update saved search")
    }
  },

  deleteSavedSearch: async (id) => {
    const previous = get().savedSearches
    set({ savedSearches: previous.filter((s) => s.id !== id) })
    try {
      await apiFetch(`/saved-searches/${encodeURIComponent(id)}`, { method: "DELETE" })
    } catch (err) {
      set({ savedSearches: previous })
      throw toError(err, "Failed to delete saved search")
    }
  },

  // ── CV import / screening / timeline ───────────────────────────────────────
  importProfileFromCv: async (input) => {
    const res = await apiFetch("/profile/import-cv", {
      method: "POST",
      body: JSON.stringify({
        ...(input.documentId ? { documentId: input.documentId } : {}),
        ...(input.url ? { url: input.url } : {}),
      }),
    })
    return mapCvSuggestions(res?.suggestions)
  },

  fetchScreeningQuestions: async (jobId) => {
    const data = await apiFetch(`/jobs/${encodeURIComponent(jobId)}/questions`)
    return (Array.isArray(data) ? data : []).map(mapScreeningQuestion)
  },

  fetchTimeline: async (applicationId) => {
    const data = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/timeline`)
    return (Array.isArray(data) ? data : []).map(mapTimelineEntry)
  },
})
