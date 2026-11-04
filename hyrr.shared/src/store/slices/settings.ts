import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import type { UserTheme } from "../../lib/contracts"
import { applyThemeClass, mapSeekerProfile, toError } from "../mappers"
import type { StoreSet } from "../session"
import type { JobState, SeekerProfileData } from "../types"
import { applyProfileStrength } from "./seekerTools"

export type SettingsSlice = Pick<
  JobState,
  "theme" | "setTheme" | "toggleTheme" | "seekerProfile" | "profileUpdating" | "updateProfile"
>

/** Loads the persisted theme (used by the initial workspace load). */
export const loadSettings = async (set: StoreSet) => {
  try {
    const settings = await apiFetch("/settings")
    const theme = settings?.theme
    if (theme === "light" || theme === "dark" || theme === "system") {
      set({ theme })
      applyThemeClass(theme)
    }
  } catch (e) {
    console.warn("Failed to load settings.", e)
  }
}

export const createSettingsSlice: StateCreator<JobState, [], [], SettingsSlice> = (set, get) => ({
  theme: "light",

  setTheme: async (theme) => {
    const previous = get().theme
    set({ theme })
    applyThemeClass(theme)
    try {
      await apiFetch("/settings", { method: "PUT", body: JSON.stringify({ theme }) })
    } catch (err) {
      set({ theme: previous })
      applyThemeClass(previous)
      throw toError(err, "Failed to save theme")
    }
  },

  toggleTheme: async () => {
    const next: UserTheme = get().theme === "dark" ? "light" : "dark"
    try {
      await get().setTheme(next)
    } catch (e) {
      console.warn("Failed to persist theme.", e)
    }
  },

  // ── Profile ──────────────────────────────────────────────────────────────
  profileUpdating: false,
  seekerProfile: null,

  updateProfile: async (data) => {
    set({ profileUpdating: true })
    try {
      const updated = await apiFetch("/profile", { method: "PUT", body: JSON.stringify(data) })
      set((state) => ({
        user: state.user
          ? {
              ...state.user,
              name: updated?.user?.name ?? data.name ?? state.user.name,
              avatar: updated?.user?.avatar ?? data.avatar ?? state.user.avatar,
            }
          : state.user,
        seekerProfile:
          state.user?.role === "SEEKER"
            ? updated && typeof updated === "object" && "skills" in updated
              ? mapSeekerProfile(updated)
              : state.seekerProfile
                ? ({ ...state.seekerProfile, ...data } as SeekerProfileData)
                : state.seekerProfile
            : state.seekerProfile,
      }))
      if (get().user?.role === "SEEKER") {
        if (typeof updated?.profileStrength === "number") applyProfileStrength(set, updated)
        else
          get()
            .refreshProfileStrength()
            .catch((e) => console.warn("Failed to refresh profile strength.", e))
        // Matches depend on the profile; the server cache is invalidated on update.
        if (get().matchedJobs.length > 0 || get().thinProfile) {
          get()
            .fetchMatchedJobs(get().matchTab)
            .catch((e) => console.warn("Failed to refresh matches.", e))
        }
      }
    } finally {
      set({ profileUpdating: false })
    }
  },
})
