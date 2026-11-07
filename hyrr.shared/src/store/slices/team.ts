import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { mapTeamMember, toError } from "../mappers"
import type { JobState, TeamInvite } from "../types"

export type TeamSlice = Pick<
  JobState,
  | "team"
  | "fetchTeam"
  | "removeTeamMember"
  | "teamInvites"
  | "joinRequests"
  | "fetchTeamInvites"
  | "fetchJoinRequests"
  | "inviteTeamMember"
  | "resendInvite"
  | "revokeInvite"
  | "approveJoinRequest"
  | "declineJoinRequest"
  | "transferOwnership"
  | "leaveTeam"
  | "setupCompany"
  | "previewInvite"
  | "acceptInvite"
  | "declineInvite"
  | "findCompanyByEmail"
  | "myJoinRequest"
  | "fetchMyJoinRequest"
  | "requestToJoin"
  | "cancelJoinRequest"
>

const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) })

export const createTeamSlice: StateCreator<JobState, [], [], TeamSlice> = (set, get) => {
  /** Company changed (joined, created, left): reload the account and the whole workspace. */
  const reloadWorkspace = async () => {
    await get().loadAccount()
    set({ team: [], teamInvites: [], joinRequests: [], myJoinRequest: null })
    if (get().user?.company) await get().fetchInitialData({ force: true })
  }

  return {
    team: [],
    teamInvites: [],
    joinRequests: [],
    myJoinRequest: null,

    fetchTeam: async () => {
      const data = await apiFetch("/talent/team")
      set({ team: (data || []).map(mapTeamMember) })
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

    fetchTeamInvites: async () => {
      const data = await apiFetch("/talent/team/invites")
      set({ teamInvites: data || [] })
    },

    fetchJoinRequests: async () => {
      const data = await apiFetch("/talent/team/join-requests")
      set({ joinRequests: data || [] })
    },

    inviteTeamMember: async (email, role) => {
      const invite: TeamInvite = await apiFetch("/talent/team/invites", json({ email, role }))
      set((state) => ({
        teamInvites: [invite, ...state.teamInvites.filter((i) => i.email !== invite.email)],
      }))
    },

    resendInvite: async (inviteId) => {
      const invite: TeamInvite = await apiFetch(`/talent/team/invites/${inviteId}/resend`, {
        method: "POST",
      })
      set((state) => ({
        teamInvites: state.teamInvites.map((i) => (i.id === inviteId ? invite : i)),
      }))
    },

    revokeInvite: async (inviteId) => {
      const previous = get().teamInvites
      set({ teamInvites: previous.filter((i) => i.id !== inviteId) })
      try {
        await apiFetch(`/talent/team/invites/${inviteId}`, { method: "DELETE" })
      } catch (err) {
        set({ teamInvites: previous })
        throw toError(err, "Could not revoke the invite")
      }
    },

    approveJoinRequest: async (requestId, role) => {
      await apiFetch(`/talent/team/join-requests/${requestId}/approve`, json({ role }))
      set((state) => ({ joinRequests: state.joinRequests.filter((r) => r.id !== requestId) }))
      await get().fetchTeam()
    },

    declineJoinRequest: async (requestId) => {
      const previous = get().joinRequests
      set({ joinRequests: previous.filter((r) => r.id !== requestId) })
      try {
        await apiFetch(`/talent/team/join-requests/${requestId}/decline`, { method: "POST" })
      } catch (err) {
        set({ joinRequests: previous })
        throw toError(err, "Could not decline the request")
      }
    },

    transferOwnership: async (memberId) => {
      await apiFetch("/talent/team/transfer", json({ memberId }))
      await get().fetchTeam()
      set({ teamInvites: [], joinRequests: [] })
    },

    leaveTeam: async () => {
      await apiFetch("/talent/team/leave", { method: "POST" })
      await reloadWorkspace()
    },

    setupCompany: async (data) => {
      await apiFetch("/team/company", json(data))
      await reloadWorkspace()
    },

    previewInvite: (token) =>
      apiFetch(`/team/invites/${encodeURIComponent(token)}`, { skipAuth: true }),

    acceptInvite: async (token) => {
      await apiFetch(`/team/invites/${encodeURIComponent(token)}/accept`, { method: "POST" })
      await reloadWorkspace()
    },

    declineInvite: async (token) => {
      await apiFetch(`/team/invites/${encodeURIComponent(token)}/decline`, { method: "POST" })
    },

    findCompanyByEmail: async (email) => {
      try {
        const data = await apiFetch(`/team/domain-match?email=${encodeURIComponent(email)}`, {
          skipAuth: true,
        })
        return data?.company ?? null
      } catch {
        // A hint only: never block sign-up on it.
        return null
      }
    },

    fetchMyJoinRequest: async () => {
      const data = await apiFetch("/team/join-request")
      set({ myJoinRequest: data?.request ?? null })
    },

    requestToJoin: async (companyId) => {
      await apiFetch("/team/join-request", json({ companyId }))
      await get().fetchMyJoinRequest()
    },

    cancelJoinRequest: async () => {
      await apiFetch("/team/join-request", { method: "DELETE" })
      set({ myJoinRequest: null })
    },
  }
}
