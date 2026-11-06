import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { applicationStatusCode } from "../../lib/contracts"
import { mapCandidate, toError } from "../mappers"
import type { JobState } from "../types"

export type CandidatesSlice = Pick<
  JobState,
  "candidates" | "moveCandidate" | "addCandidate" | "toggleBookmark" | "deleteCandidate"
>

export const createCandidatesSlice: StateCreator<JobState, [], [], CandidatesSlice> = (
  set,
  get
) => ({
  candidates: [],

  moveCandidate: async (candidateId, targetStatus) => {
    const previous = get().candidates.find((c) => c.id === candidateId)
    if (!previous) return
    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === candidateId ? { ...c, status: targetStatus } : c
      ),
    }))
    try {
      const updated = await apiFetch(`/applications/${candidateId}`, {
        method: "PUT",
        body: JSON.stringify({ status: applicationStatusCode(targetStatus) }),
      })
      if (updated?.id) {
        const merged = mapCandidate(updated)
        set((state) => ({
          candidates: state.candidates.map((c) =>
            c.id === candidateId
              ? {
                  ...c,
                  status: merged.status,
                  tag: merged.tag,
                  aiScore: updated.aiScore !== undefined ? merged.aiScore : c.aiScore,
                  aiSummary: merged.aiSummary ?? c.aiSummary,
                }
              : c
          ),
        }))
      }
    } catch (err) {
      set((state) => ({
        candidates: state.candidates.map((c) => (c.id === candidateId ? previous : c)),
      }))
      throw toError(err, "Failed to update candidate status")
    }
  },

  addCandidate: async (jobId, input) => {
    const created = await apiFetch(`/applications/jobs/${jobId}/candidates`, {
      method: "POST",
      body: JSON.stringify({
        candidateName: input.name,
        email: input.email,
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(input.location ? { location: input.location } : {}),
        ...(input.status ? { status: applicationStatusCode(input.status) } : {}),
      }),
    })
    const candidate = mapCandidate({ jobId, ...created, name: created?.name || input.name })
    set((state) => ({
      candidates: [candidate, ...state.candidates.filter((c) => c.id !== candidate.id)],
    }))
    return candidate
  },

  toggleBookmark: async (candidateId) => {
    const candidate = get().candidates.find((c) => c.id === candidateId)
    if (!candidate) return
    const isBookmarked = !candidate.bookmarked
    const setFlag = (value: boolean) =>
      set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === candidateId ? { ...c, bookmarked: value } : c
        ),
      }))
    setFlag(isBookmarked)
    try {
      await apiFetch(`/applications/${candidateId}`, {
        method: "PUT",
        body: JSON.stringify({ recruiterBookmarked: isBookmarked }),
      })
    } catch (err) {
      setFlag(candidate.bookmarked)
      throw toError(err, "Failed to update bookmark")
    }
  },

  deleteCandidate: async (candidateId) => {
    const previous = get().candidates
    set({ candidates: previous.filter((c) => c.id !== candidateId) })
    try {
      await apiFetch(`/applications/${candidateId}`, { method: "DELETE" })
    } catch (err) {
      set({ candidates: previous })
      throw toError(err, "Failed to delete candidate")
    }
  },
})
