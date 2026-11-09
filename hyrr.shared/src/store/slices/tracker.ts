import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { toError } from "../mappers"
import type { ExternalApplication, JobState } from "../types"

export type TrackerSlice = Pick<
  JobState,
  | "externalApplications"
  | "fetchExternalApplications"
  | "addExternalApplication"
  | "updateExternalApplication"
  | "removeExternalApplication"
  | "fetchWebJobs"
  | "applyWebJob"
>

const map = (e: any): ExternalApplication => ({
  id: e.id,
  company: e.company,
  title: e.title,
  url: e.url ?? undefined,
  location: e.location ?? undefined,
  stage: e.stage,
  notes: e.notes ?? undefined,
  appliedAt: e.appliedAt ?? undefined,
  updatedAt: e.updatedAt,
})

/** Seeker's tracker for jobs applied to outside Hyrr (free, private). */
export const createTrackerSlice: StateCreator<JobState, [], [], TrackerSlice> = (set, get) => ({
  externalApplications: [],

  fetchWebJobs: (q, remote, cursor) => {
    const params = new URLSearchParams()
    if (q?.trim()) params.set("q", q.trim())
    if (remote) params.set("remote", "true")
    if (cursor) params.set("cursor", cursor)
    return apiFetch(`/external-jobs?${params.toString()}`)
  },

  applyWebJob: async (id) => {
    const res = await apiFetch(`/external-jobs/${id}/apply`, { method: "POST" })
    // Credits were spent and the job was added to the tracker.
    void get()
      .fetchWallet()
      .catch(() => undefined)
    void get()
      .fetchExternalApplications()
      .catch(() => undefined)
    return res
  },

  fetchExternalApplications: async () => {
    set({ externalApplications: ((await apiFetch("/external-applications")) || []).map(map) })
  },

  addExternalApplication: async (input) => {
    const created = map(
      await apiFetch("/external-applications", { method: "POST", body: JSON.stringify(input) })
    )
    set((state) => ({ externalApplications: [created, ...state.externalApplications] }))
  },

  updateExternalApplication: async (id, patch) => {
    const previous = get().externalApplications
    set({
      externalApplications: previous.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })
    try {
      const saved = map(
        await apiFetch(`/external-applications/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        })
      )
      set((state) => ({
        externalApplications: state.externalApplications.map((e) => (e.id === id ? saved : e)),
      }))
    } catch (err) {
      set({ externalApplications: previous })
      throw toError(err, "Could not update")
    }
  },

  removeExternalApplication: async (id) => {
    const previous = get().externalApplications
    set({ externalApplications: previous.filter((e) => e.id !== id) })
    try {
      await apiFetch(`/external-applications/${id}`, { method: "DELETE" })
    } catch (err) {
      set({ externalApplications: previous })
      throw toError(err, "Could not remove")
    }
  },
})
