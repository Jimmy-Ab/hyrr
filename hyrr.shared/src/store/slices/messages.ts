import type { StateCreator } from "zustand"
import { ApiError, apiFetch } from "../../lib/api"
import {
  bumpThread,
  formatDateTime,
  isVisible,
  mapMessage,
  mapThread,
  newClientId,
  toError,
  upsertMessage,
} from "../mappers"
import {
  AckTimeoutError,
  CONVERSATIONS_DEBOUNCE_MS,
  READ_DEBOUNCE_MS,
  readTimers,
  SEND_ACK_TIMEOUT_MS,
  session,
  type StoreGet,
  type StoreSet,
  TYPING_IDLE_MS,
  TYPING_THROTTLE_MS,
  UNREAD_DEBOUNCE_MS,
} from "../session"
import type { ChatMessage, ConversationThread, JobState } from "../types"

export type MessagesSlice = Pick<
  JobState,
  | "conversations"
  | "conversationsLoading"
  | "activeConversationId"
  | "activeThreadMeta"
  | "typingByThread"
  | "conversationMessages"
  | "messagesLoading"
  | "unreadMessageCount"
  | "fetchConversations"
  | "openConversation"
  | "leaveConversation"
  | "fetchMessages"
  | "markConversationRead"
  | "sendMessage"
  | "retryMessage"
  | "sendTyping"
  | "setActiveConversation"
  | "deleteConversation"
  | "fetchUnreadCount"
>

// ── Messaging helpers (also used by the socket listeners) ──────────────────

export const mySide = (get: StoreGet): "SEEKER" | "RECRUITER" =>
  get().user?.role === "SEEKER" ? "SEEKER" : "RECRUITER"

export const scheduleRead = (get: StoreGet, applicationId: string) => {
  const existing = readTimers.get(applicationId)
  if (existing) clearTimeout(existing)
  readTimers.set(
    applicationId,
    setTimeout(() => {
      readTimers.delete(applicationId)
      if (get().activeConversationId === applicationId && isVisible()) {
        void get().markConversationRead(applicationId)
      }
    }, READ_DEBOUNCE_MS)
  )
}

export const scheduleUnreadFetch = (get: StoreGet) => {
  if (session.unreadTimer) clearTimeout(session.unreadTimer)
  session.unreadTimer = setTimeout(() => {
    session.unreadTimer = null
    void get().fetchUnreadCount()
  }, UNREAD_DEBOUNCE_MS)
}

export const scheduleConversationsFetch = (get: StoreGet) => {
  if (session.conversationsTimer) clearTimeout(session.conversationsTimer)
  session.conversationsTimer = setTimeout(() => {
    session.conversationsTimer = null
    void get().fetchConversations()
  }, CONVERSATIONS_DEBOUNCE_MS)
}

const patchMessage = (set: StoreSet, clientId: string, patch: Partial<ChatMessage>) =>
  set((state) => ({
    conversationMessages: state.conversationMessages.map((m) =>
      m.clientId === clientId ? { ...m, ...patch } : m
    ),
  }))

/** Socket first (8s ack); on timeout / no connection, one REST attempt with the same clientId. */
const deliverMessage = async (
  get: StoreGet,
  applicationId: string,
  text: string,
  clientId: string
) => {
  const sock = get().socket
  if (sock?.connected) {
    try {
      const ack: any = await new Promise((resolve, reject) => {
        sock
          .timeout(SEND_ACK_TIMEOUT_MS)
          .emit(
            "send_message",
            { applicationId, text, clientId },
            (err: Error | null, res: any) => {
              if (err) reject(new AckTimeoutError("timeout"))
              else resolve(res)
            }
          )
      })
      if (ack && !ack.error && ack.id) return ack
      if (ack?.error) {
        const code = typeof ack.errorCode === "string" ? ack.errorCode : undefined
        throw new ApiError({
          status:
            code === "CONVERSATION_CLOSED"
              ? 409
              : code === "FORBIDDEN"
                ? 403
                : code === "NOT_FOUND"
                  ? 404
                  : 400,
          errorCode: code,
          message: typeof ack.error === "string" ? ack.error : "Message could not be sent.",
        })
      }
      // Malformed ack: fall through to REST (idempotent on clientId).
    } catch (err) {
      if (!(err instanceof AckTimeoutError)) throw err
    }
  }
  return apiFetch(`/messages/${applicationId}`, {
    method: "POST",
    body: JSON.stringify({ text, clientId }),
  })
}

const runSend = async (
  set: StoreSet,
  get: StoreGet,
  applicationId: string,
  text: string,
  clientId: string
) => {
  try {
    const saved = await deliverMessage(get, applicationId, text, clientId)
    const msg = mapMessage({ ...saved, clientId: saved?.clientId ?? clientId })
    const state = get()
    const fallback =
      state.activeThreadMeta?.applicationId === applicationId ? state.activeThreadMeta : null
    set((s) => ({
      conversationMessages:
        s.activeConversationId === applicationId
          ? upsertMessage(s.conversationMessages, msg)
          : s.conversationMessages,
      conversations: bumpThread(
        s.conversations,
        applicationId,
        (t) => ({
          ...t,
          lastMessage: msg.text,
          lastMessageAt: msg.createdAt,
          lastMessageTime: formatDateTime(msg.createdAt),
        }),
        fallback
      ),
    }))
    if (!get().conversations.some((c) => c.applicationId === applicationId)) {
      scheduleConversationsFetch(get)
    }
  } catch (err) {
    patchMessage(set, clientId, { status: "failed" })
    if (err instanceof ApiError && err.errorCode === "CONVERSATION_CLOSED") {
      const close = (t: ConversationThread): ConversationThread => ({
        ...t,
        canSend: false,
        closedReason: t.closedReason ?? "WITHDRAWN",
      })
      set((s) => ({
        activeThreadMeta:
          s.activeThreadMeta?.applicationId === applicationId
            ? close(s.activeThreadMeta)
            : s.activeThreadMeta,
        conversations: s.conversations.map((c) =>
          c.applicationId === applicationId ? close(c) : c
        ),
      }))
    }
    throw toError(err, "Message could not be sent.")
  }
}

export const createMessagesSlice: StateCreator<JobState, [], [], MessagesSlice> = (set, get) => ({
  // ── Messages ───────────────────────────────────────────────────────────────

  conversations: [],
  conversationsLoading: false,
  activeConversationId: null,
  activeThreadMeta: null,
  typingByThread: {},
  conversationMessages: [],
  messagesLoading: false,
  unreadMessageCount: 0,

  fetchConversations: async () => {
    const seq = ++session.conversationsSeq
    set({ conversationsLoading: true })
    try {
      const data = await apiFetch("/messages/conversations")
      if (seq !== session.conversationsSeq) return
      const activeId = get().activeConversationId
      const seenNow = !!activeId && isVisible()
      const mapped: ConversationThread[] = (Array.isArray(data) ? data : [])
        .filter((t: any) => t && t.applicationId)
        .map(mapThread)
        .map((t: ConversationThread) =>
          seenNow && t.applicationId === activeId ? { ...t, unreadCount: 0 } : t
        )
      set({ conversations: mapped })
    } catch (e) {
      console.warn("Failed to load conversations.", e)
    } finally {
      if (seq === session.conversationsSeq) set({ conversationsLoading: false })
    }
  },

  openConversation: async (applicationId) => {
    const state = get()
    const previousId = state.activeConversationId
    const sock = state.socket
    const switching = previousId !== applicationId
    if (switching && previousId) {
      if (sock?.connected) sock.emit("leave_chat", { applicationId: previousId })
      if (session.typingOut?.applicationId === previousId) get().sendTyping(previousId, false)
    }
    const known = state.conversations.find((c) => c.applicationId === applicationId) ?? null
    set((s) => ({
      activeConversationId: applicationId,
      activeThreadMeta: switching ? known : (s.activeThreadMeta ?? known),
      messagesLoading: true,
      ...(switching ? { conversationMessages: [] } : {}),
      // Optimistically clear the badge for the thread being opened.
      conversations: s.conversations.map((c) =>
        c.applicationId === applicationId ? { ...c, unreadCount: 0 } : c
      ),
    }))
    if (sock?.connected) sock.emit("join_chat", { applicationId })

    const seq = ++session.openSeq
    try {
      const [meta, messages] = await Promise.all([
        apiFetch(`/messages/${applicationId}/meta`),
        apiFetch(`/messages/${applicationId}`),
      ])
      if (seq !== session.openSeq || get().activeConversationId !== applicationId) return
      const metaThread = meta ? mapThread({ applicationId, ...meta }) : null
      const fetched: ChatMessage[] = (Array.isArray(messages) ? messages : []).map(mapMessage)
      set((s) => {
        // Keep local pending/failed sends and socket messages that arrived meanwhile.
        const fetchedIds = new Set(fetched.map((m) => m.id))
        const fetchedClientIds = new Set(fetched.map((m) => m.clientId).filter(Boolean))
        const extras = s.conversationMessages.filter(
          (m) =>
            m.applicationId === applicationId &&
            !fetchedIds.has(m.id) &&
            !(m.clientId && fetchedClientIds.has(m.clientId))
        )
        return {
          conversationMessages: [...fetched, ...extras],
          activeThreadMeta: metaThread
            ? { ...metaThread, unreadCount: 0 }
            : (s.activeThreadMeta ?? null),
          conversations: metaThread
            ? s.conversations.map((c) =>
                c.applicationId === applicationId
                  ? {
                      ...c,
                      candidateName: metaThread.candidateName,
                      candidateAvatar: metaThread.candidateAvatar,
                      status: metaThread.status,
                      isGuest: metaThread.isGuest,
                      canSend: metaThread.canSend,
                      closedReason: metaThread.closedReason,
                      unreadCount: 0,
                    }
                  : c
              )
            : s.conversations,
        }
      })
    } catch (err) {
      if (seq === session.openSeq && get().activeConversationId === applicationId) {
        // Thread is gone or not accessible: close it instead of showing an empty shell.
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          get().leaveConversation()
        } else {
          set({ messagesLoading: false })
        }
      }
      throw toError(err, "Failed to load messages")
    }
    if (seq === session.openSeq) set({ messagesLoading: false })
    await get().markConversationRead(applicationId)
  },

  leaveConversation: () => {
    const previousId = get().activeConversationId
    session.openSeq += 1
    if (previousId) {
      if (session.typingOut?.applicationId === previousId) get().sendTyping(previousId, false)
      const sock = get().socket
      if (sock?.connected) sock.emit("leave_chat", { applicationId: previousId })
      const timer = readTimers.get(previousId)
      if (timer) clearTimeout(timer)
      readTimers.delete(previousId)
    }
    set({
      activeConversationId: null,
      activeThreadMeta: null,
      conversationMessages: [],
      messagesLoading: false,
    })
  },

  fetchMessages: (applicationId) => get().openConversation(applicationId),

  markConversationRead: async (applicationId) => {
    try {
      const res = await apiFetch(`/messages/${applicationId}/read`, { method: "POST" })
      set((s) => ({
        unreadMessageCount:
          typeof res?.unreadCount === "number" ? res.unreadCount : s.unreadMessageCount,
        conversations: s.conversations.map((c) =>
          c.applicationId === applicationId ? { ...c, unreadCount: 0 } : c
        ),
      }))
    } catch (e) {
      console.warn("Failed to mark conversation read.", e)
    }
  },

  sendMessage: async (applicationId, text) => {
    const body = text.trim()
    if (!body) return
    const user = get().user
    const clientId = newClientId()
    if (session.typingOut?.applicationId === applicationId) get().sendTyping(applicationId, false)
    const optimistic: ChatMessage = {
      id: `temp-${clientId}`,
      applicationId,
      senderId: user?.id || null,
      senderType:
        user?.role === "SEEKER" ? "SEEKER" : user?.role === "ADMIN" ? "ADMIN" : "RECRUITER",
      senderName: user?.name || undefined,
      senderRole: user?.role,
      clientId,
      status: "sending",
      text: body,
      read: false,
      createdAt: new Date().toISOString(),
    }
    if (get().activeConversationId === applicationId) {
      set((s) => ({ conversationMessages: [...s.conversationMessages, optimistic] }))
    }
    await runSend(set, get, applicationId, body, clientId)
  },

  retryMessage: async (applicationId, clientId) => {
    const msg = get().conversationMessages.find((m) => m.clientId === clientId)
    if (!msg || msg.status === "sending") return
    patchMessage(set, clientId, { status: "sending", createdAt: new Date().toISOString() })
    await runSend(set, get, applicationId, msg.text, clientId)
  },

  sendTyping: (applicationId, isTyping) => {
    const sock = get().socket
    const emit = (value: boolean) => {
      if (sock?.connected) sock.emit("typing", { applicationId, isTyping: value })
    }
    if (session.typingIdleTimer) clearTimeout(session.typingIdleTimer)
    session.typingIdleTimer = null
    if (!isTyping) {
      if (session.typingOut?.applicationId === applicationId) emit(false)
      if (session.typingOut?.applicationId === applicationId) session.typingOut = null
      return
    }
    const now = Date.now()
    if (session.typingOut && session.typingOut.applicationId !== applicationId) {
      if (sock?.connected) {
        sock.emit("typing", { applicationId: session.typingOut.applicationId, isTyping: false })
      }
      session.typingOut = null
    }
    if (!session.typingOut || now - session.typingOut.lastEmit >= TYPING_THROTTLE_MS) {
      emit(true)
      session.typingOut = { applicationId, lastEmit: now }
    }
    // Stop the indicator after a pause in typing.
    session.typingIdleTimer = setTimeout(
      () => get().sendTyping(applicationId, false),
      TYPING_IDLE_MS
    )
  },

  setActiveConversation: (id) => {
    if (id) {
      void get()
        .openConversation(id)
        .catch((e) => console.warn("Failed to open conversation.", e))
    } else {
      get().leaveConversation()
    }
  },

  deleteConversation: async (applicationId) => {
    const prev = {
      conversations: get().conversations,
      activeConversationId: get().activeConversationId,
      activeThreadMeta: get().activeThreadMeta,
      conversationMessages: get().conversationMessages,
    }
    const wasActive = prev.activeConversationId === applicationId
    if (wasActive) {
      session.openSeq += 1
      const sock = get().socket
      if (sock?.connected) sock.emit("leave_chat", { applicationId })
    }
    set((state) => ({
      conversations: state.conversations.filter((c) => c.applicationId !== applicationId),
      ...(wasActive
        ? { activeConversationId: null, activeThreadMeta: null, conversationMessages: [] }
        : {}),
    }))
    try {
      await apiFetch(`/messages/conversations/${applicationId}`, { method: "DELETE" })
      scheduleUnreadFetch(get)
    } catch (err) {
      set(prev)
      if (wasActive) {
        const sock = get().socket
        if (sock?.connected) sock.emit("join_chat", { applicationId })
      }
      throw toError(err, "Failed to delete conversation")
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await apiFetch("/messages/unread-count")
      set({ unreadMessageCount: typeof data?.count === "number" ? data.count : 0 })
    } catch (e) {
      console.warn("Failed to load unread count.", e)
    }
  },
})
