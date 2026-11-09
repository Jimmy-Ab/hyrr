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
