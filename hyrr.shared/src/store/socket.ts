import { io } from "socket.io-client"
import { apiFetch } from "../lib/api"
import { SOCKET_URL } from "../lib/config"
import {
  type ApplicationStatusCode,
  applicationStatusLabel,
  isAiStatus,
  isApplicationStatus,
} from "../lib/contracts"
import {
  bumpThread,
  formatDateTime,
  isVisible,
  mapAiAnalysis,
  mapCandidate,
  mapMessage,
  mapNotification,
  upsertMessage,
} from "./mappers"
import { session, type StoreGet, type StoreSet, TYPING_TTL_MS, typingTimers } from "./session"
import {
  mySide,
  scheduleConversationsFetch,
  scheduleRead,
  scheduleUnreadFetch,
} from "./slices/messages"

/** Body of the `initializeSocket` action: creates the socket and wires every listener. */
export function initializeSocket(set: StoreSet, get: StoreGet) {
  if (!get().accessToken) return
  const existing = get().socket
  if (existing) {
    if (!existing.connected) existing.connect()
    return
  }

  const socket = io(SOCKET_URL, {
    // Callback form: every (re)connect uses the current access token.
    auth: (cb) => cb({ token: get().accessToken }),
    withCredentials: true,
    transports: ["websocket", "polling"],
  })

  socket.on("connect", () => {
    session.socketAuthRetries = 0
    const activeAppId = get().activeConversationId
    if (activeAppId) socket.emit("join_chat", { applicationId: activeAppId })
    if (session.socketConnectedOnce) {
      // Reconnected: catch up on anything missed while offline.
      if (activeAppId)
        void get()
          .openConversation(activeAppId)
          .catch(() => {})
      scheduleConversationsFetch(get)
      scheduleUnreadFetch(get)
    }
    session.socketConnectedOnce = true
  })

  if (!session.visibilityListenerAttached && typeof document !== "undefined") {
    session.visibilityListenerAttached = true
    document.addEventListener("visibilitychange", () => {
      const activeId = get().activeConversationId
      if (activeId && isVisible() && get().isAuthenticated) {
        void get().markConversationRead(activeId)
      }
    })
  }

  // The server disconnects sockets with an expired/invalid token. Refresh once and retry.
  const recoverAuth = () => {
    if (!get().accessToken || session.socketAuthRetries >= 2) return
    session.socketAuthRetries += 1
    apiFetch("/auth/me")
      .then(() => {
        const s = get().socket
        if (s && !s.connected) s.connect()
      })
      .catch(() => {})
  }
  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") recoverAuth()
  })
  socket.on("connect_error", (err: Error) => {
    if (/auth|token|jwt|unauthor/i.test(err?.message || "")) recoverAuth()
  })

  socket.on("candidate_applied", (data: any) => {
    const raw = data?.candidate
    if (!raw?.id || get().user?.role !== "RECRUITER") return
    // The recruiter who added it already has it (optimistic add).
    if (data.actorId && data.actorId === get().user?.id) return
    const candidate = mapCandidate(raw)
    const known = get().candidates.some((c) => c.id === candidate.id)
    set((state) => ({
      candidates: known
        ? state.candidates.map((c) => (c.id === candidate.id ? { ...c, ...candidate } : c))
        : [candidate, ...state.candidates],
      ...(known
        ? {}
        : {
            liveEvent: {
              kind: "applicant" as const,
              id: candidate.id,
              name: candidate.name,
              jobTitle: state.jobs.find((j) => j.id === candidate.jobId)?.title ?? "",
              at: Date.now(),
            },
          }),
    }))
  })

  socket.on("interview_invite_received", (data: any) => {
    if (!data?.id) return
    get().upsertInterviewInvite(data)
    set({
      liveEvent: {
        kind: "interview_invite",
        id: data.id,
        jobTitle: data.jobTitle ?? "",
        companyName: data.companyName ?? undefined,
        at: Date.now(),
      },
    })
  })

  socket.on("outreach_received", (data: any) => {
    if (!data?.applicationId) return
    void get()
      .fetchApplications()
      .catch(() => undefined)
    void get()
      .fetchConversations()
      .catch(() => undefined)
    set({
      liveEvent: {
        kind: "outreach",
        applicationId: data.applicationId,
        companyName: data.companyName ?? "A company",
        jobTitle: data.jobTitle ?? "",
        at: Date.now(),
      },
    })
  })

  socket.on("offer_extended", (data: any) => {
    if (!data?.id) return
    get().upsertOffer(data)
    set({
      liveEvent: {
        kind: "offer",
        id: data.id,
        jobTitle: data.jobTitle ?? "",
        companyName: data.companyName ?? undefined,
        at: Date.now(),
      },
    })
  })

  socket.on("offer_updated", (data: any) => {
    if (data?.id) get().upsertOffer(data)
  })

  for (const [event, accepted] of [
    ["offer_accepted", true],
    ["offer_declined", false],
  ] as const)
    socket.on(event, (data: any) => {
      if (!data?.id) return
      get().upsertOffer(data)
      set({
        liveEvent: {
          kind: "offer_answered",
          id: data.id,
          accepted,
          name: data.candidateName ?? "The candidate",
          jobTitle: data.jobTitle ?? "",
          at: Date.now(),
        },
      })
    })

  socket.on("scorecard_submitted", (data: any) => {
    if (!data?.applicationId || data.interviewerId === get().user?.id) return
    set({ liveEvent: { kind: "scorecard", applicationId: data.applicationId, at: Date.now() } })
  })

  socket.on("interview_invite_updated", (data: any) => {
    if (data?.id) get().upsertInterviewInvite(data)
  })

  socket.on("calendar_event_confirmed", (data: any) => {
    if (!data?.invite?.id) return
    const known = get().events.some((e) => e.id === data.event?.id)
    get().upsertInterviewInvite(data.invite, data.event)
    if (!known && data.event?.startTime)
      set({
        liveEvent: {
          kind: "interview_booked",
          id: data.invite.id,
          title: data.invite.title,
          who:
            get().user?.role === "RECRUITER"
              ? (data.invite.candidateName ?? "The candidate")
              : (data.invite.companyName ?? "The hiring team"),
          startTime: data.event.startTime,
          at: Date.now(),
        },
      })
  })

  socket.on("job_moderated", (data: any) => {
    if (!data?.jobId) return
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === data.jobId
          ? {
              ...j,
              removedAt: data.removedAt ?? null,
              removedReason: data.removedReason ?? null,
              ...(data.removedAt ? { status: "Closed" as const } : {}),
            }
          : j
      ),
    }))
  })

  socket.on("job_removed", (data: any) => {
    if (!data?.jobId) return
    const title =
      get().jobApplications.find((a) => a.publicJobId === data.jobId)?.title ??
      get().publicJobs.find((j) => j.id === data.jobId)?.title ??
      "A job"
    set((state) => ({
      publicJobs: state.publicJobs.filter((j) => j.id !== data.jobId),
      recommendedJobs: state.recommendedJobs.filter((j) => j.id !== data.jobId),
      jobApplications: state.jobApplications.map((a) =>
        a.publicJobId === data.jobId ? { ...a, jobRemoved: true } : a
      ),
      liveEvent: { kind: "job_removed" as const, jobId: data.jobId, title, at: Date.now() },
    }))
  })

  socket.on("application_status_updated", (data: any) => {
    if (!isApplicationStatus(data?.status)) return
    // Our own move was applied optimistically; a late echo must not undo a newer move.
    if (data.actorId && data.actorId === get().user?.id) return
    const status = data.status as ApplicationStatusCode
    const mine = get().jobApplications.find((a) => a.id === data.applicationId)
    if (mine && mine.status !== status)
      set({
        liveEvent: {
          kind: "status",
          id: mine.id,
          status,
          title: mine.title,
          at: Date.now(),
        },
      })
    set((state) => ({
      jobApplications: state.jobApplications.map((app) =>
        app.id === data.applicationId
          ? { ...app, status, tag: data.tag ?? app.tag, updatedAt: new Date().toISOString() }
          : app
      ),
      candidates: state.candidates.map((c) =>
        c.id === data.applicationId
          ? { ...c, status: applicationStatusLabel(status), tag: data.tag ?? c.tag }
          : c
      ),
    }))
  })

  socket.on("candidate_ai_status", (data: any) => {
    if (!data?.applicationId || !isAiStatus(data.aiStatus)) return
    set((state) => ({
      candidates: state.candidates.map((cand) =>
        cand.id === data.applicationId
          ? {
              ...cand,
              aiStatus: data.aiStatus,
              aiError:
                data.aiStatus === "FAILED"
                  ? (data.aiError ?? cand.aiError ?? "Analysis failed.")
                  : null,
            }
          : cand
      ),
    }))
  })

  socket.on("candidate_ai_scored", (data: any) => {
    if (!data?.applicationId) return
    const score = data.aiScore ?? data.score
    set((state) => ({
      candidates: state.candidates.map((cand) =>
        cand.id === data.applicationId
          ? {
              ...cand,
              aiScore: typeof score === "number" ? score : cand.aiScore,
              aiSummary: data.aiSummary ?? data.summary ?? cand.aiSummary,
              aiAnalysis: mapAiAnalysis(data.aiAnalysis) ?? cand.aiAnalysis,
              aiModel: data.aiModel ?? cand.aiModel,
              aiScoredAt: data.aiScoredAt ?? new Date().toISOString(),
              aiStatus: isAiStatus(data.aiStatus) ? data.aiStatus : "DONE",
              aiError: null,
            }
          : cand
      ),
    }))
  })

  socket.on("new_message", (data: any) => {
    if (!data?.applicationId) return
    const msg = mapMessage(data)
    const applicationId = msg.applicationId
    const state = get()
    const fromMe = !!msg.senderId && msg.senderId === state.user?.id
    const isActive = state.activeConversationId === applicationId
    const seenNow = isActive && isVisible()
    const fallback =
      state.activeThreadMeta?.applicationId === applicationId ? state.activeThreadMeta : null
    const known = state.conversations.some((c) => c.applicationId === applicationId)

    set((s) => ({
      conversationMessages: isActive
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
          unreadCount: seenNow ? 0 : fromMe ? t.unreadCount : (t.unreadCount || 0) + 1,
        }),
        fallback
      ),
      typingByThread:
        s.typingByThread[applicationId] && !fromMe
          ? Object.fromEntries(
              Object.entries(s.typingByThread).filter(([k]) => k !== applicationId)
            )
          : s.typingByThread,
    }))

    if (!known && !fallback) scheduleConversationsFetch(get)
    if (seenNow && !fromMe) scheduleRead(get, applicationId)
  })

  socket.on("messages_read", (data: any) => {
    const applicationId = data?.applicationId
    if (!applicationId || !data.readerSide || data.readerSide === mySide(get)) return
    if (get().activeConversationId !== applicationId) return
    const side = mySide(get)
    const readAt = data.readAt ? new Date(data.readAt).getTime() : Date.now()
    set((s) => ({
      conversationMessages: s.conversationMessages.map((m) =>
        !m.read &&
        m.applicationId === applicationId &&
        (m.senderType === side || (side === "RECRUITER" && m.senderType === "ADMIN")) &&
        new Date(m.createdAt).getTime() <= readAt + 1000
          ? { ...m, read: true }
          : m
      ),
    }))
  })

  socket.on("user_typing", (data: any) => {
    const applicationId = data?.applicationId
    if (!applicationId || data.userId === get().user?.id) return
    const existing = typingTimers.get(applicationId)
    if (existing) clearTimeout(existing)
    typingTimers.delete(applicationId)
    if (!data.isTyping) {
      set((s) => {
        if (!s.typingByThread[applicationId]) return {}
        const next = { ...s.typingByThread }
        delete next[applicationId]
        return { typingByThread: next }
      })
      return
    }
    set((s) => ({
      typingByThread: {
        ...s.typingByThread,
        [applicationId]: { name: data.name || "Someone", until: Date.now() + TYPING_TTL_MS },
      },
    }))
    typingTimers.set(
      applicationId,
      setTimeout(() => {
        typingTimers.delete(applicationId)
        set((s) => {
          const entry = s.typingByThread[applicationId]
          if (!entry || entry.until > Date.now()) return {}
          const next = { ...s.typingByThread }
          delete next[applicationId]
          return { typingByThread: next }
        })
      }, TYPING_TTL_MS + 50)
    )
  })

  // ── Admin actions that affect this account (see hyrr.admin) ──
  socket.on("account_suspended", () => {
    const email = get().user?.supportEmail
    void get().signOutWithReason(
      `Your account has been suspended.${email ? ` If you think this is a mistake, contact ${email}.` : ""}`
    )
  })
  socket.on("company_status", (data: any) => {
    set((state) =>
      state.user?.company && data?.status
        ? { user: { ...state.user, company: { ...state.user.company, status: data.status } } }
        : {}
    )
  })
  socket.on("company_verified", (data: any) => {
    set((state) => ({
      ...(state.user?.company
        ? {
            user: { ...state.user, company: { ...state.user.company, verified: !!data?.verified } },
          }
        : {}),
      ...(state.companyProfile
        ? { companyProfile: { ...state.companyProfile, verified: !!data?.verified } }
        : {}),
    }))
  })
  socket.on("wallet_updated", () => {
    get()
      .fetchWallet()
      .catch(() => undefined)
  })
  // Admin edited prices, packs or plans (admins refetch their own queries in hyrr.admin).
  socket.on("pricing_updated", () => {
    if (get().user?.role === "ADMIN") return
    get()
      .fetchBillingCatalog()
      .catch(() => undefined)
  })

  socket.on("notification", (data: any) => {
    const item = mapNotification(data || {})
    set((state) =>
      state.notifications.some((n) => n.id === item.id)
        ? {}
        : { notifications: [item, ...state.notifications] }
    )
  })

  socket.on("unread_update", () => {
    scheduleUnreadFetch(get)
  })

  set({ socket })
}
