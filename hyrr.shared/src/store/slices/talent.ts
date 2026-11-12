import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { mapCandidate, toError } from "../mappers"
import type { JobState } from "../types"

export type TalentSlice = Pick<
  JobState,
  | "searchTalent"
  | "fetchTalentProfile"
  | "reachOut"
  | "talentVisibility"
  | "fetchTalentVisibility"
  | "setTalentVisibility"
  | "unblockCompany"
  | "respondToOutreach"
  | "blockOutreachCompany"
>

const post = (body?: unknown) => ({
  method: "POST",
  ...(body ? { body: JSON.stringify(body) } : {}),
})

export const createTalentSlice: StateCreator<JobState, [], [], TalentSlice> = (set, get) => ({
  // ── Recruiter: search opted-in seekers and reach out ────────────────────
  searchTalent: (q, location) => {
    const params = new URLSearchParams()
    if (q?.trim()) params.set("q", q.trim())
    if (location?.trim()) params.set("location", location.trim())
    return apiFetch(`/talent-search?${params.toString()}`)
  },

  fetchTalentProfile: (seekerId) => apiFetch(`/talent-search/${seekerId}`),

  reachOut: async (seekerId, jobId, message) => {
    const res = await apiFetch(`/talent-search/${seekerId}/outreach`, post({ jobId, message }))
    if (res?.candidate) {
      const candidate = mapCandidate(res.candidate)
      set((state) => ({
        candidates: [candidate, ...state.candidates.filter((c) => c.id !== candidate.id)],
      }))
    }
    // The outreach cost was debited from the company wallet.
    void get()
      .fetchWallet()
      .catch(() => undefined)
  },

  // ── Seeker: visibility, answers, blocking ────────────────────────────────
  talentVisibility: null,

  fetchTalentVisibility: async () => {
    set({ talentVisibility: await apiFetch("/talent-search/visibility") })
  },

  setTalentVisibility: async (open) => {
    const previous = get().talentVisibility
    set({ talentVisibility: { ...(previous ?? { blockedCompanies: [] }), open } })
    try {
      set({
        talentVisibility: await apiFetch("/talent-search/visibility", {
          method: "PUT",
          body: JSON.stringify({ open }),
        }),
      })
    } catch (err) {
      set({ talentVisibility: previous })
      throw toError(err, "Could not update your visibility")
    }
  },

  unblockCompany: async (companyId) => {
    await apiFetch(`/talent-search/companies/${companyId}/block`, { method: "DELETE" })
    await get().fetchTalentVisibility()
  },

  respondToOutreach: async (applicationId, interested) => {
    const res = await apiFetch(
      `/talent-search/outreach/${applicationId}/respond`,
      post({ interested })
    )
    set((state) => ({
      jobApplications: state.jobApplications.map((a) =>
        a.id === applicationId ? { ...a, status: res.status, tag: res.tag } : a
      ),
    }))
  },

  blockOutreachCompany: async (applicationId) => {
    await apiFetch(`/talent-search/outreach/${applicationId}/block`, post())
    await get().fetchApplications()
  },
})
