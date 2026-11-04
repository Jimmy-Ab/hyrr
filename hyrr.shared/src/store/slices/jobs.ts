import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { employmentTypeCode, employmentTypeLabel, type JobType } from "../../lib/contracts"
import { mapJob, toError } from "../mappers"
import type { JobState } from "../types"

export type JobsSlice = Pick<
  JobState,
  "jobs" | "selectedJobId" | "selectJob" | "addJob" | "updateJob" | "deleteJob"
>

export const createJobsSlice: StateCreator<JobState, [], [], JobsSlice> = (set, get) => ({
  jobs: [],
  selectedJobId: "",

  selectJob: (jobId) => set({ selectedJobId: jobId }),

  addJob: async (jobData) => {
    const dbJob = await apiFetch("/jobs", {
      method: "POST",
      body: JSON.stringify({
        title: jobData.title,
        location: jobData.location,
        type: employmentTypeCode(jobData.type as JobType),
        salary: jobData.salary,
        description: jobData.description,
        requirements: jobData.requirements,
        skills: jobData.skills,
        benefits: jobData.benefits ?? [],
        categoryId: jobData.categoryId,
        featured: jobData.featured ?? false,
        remote: jobData.remote ?? false,
        ...(jobData.status ? { status: jobData.status } : {}),
      }),
    })
    const newJob = mapJob({
      ...dbJob,
      description: dbJob?.description || jobData.description,
      requirements: dbJob?.requirements || jobData.requirements,
    })
    // Keep the board's current filter: jumping to the new (empty) job hid every candidate.
    set((state) => ({ jobs: [...state.jobs, newJob] }))
    return newJob
  },

  updateJob: async (jobId, patch) => {
    const previous = get().jobs.find((j) => j.id === jobId)
    const body: Record<string, unknown> = { ...patch }
    if (patch.employmentType) {
      body.employmentType =
        employmentTypeCode(patch.employmentType as JobType) || patch.employmentType
    }
    if (previous) {
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
                ...(patch.location !== undefined ? { location: patch.location } : {}),
                ...(patch.requirements !== undefined ? { requirements: patch.requirements } : {}),
                ...(patch.employmentType !== undefined
                  ? { type: employmentTypeLabel(patch.employmentType as JobType) }
                  : {}),
                ...(patch.status !== undefined
                  ? { status: mapJob({ status: patch.status }).status }
                  : {}),
              }
            : j
        ),
      }))
    }
    try {
      const updated = await apiFetch(`/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
      if (updated?.id) {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? { ...j, ...mapJob({ ...updated, color: updated.color || j.color }) }
              : j
          ),
        }))
      }
    } catch (err) {
      if (previous) {
        set((state) => ({ jobs: state.jobs.map((j) => (j.id === jobId ? previous : j)) }))
      }
      throw toError(err, "Failed to update job")
    }
  },

  deleteJob: async (jobId) => {
    const prevJobs = get().jobs
    const prevCandidates = get().candidates
    const prevSelected = get().selectedJobId
    set((state) => {
      const jobs = state.jobs.filter((j) => j.id !== jobId)
      return {
        jobs,
        candidates: state.candidates.filter((c) => c.jobId !== jobId),
        selectedJobId: state.selectedJobId === jobId ? "" : state.selectedJobId,
      }
    })
    try {
      await apiFetch(`/jobs/${jobId}`, { method: "DELETE" })
    } catch (err) {
      set({ jobs: prevJobs, candidates: prevCandidates, selectedJobId: prevSelected })
      throw toError(err, "Failed to delete job")
    }
  },
})
