import type { StateCreator } from "zustand"
import { apiFetch } from "../../lib/api"
import { decodeJwt, toError } from "../mappers"
import { clearMessagingTimers, session } from "../session"
import { initializeSocket } from "../socket"
import type {
  AiChatMessage,
  CalendarEvent,
  Candidate,
  ChatMessage,
  ConversationThread,
  Document,
  Job,
  JobApplication,
  JobState,
  NotificationItem,
  PublicJob,
  TeamMember,
  TypingState,
} from "../types"

export type AuthSlice = Pick<
  JobState,
  | "user"
  | "accessToken"
  | "isAuthenticated"
  | "authLoading"
  | "authError"
  | "socket"
  | "loginUser"
  | "registerUser"
  | "logout"
  | "deleteAccount"
  | "setAccessToken"
  | "initializeSocket"
>

const emptyWorkspace = {
  jobs: [] as Job[],
  candidates: [] as Candidate[],
  selectedJobId: "",
  team: [] as TeamMember[],
  notifications: [] as NotificationItem[],
  jobApplications: [] as JobApplication[],
  publicJobs: [] as PublicJob[],
  recommendedJobs: [] as PublicJob[],
  seekerDashboard: null,
  seekerProfile: null,
  conversations: [] as ConversationThread[],
  conversationMessages: [] as ChatMessage[],
  activeConversationId: null,
  activeThreadMeta: null,
  typingByThread: {} as Record<string, TypingState>,
  unreadMessageCount: 0,
  events: [] as CalendarEvent[],
  documents: [] as Document[],
  aiChatMessages: [] as AiChatMessage[],
  isInitialLoading: false,
  initialLoadError: null,
  searchQuery: "",
}

export const createAuthSlice: StateCreator<JobState, [], [], AuthSlice> = (set, get) => ({
  // ── Auth initial state ───────────────────────────────────────────────────
  user: null,
  accessToken: null,
  isAuthenticated: false,
  authLoading: false,
  authError: null,
  socket: null,

  loginUser: async (email, password) => {
    set({ authLoading: true, authError: null })
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      })
      get().setAccessToken(data.accessToken)
      set((state) => ({
        authLoading: false,
        user: state.user
          ? { ...state.user, email: state.user.email || email }
          : { id: data.userId, role: data.role, email, name: "", avatar: "" },
      }))
      void get().fetchInitialData()
      return true
    } catch (err) {
      set({ authError: toError(err, "Sign in failed").message, authLoading: false })
      return false
    }
  },

  registerUser: async (name, email, password, role) => {
    set({ authLoading: true, authError: null })
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
        skipAuth: true,
      })
      get().setAccessToken(data.accessToken)
      set((state) => ({
        authLoading: false,
        user: state.user
          ? { ...state.user, name, email: state.user.email || email }
          : { id: data.userId, role: data.role, email, name, avatar: "" },
      }))
      void get().fetchInitialData()
      return true
    } catch (err) {
      set({ authError: toError(err, "Registration failed").message, authLoading: false })
      return false
    }
  },

  logout: async () => {
    const s = get().socket
    if (s) {
      s.removeAllListeners()
      s.disconnect()
    }
    session.initialLoad = null
    clearMessagingTimers()
    set({
      ...emptyWorkspace,
      user: null,
      accessToken: null,
      isAuthenticated: false,
      socket: null,
    })
    try {
      await apiFetch("/auth/logout", { method: "POST", skipAuth: true })
    } catch {
      // Local session is already cleared.
    }
  },

  deleteAccount: async (password) => {
    await apiFetch("/auth/account", {
      method: "DELETE",
      body: JSON.stringify(password ? { password } : {}),
    })
    await get().logout()
  },

  setAccessToken: (token) => {
    if (!token) {
      const s = get().socket
      if (s) {
        s.removeAllListeners()
        s.disconnect()
      }
      session.initialLoad = null
      clearMessagingTimers()
      set({ accessToken: null, isAuthenticated: false, user: null, socket: null })
      return
    }
    const decoded = decodeJwt(token)
    set((state) => {
      const sameUser = !!decoded && state.user?.id === decoded.sub
      return {
        accessToken: token,
        isAuthenticated: true,
        user: decoded
          ? {
              id: decoded.sub,
              email: decoded.email || (sameUser ? state.user!.email : ""),
              name: sameUser ? state.user!.name : "",
              avatar: sameUser ? state.user!.avatar : "",
              role: decoded.role as "SEEKER" | "RECRUITER" | "ADMIN",
            }
          : state.user,
      }
    })
    // Reconnect the socket with the fresh token (auth is read lazily by the callback).
    const sock = get().socket
    if (!sock) get().initializeSocket()
    else if (!sock.connected) sock.connect()
  },

  initializeSocket: () => initializeSocket(set, get),
})
