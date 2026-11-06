import type { StoreApi } from "zustand"
import type { JobState } from "./types"

/** Store setter / getter as passed to every slice creator. */
export type StoreSet = StoreApi<JobState>["setState"]
export type StoreGet = StoreApi<JobState>["getState"]

// ─── Session bookkeeping (module level, not reactive) ─────────────────────────
// Single home for every timer, sequence token and in-flight promise shared between slices.
// Fields live on one mutable object so other modules can reassign them.

export const SEND_ACK_TIMEOUT_MS = 8000
export const READ_DEBOUNCE_MS = 500
export const UNREAD_DEBOUNCE_MS = 300
export const CONVERSATIONS_DEBOUNCE_MS = 300
export const TYPING_TTL_MS = 4000
export const TYPING_THROTTLE_MS = 2000
export const TYPING_IDLE_MS = 3000

export const readTimers = new Map<string, ReturnType<typeof setTimeout>>()
export const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const session: {
  initialLoad: { userId: string; promise: Promise<void> } | null
  socketAuthRetries: number
  /** Monotonic token: responses of an older openConversation call are ignored. */
  openSeq: number
  conversationsSeq: number
  unreadTimer: ReturnType<typeof setTimeout> | null
  conversationsTimer: ReturnType<typeof setTimeout> | null
  typingOut: { applicationId: string; lastEmit: number } | null
  typingIdleTimer: ReturnType<typeof setTimeout> | null
  visibilityListenerAttached: boolean
  socketConnectedOnce: boolean
} = {
  initialLoad: null,
  socketAuthRetries: 0,
  openSeq: 0,
  conversationsSeq: 0,
  unreadTimer: null,
  conversationsTimer: null,
  typingOut: null,
  typingIdleTimer: null,
  visibilityListenerAttached: false,
  socketConnectedOnce: false,
}

export class AckTimeoutError extends Error {}

export function clearMessagingTimers() {
  readTimers.forEach((t) => clearTimeout(t))
  readTimers.clear()
  typingTimers.forEach((t) => clearTimeout(t))
  typingTimers.clear()
  if (session.unreadTimer) clearTimeout(session.unreadTimer)
  if (session.conversationsTimer) clearTimeout(session.conversationsTimer)
  if (session.typingIdleTimer) clearTimeout(session.typingIdleTimer)
  session.unreadTimer = session.conversationsTimer = session.typingIdleTimer = null
  session.typingOut = null
  session.socketConnectedOnce = false
}
