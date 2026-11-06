import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { mapNotification, toError } from "../mappers"
import type { JobState } from "../types"

export type NotificationsSlice = Pick<
  JobState,
  | "notifications"
  | "fetchNotifications"
  | "markAllNotificationsRead"
  | "markNotificationsAsRead"
  | "markNotificationRead"
  | "clearNotifications"
>

export const createNotificationsSlice: StateCreator<JobState, [], [], NotificationsSlice> = (
  set,
  get
) => ({
  notifications: [],

  // ── Notifications ──────────────────────────────────────────────────────────

  fetchNotifications: async () => {
    try {
      const data = await apiFetch("/notifications")
      set({ notifications: (data || []).map(mapNotification) })
    } catch (e) {
      console.warn("Failed to load notifications.", e)
    }
  },

  markAllNotificationsRead: async () => {
    const previous = get().notifications
    set({ notifications: previous.map((n) => ({ ...n, read: true })) })
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" })
    } catch (err) {
      set({ notifications: previous })
      throw toError(err, "Failed to mark notifications as read")
    }
  },

  markNotificationsAsRead: async () => get().markAllNotificationsRead(),

  markNotificationRead: async (id) => {
    const previous = get().notifications
    if (!previous.some((n) => n.id === id && !n.read)) return
    set({ notifications: previous.map((n) => (n.id === id ? { ...n, read: true } : n)) })
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" })
    } catch (err) {
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: false } : n)),
      }))
      throw toError(err, "Failed to mark notification as read")
    }
  },

  clearNotifications: async () => {
    const previous = get().notifications
    set({ notifications: [] })
    try {
      await apiFetch("/notifications", { method: "DELETE" })
    } catch (err) {
      set({ notifications: previous })
      throw toError(err, "Failed to clear notifications")
    }
  },
})
