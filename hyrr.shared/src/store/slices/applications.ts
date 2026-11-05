import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { APPLICATION_STATUS, isApplicationStatus } from "../../lib/contracts"
import { mapJobApplication, toError } from "../mappers"
import type { StoreGet } from "../session"
import type { ApplyInput, JobState } from "../types"

export type ApplicationsSlice = Pick<
  JobState,
  | "jobApplications"
  | "seekerDashboard"
  | "fetchSeekerDashboard"
  | "fetchApplications"
  | "applyToJob"
  | "applyFromDiscover"
  | "saveJobFromDiscover"
  | "toggleJobBookmark"
  | "withdrawApplication"
>

/** Ensures the seeker application payload sent to /apply satisfies the DTO. */
const applicantBody = (get: StoreGet, input: ApplyInput = {}) => {
  const user = get().user
  const profile = get().seekerProfile
  return {
    name: user?.name || user?.email?.split("@")[0] || "Applicant",
    email: user?.email || "",
    title: profile?.title || "Job Seeker",
    location: profile?.location || "Remote",
    ...(input.phone || profile?.phone ? { phone: input.phone || profile?.phone } : {}),
    ...(input.coverLetter ? { coverLetter: input.coverLetter } : {}),
    ...(input.resumeUrl ? { resumeUrl: input.resumeUrl } : {}),
    ...(input.answers?.length
      ? {
          answers: input.answers
            .map((a) => ({ questionId: a.questionId, answer: a.answer.trim() }))
            .filter((a) => a.answer),
        }
      : {}),
  }
}

export const createApplicationsSlice: StateCreator<JobState, [], [], ApplicationsSlice> = (
  set,
  get
) => ({
  seekerDashboard: null,
  jobApplications: [],

  fetchSeekerDashboard: async () => {
    try {
      const dashboard = await apiFetch("/dashboard/seeker")
      set({ seekerDashboard: dashboard })
    } catch (e) {
      console.warn("Failed to load seeker dashboard.", e)
    }
  },

  // ── Seeker actions ─────────────────────────────────────────────────────────

  fetchApplications: async () => {
    const dbApps = await apiFetch("/applications/my")
    set({ jobApplications: (dbApps || []).map(mapJobApplication) })
  },

  applyToJob: async (jobId, input = {}) => {
    await apiFetch(`/applications/jobs/${jobId}/apply`, {
      method: "POST",
      body: JSON.stringify(applicantBody(get, input)),
    })
    // The apply response is seeker-safe but lacks job relations; reload the list (and the balance).
    try {
      await Promise.all([get().fetchApplications(), get().fetchWallet()])
    } catch (e) {
      console.warn("Applied, but failed to refresh applications.", e)
    }
  },

  applyFromDiscover: async (publicJobId, input) => get().applyToJob(publicJobId, input),

  saveJobFromDiscover: async (publicJobId) => {
    await apiFetch(`/applications/jobs/${publicJobId}/save`, {
      method: "POST",
      body: JSON.stringify(applicantBody(get)),
    })
    try {
      await get().fetchApplications()
    } catch (e) {
      console.warn("Saved, but failed to refresh applications.", e)
    }
  },

  toggleJobBookmark: async (id) => {
    const app = get().jobApplications.find((a) => a.id === id)
    if (!app) return
    const setFlag = (value: boolean) =>
      set((state) => ({
        jobApplications: state.jobApplications.map((a) =>
          a.id === id ? { ...a, bookmarked: value } : a
        ),
      }))
    setFlag(!app.bookmarked)
    try {
      await apiFetch(`/applications/${id}`, {
        method: "PUT",
        body: JSON.stringify({ seekerBookmarked: !app.bookmarked }),
      })
    } catch (err) {
      setFlag(app.bookmarked)
      throw toError(err, "Failed to update bookmark")
    }
  },

  withdrawApplication: async (applicationId) => {
    const previous = get().jobApplications
    const app = previous.find((a) => a.id === applicationId)
    if (!app) return
    const isSaved = app.status === APPLICATION_STATUS.SAVED
    set({
      jobApplications: isSaved
        ? previous.filter((a) => a.id !== applicationId)
        : previous.map((a) =>
            a.id === applicationId
              ? {
                  ...a,
                  status: APPLICATION_STATUS.WITHDRAWN,
                  updatedAt: new Date().toISOString(),
                }
              : a
          ),
    })
    try {
      const res = await apiFetch(`/applications/${applicationId}`, { method: "DELETE" })
      if (res?.deleted) {
        set((state) => ({
          jobApplications: state.jobApplications.filter((a) => a.id !== applicationId),
        }))
      } else if (isApplicationStatus(res?.status)) {
        set((state) => ({
          jobApplications: state.jobApplications.map((a) =>
            a.id === applicationId ? { ...a, status: res.status } : a
          ),
        }))
      }
    } catch (err) {
      set({ jobApplications: previous })
      throw toError(err, "Failed to withdraw application")
    }
  },
})
