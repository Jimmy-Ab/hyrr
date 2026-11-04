import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import {
  mapCandidate,
  mapJob,
  mapJobApplication,
  mapPublicJob,
  mapSeekerProfile,
  toError,
} from "../mappers"
import { session, type StoreGet, type StoreSet } from "../session"
import type { Candidate, Job, JobState, PublicJob } from "../types"
import { loadSettings } from "./settings"

export type BootstrapSlice = Pick<
  JobState,
  "isInitialLoading" | "initialLoadError" | "fetchInitialData"
>

const loadMe = async (set: StoreSet) => {
  const me = await apiFetch("/profile/me")
  if (!me) return me
  set((state) => ({
    user: state.user
      ? {
          ...state.user,
          name: me.name || state.user.name,
          email: me.email || state.user.email,
          avatar: me.avatar || state.user.avatar,
        }
      : state.user,
  }))
  return me
}

const loadRecruiter = async (set: StoreSet, get: StoreGet) => {
  const [dbJobs, dbCandidates] = await Promise.all([
    apiFetch("/jobs"),
    apiFetch("/applications/candidates"),
  ])
  const jobsList: Job[] = (dbJobs || []).map(mapJob)
  const candidatesList: Candidate[] = (dbCandidates || []).map(mapCandidate)
  set((state) => ({
    jobs: jobsList,
    candidates: candidatesList,
    // "" = All jobs (the board's default); keep an explicit selection while it still exists.
    selectedJobId: jobsList.some((j) => j.id === state.selectedJobId) ? state.selectedJobId : "",
  }))

  const secondary = [
    loadMe(set).then((me) => {
      if (me?.company?.name) set({ workspaceName: me.company.name })
    }),
    loadSettings(set),
    get()
      .fetchTeam()
      .catch((e) => console.warn("Failed to load team.", e)),
    get().fetchConversations(),
    get().fetchUnreadCount(),
    get().fetchEvents(),
    get().fetchNotifications(),
  ]
  await Promise.allSettled(secondary)
}

const loadSeeker = async (set: StoreSet, get: StoreGet) => {
  set({ publicJobsLoading: true })
  try {
    const [dbApps, dbDiscover] = await Promise.all([
      apiFetch("/applications/my"),
      apiFetch("/jobs/public"),
    ])
    const publicJobsList: PublicJob[] = (dbDiscover || []).map(mapPublicJob)
    set({
      jobApplications: (dbApps || []).map(mapJobApplication),
      publicJobs: publicJobsList,
    })

    const recommendations = apiFetch("/ai/featured-jobs")
      .then((recs) => set({ recommendedJobs: (recs || []).map(mapPublicJob) }))
      .catch(() => {
        // AI provider unavailable: fall back to backend-flagged featured roles.
        set({ recommendedJobs: publicJobsList.filter((job) => job.featured) })
      })

    const profile = Promise.all([loadMe(set), apiFetch("/profile")]).then(([, profileData]) => {
      if (profileData) set({ seekerProfile: mapSeekerProfile(profileData) })
    })

    await Promise.allSettled([
      recommendations,
      profile,
      loadSettings(set),
      get().fetchEvents(),
      get().fetchDocuments(),
      get().fetchConversations(),
      get().fetchUnreadCount(),
      get().fetchNotifications(),
    ])
  } finally {
    set({ publicJobsLoading: false })
  }
}

export const createBootstrapSlice: StateCreator<JobState, [], [], BootstrapSlice> = (set, get) => ({
  isInitialLoading: false,
  initialLoadError: null,

  // ── Initial data ─────────────────────────────────────────────────────────

  fetchInitialData: (options) => {
    const user = get().user
    if (!user?.role || !get().accessToken) return Promise.resolve()
    if (!options?.force && session.initialLoad && session.initialLoad.userId === user.id) {
      return session.initialLoad.promise
    }

    const run = async () => {
      set({ isInitialLoading: true, initialLoadError: null })
      try {
        if (user.role === "RECRUITER") await loadRecruiter(set, get)
        else if (user.role === "SEEKER") await loadSeeker(set, get)
        else await loadSettings(set)
        set({ isInitialLoading: false })
      } catch (err) {
        // Allow a retry via fetchInitialData({ force: true }) or a fresh call.
        if (session.initialLoad?.userId === user.id) session.initialLoad = null
        set({
          isInitialLoading: false,
          initialLoadError: toError(err, "Failed to load your workspace").message,
        })
      }
    }
    const promise = run()
    session.initialLoad = { userId: user.id, promise }
    return promise
  },
})
