import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { mapTeamMember, toError } from "../mappers"
import type { JobState } from "../types"

export type TeamSlice = Pick<JobState, "team" | "fetchTeam" | "addTeamMember" | "removeTeamMember">

export const createTeamSlice: StateCreator<JobState, [], [], TeamSlice> = (set, get) => ({
  team: [],

  // ── Team ─────────────────────────────────────────────────────────────────

  fetchTeam: async () => {
    const data = await apiFetch("/talent/team")
    set({ team: (data || []).map(mapTeamMember) })
  },

  addTeamMember: async (email, role) => {
    const created = await apiFetch("/talent/team", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    })
    const member = mapTeamMember(created)
    set((state) => ({ team: [...state.team.filter((m) => m.id !== member.id), member] }))
  },

  removeTeamMember: async (memberId) => {
    const previous = get().team
    set({ team: previous.filter((m) => m.id !== memberId) })
    try {
      await apiFetch(`/talent/team/${memberId}`, { method: "DELETE" })
    } catch (err) {
      set({ team: previous })
      throw toError(err, "Failed to remove team member")
    }
  },
})
