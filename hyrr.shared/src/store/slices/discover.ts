import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import type { JobState } from "../types"

export type DiscoverSlice = Pick<
  JobState,
  | "publicJobs"
  | "recommendedJobs"
  | "publicJobsLoading"
  | "discoverSearch"
  | "discoverTypeFilter"
  | "setDiscoverSearch"
  | "setDiscoverTypeFilter"
  | "reportJob"
>

export const createDiscoverSlice: StateCreator<JobState, [], [], DiscoverSlice> = (set) => ({
  publicJobs: [],
  recommendedJobs: [],
  publicJobsLoading: false,
  discoverSearch: "",
  discoverTypeFilter: "All",
  setDiscoverSearch: (q) => set({ discoverSearch: q }),
  setDiscoverTypeFilter: (t) => set({ discoverTypeFilter: t }),

  reportJob: async (jobId, reason, details) => {
    const trimmed = details?.trim()
    await apiFetch(`/talent/jobs/${encodeURIComponent(jobId)}/report`, {
      method: "POST",
      body: JSON.stringify({ reason, ...(trimmed ? { details: trimmed } : {}) }),
    })
  },
})
