import type { StateCreator } from "zustand"
import { apiFetch, isApiError } from "../../lib/api"
import { decodeJwt, toError } from "../mappers"
import { clearMessagingTimers, session, type StoreGet, type StoreSet } from "../session"
import { initializeSocket } from "../socket"
import type {
  AiChatMessage,
  CalendarEvent,
  Candidate,
  CandidateLabel,
  ChatMessage,
  ConversationThread,
  Document,
  Job,
  JobAlertItem,
  JobApplication,
  JobState,
  MyJoinRequest,
  NotificationItem,
  PublicJob,
  RegisterExtras,
  SavedSearchItem,
  TeamInvite,
  TeamJoinRequest,
  TeamMember,
  TypingState,
} from "../types"
import { emptyBillingState } from "./billing"

export type AuthSlice = Pick<
  JobState,
  | "user"
  | "accessToken"
  | "isAuthenticated"
  | "authLoading"
  | "authError"
  | "socket"
  | "liveEvent"
  | "mfaPending"
  | "loginUser"
  | "verifyTwoFactorLogin"
  | "cancelTwoFactorLogin"
  | "registerUser"
  | "refreshAuthUser"
  | "verifyEmail"
  | "resendVerification"
  | "requestPasswordReset"
  | "resetPassword"
  | "changePassword"
  | "startTwoFactorSetup"
  | "enableTwoFactor"
  | "disableTwoFactor"
  | "regenerateRecoveryCodes"
  | "exportMyData"
  | "logout"
  | "signedOutReason"
  | "signOutWithReason"
  | "clearSignedOutReason"
  | "loadAccount"
  | "deleteAccount"
  | "setAccessToken"
  | "initializeSocket"
>

/** Only the recruiter sign-up fields that are set (unknown/empty fields would be a 400). */
const cleanExtras = (extras?: RegisterExtras) =>
  Object.fromEntries(
    Object.entries(extras ?? {}).filter(([, v]) => typeof v === "string" && v.trim() !== "")
  )

const emptyWorkspace = {
  jobs: [] as Job[],
  candidates: [] as Candidate[],
  selectedJobId: "",
  team: [] as TeamMember[],
  teamInvites: [] as TeamInvite[],
  joinRequests: [] as TeamJoinRequest[],
  myJoinRequest: null as MyJoinRequest | null,
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
  matchedJobs: [] as PublicJob[],
  matchedJobsCursor: null,
  matchedJobsLoadingMore: false,
  matchTab: "for-you" as const,
  profileStrength: 0,
  profileMissing: [] as string[],
  thinProfile: false,
  alerts: [] as JobAlertItem[],
  savedSearches: [] as SavedSearchItem[],
  labels: [] as CandidateLabel[],
  labelFilter: null,
  funnelAnalytics: null,
  companyProfile: null,
  ...emptyBillingState,
}

/** Stores a login/register/2FA response and starts loading the workspace. */
function applySession(
  set: StoreSet,
  get: StoreGet,
  data: any,
  known: { email?: string; name?: string }
) {
  get().setAccessToken(data.accessToken)
  set((state) => {
    const base = state.user ?? {
      id: data.userId,
      role: data.role,
      email: "",
      name: "",
      avatar: "",
      emailVerified: true,
      twoFactorEnabled: false,
    }
    return {
      authLoading: false,
      user: {
        ...base,
        email: base.email || known.email || "",
        name: known.name ?? base.name,
        ...(typeof data.emailVerified === "boolean" ? { emailVerified: data.emailVerified } : {}),
        ...(typeof data.twoFactorEnabled === "boolean"
          ? { twoFactorEnabled: data.twoFactorEnabled }
          : {}),
      },
    }
  })
  void get().fetchInitialData()
}

export const createAuthSlice: StateCreator<JobState, [], [], AuthSlice> = (set, get) => ({
  // ── Auth initial state ───────────────────────────────────────────────────
  user: null,
  accessToken: null,
  isAuthenticated: false,
  authLoading: false,
  authError: null,
  socket: null,
  liveEvent: null,
  mfaPending: null,
  signedOutReason: null,

  signOutWithReason: async (reason) => {
    await get().logout()
    set({ signedOutReason: reason })
  },
  clearSignedOutReason: () => set({ signedOutReason: null }),

  loadAccount: async () => {
    const me = await apiFetch("/auth/me")
    if (!me) return
    set((state) =>
      state.user
        ? {
            user: {
              ...state.user,
              company: me.company
                ? {
                    id: me.company.id,
                    name: me.company.name,
                    status: me.company.status,
                    verified: !!me.company.verified,
                  }
                : null,
              supportEmail: me.supportEmail || state.user.supportEmail,
            },
          }
        : {}
    )
  },

  loginUser: async (email, password, captchaToken) => {
    set({ authLoading: true, authError: null, mfaPending: null, signedOutReason: null })
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, ...(captchaToken ? { captchaToken } : {}) }),
        skipAuth: true,
      })
      if (data?.mfaRequired && data.mfaToken) {
        set({ authLoading: false, mfaPending: { mfaToken: data.mfaToken } })
        return "MFA_REQUIRED"
      }
      applySession(set, get, data, { email })
      return true
    } catch (err) {
      if (isApiError(err) && err.errorCode === "CAPTCHA_REQUIRED") {
        set({
          authLoading: false,
          authError: "Please complete the security check and try again.",
        })
        return "CAPTCHA_REQUIRED"
      }
      set({ authError: toError(err, "Sign in failed").message, authLoading: false })
      return false
    }
  },

  verifyTwoFactorLogin: async (code) => {
    const pending = get().mfaPending
    if (!pending) {
      set({ authError: "Your sign-in expired. Please enter your password again." })
      return false
    }
    set({ authLoading: true, authError: null })
    try {
      const data = await apiFetch("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ mfaToken: pending.mfaToken, code: code.trim() }),
        skipAuth: true,
      })
      set({ mfaPending: null })
      applySession(set, get, data, {})
      return true
    } catch (err) {
      // An expired mfaToken can't be retried: send the user back to the password step.
      const expired = isApiError(err) && /EXPIRED|TOKEN/i.test(err.errorCode || "")
      set({
        authLoading: false,
        authError: expired
          ? "Your sign-in expired. Please enter your password again."
          : toError(err, "Invalid code").message,
        ...(expired ? { mfaPending: null } : {}),
      })
      return false
    }
  },

  cancelTwoFactorLogin: () => set({ mfaPending: null, authError: null }),

  registerUser: async (name, email, password, role, captchaToken, extras) => {
    set({ authLoading: true, authError: null })
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          ...(captchaToken ? { captchaToken } : {}),
          ...(role === "RECRUITER" ? cleanExtras(extras) : {}),
        }),
        skipAuth: true,
      })
      applySession(set, get, { emailVerified: false, ...data }, { email, name })
      return true
    } catch (err) {
      set({ authError: toError(err, "Registration failed").message, authLoading: false })
      return false
    }
  },

  refreshAuthUser: async () => {
    if (!get().accessToken) return
    const me = await apiFetch("/auth/me")
    if (!me) return
    set((state) =>
      state.user && (!me.id || me.id === state.user.id)
        ? {
            user: {
              ...state.user,
              name: me.name || state.user.name,
              email: me.email || state.user.email,
              avatar: me.avatar || state.user.avatar,
              emailVerified:
                typeof me.emailVerified === "boolean" ? me.emailVerified : state.user.emailVerified,
              twoFactorEnabled:
                typeof me.twoFactorEnabled === "boolean"
                  ? me.twoFactorEnabled
                  : state.user.twoFactorEnabled,
            },
          }
        : {}
    )
  },

  verifyEmail: async (token) => {
    await apiFetch("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
      skipAuth: true,
    })
    set((state) => (state.user ? { user: { ...state.user, emailVerified: true } } : {}))
    if (get().accessToken) {
      try {
        await get().refreshAuthUser()
      } catch (e) {
        console.warn("Verified, but failed to refresh the account.", e)
      }
    }
  },

  resendVerification: async () => {
    await apiFetch("/auth/resend-verification", { method: "POST" })
  },

  requestPasswordReset: async (email, captchaToken) => {
    await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, ...(captchaToken ? { captchaToken } : {}) }),
      skipAuth: true,
    })
  },

  resetPassword: async (token, password) => {
    await apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      skipAuth: true,
    })
  },

  changePassword: async (currentPassword, newPassword) => {
    const data = await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    // The server revokes older tokens; continue with the fresh one it returns.
    if (data?.accessToken) get().setAccessToken(data.accessToken)
  },

  startTwoFactorSetup: async () => {
    const data = await apiFetch("/auth/2fa/setup", { method: "POST" })
    return {
      otpauthUrl: String(data?.otpauthUrl ?? ""),
      qrDataUrl: String(data?.qrDataUrl ?? ""),
      secret: String(data?.secret ?? ""),
    }
  },

  enableTwoFactor: async (code) => {
    const data = await apiFetch("/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code: code.trim() }),
    })
    set((state) => (state.user ? { user: { ...state.user, twoFactorEnabled: true } } : {}))
    return Array.isArray(data?.recoveryCodes) ? data.recoveryCodes.map(String) : []
  },

  disableTwoFactor: async (code, password) => {
    await apiFetch("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ code: code.trim(), ...(password ? { password } : {}) }),
    })
    set((state) => (state.user ? { user: { ...state.user, twoFactorEnabled: false } } : {}))
  },

  regenerateRecoveryCodes: async (code) => {
    const data = await apiFetch("/auth/2fa/recovery-codes", {
      method: "POST",
      body: JSON.stringify({ code: code.trim() }),
    })
    return Array.isArray(data?.recoveryCodes) ? data.recoveryCodes.map(String) : []
  },

  exportMyData: async () => {
    const data = await apiFetch("/auth/account/export")
    const json = typeof data === "string" ? data : JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hyrr-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
      mfaPending: null,
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
      set({
        accessToken: null,
        isAuthenticated: false,
        user: null,
        socket: null,
        mfaPending: null,
      })
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
              // Unknown until /auth/me answers: assume verified so the banner never flashes.
              emailVerified: sameUser
                ? state.user!.emailVerified
                : typeof decoded.emailVerified === "boolean"
                  ? decoded.emailVerified
                  : true,
              twoFactorEnabled: sameUser ? state.user!.twoFactorEnabled : false,
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
