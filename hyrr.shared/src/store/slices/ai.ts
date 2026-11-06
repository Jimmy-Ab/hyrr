import type { StateCreator } from "zustand"
import { ApiError, apiFetch } from "../../lib/api"
import { toError } from "../mappers"
import type { AiChatMessage, Candidate, JobState } from "../types"

export type AiSlice = Pick<
  JobState,
  | "analyzeCandidate"
  | "aiChatMessages"
  | "aiChatLoading"
  | "aiChatOpen"
  | "sendAiChat"
  | "clearAiChat"
  | "setAiChatOpen"
>

export const createAiSlice: StateCreator<JobState, [], [], AiSlice> = (set, get) => ({
  // ── AI candidate analysis ──────────────────────────────────────────────────

  analyzeCandidate: async (candidateId) => {
    const previous = get().candidates.find((c) => c.id === candidateId)
    if (!previous) return
    const patch = (p: Partial<Candidate>) =>
      set((state) => ({
        candidates: state.candidates.map((c) => (c.id === candidateId ? { ...c, ...p } : c)),
      }))
    patch({ aiStatus: "PENDING", aiError: null })
    try {
      await apiFetch(`/applications/${candidateId}/analyze`, { method: "POST" })
      // Manual runs spend Momentum credits.
      get()
        .fetchWallet()
        .catch(() => {})
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === "AI_DISABLED") {
        patch({ aiStatus: "DISABLED", aiError: null })
        throw new ApiError({
          status: err.status,
          errorCode: err.errorCode,
          message: "AI analysis is not configured on this server.",
        })
      }
      if (err instanceof ApiError && err.errorCode === "AI_ALREADY_RUNNING") {
        // An analysis is genuinely running; keep the PENDING state.
        throw new ApiError({
          status: err.status,
          errorCode: err.errorCode,
          message: "An analysis is already running for this candidate.",
        })
      }
      patch({ aiStatus: previous.aiStatus, aiError: previous.aiError })
      throw toError(err, "Could not start the analysis")
    }
  },

  // ── AI Chat ────────────────────────────────────────────────────────────────

  aiChatMessages: [],
  aiChatLoading: false,
  aiChatOpen: false,

  sendAiChat: async (message) => {
    const history = get()
      .aiChatMessages.slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))
    const userMsg: AiChatMessage = { role: "user", content: message, timestamp: Date.now() }

    set((state) => ({
      aiChatMessages: [...state.aiChatMessages, userMsg],
      aiChatLoading: true,
    }))

    try {
      const data = await apiFetch("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message, history }),
      })
      const assistantMsg: AiChatMessage = {
        role: "assistant",
        content: data?.reply || "I'm having trouble responding right now.",
        timestamp: Date.now(),
      }
      set((state) => ({
        aiChatMessages: [...state.aiChatMessages, assistantMsg],
        aiChatLoading: false,
      }))
    } catch (err) {
      const fallback: AiChatMessage = {
        role: "assistant",
        content:
          err instanceof ApiError && err.status >= 500
            ? "The assistant is unavailable right now. Please try again later."
            : "I couldn't reach the assistant. Please check your connection and try again.",
        timestamp: Date.now(),
      }
      set((state) => ({
        aiChatMessages: [...state.aiChatMessages, fallback],
        aiChatLoading: false,
      }))
    }
  },

  clearAiChat: () => set({ aiChatMessages: [] }),
  setAiChatOpen: (open) => set({ aiChatOpen: open }),
})
