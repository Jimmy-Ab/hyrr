import type { StateCreator } from "zustand"
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
>

export const createDiscoverSlice: StateCreator<JobState, [], [], DiscoverSlice> = (set) => ({
  publicJobs: [],
  recommendedJobs: [],
  publicJobsLoading: false,
  discoverSearch: "",
  discoverTypeFilter: "All",
  setDiscoverSearch: (q) => set({ discoverSearch: q }),
  setDiscoverTypeFilter: (t) => set({ discoverTypeFilter: t }),
})
