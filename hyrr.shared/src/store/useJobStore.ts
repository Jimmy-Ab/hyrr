import { io } from "socket.io-client"
import { create } from "zustand"
import { apiFetch } from "../lib/api"
import {
  APPLICATION_STATUS,
  type ApplicationStatusCode,
  type ApplicationStatusLabel,
  type CalendarEventType,
  type DocumentType,
  JOB_TYPE_OPTIONS,
  type JobType,
  type NotificationType,
  type SeekerView,
  employmentTypeCode,
  employmentTypeLabel,
  isSeekerView,
  notificationActionView,
} from "../lib/contracts"

function decodeJwt(token: string) {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export interface Job {
  id: string
  title: string
  location: string
  type: string
  posted: string
  status: "Active" | "Closed"
  color: "purple" | "blue" | "green" | "orange"
  description: string
}

export interface Candidate {
  id: string
  jobId: string
  name: string
  email?: string
  phone?: string
  title: string
  location: string
  coverLetter?: string
  resumeUrl?: string
  dateText: string
  status: ApplicationStatusLabel
  tag?: string
  avatar: string
  bookmarked: boolean
  aiScore?: number
  aiSummary?: string
}

export interface NotificationItem {
  id: string
  title: string
  time: string
  read: boolean
  type: NotificationType
  actionView?: SeekerView
}

export interface PublicJob {
  id: string
  title: string
  company: string
  companyColor: "purple" | "blue" | "green" | "orange"
  location: string
  type: JobType
  salary: string
  posted: string
  description: string
  requirements: string[]
  skills: string[]
  benefits: string[]
  featured?: boolean
  remote?: boolean
}

export interface SeekerProfileData {
  title: string
  location: string
  bio?: string
  skills: string[]
  languages: string[]
  expectedSalary?: string
  preferredType?: string
  availability?: string
  preferredLocations: string[]
  visibility: string
  website?: string
  github?: string
  linkedin?: string
  experiences: Array<{ id: string; role: string; company: string; duration: string; desc?: string }>
  educations: Array<{ id: string; school: string; degree: string; duration: string }>
}

export interface JobApplication {
  id: string
  publicJobId: string
  company: string
  title: string
  companyColor: "purple" | "blue" | "green" | "orange"
  location: string
  type: string
  salary: string
  appliedDate: string
  status: ApplicationStatusCode
  bookmarked: boolean
  recruiterName: string
  recruiterAvatar: string
  interviewDate?: string
  offerAmount?: string
  notes?: string
  tag?: string
}

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime?: string
  type: CalendarEventType
  applicationId?: string
  meetingUrl?: string
  location?: string
  notes?: string
}

export interface Document {
  id: string
  name: string
  type: DocumentType
  size: string
  url: string
  active: boolean
  createdAt: string
}

export interface ConversationThread {
  applicationId: string
  candidateName: string
  candidateAvatar: string
  jobTitle: string
  company: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  online?: boolean
}

export interface ChatMessage {
  id: string
  applicationId: string
  senderId: string | null
  senderType: "SEEKER" | "RECRUITER" | "SYSTEM"
  text: string
  read: boolean
  createdAt: string
}

export interface SeekerDashboardData {
  summary: {
    applications: number
    inProcess: number
    interviewing: number
    saved: number
    profileStrength: number
  }
  pipeline: Record<ApplicationStatusCode, number>
  activity: Array<{ date: string; updates: number }>
}

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

// ─── State Interface ───────────────────────────────────────────────────────────

export interface JobState {
  // ── Recruiter workspace ──────────────────────────────────────────────────
  jobs: Job[]
  candidates: Candidate[]
  selectedJobId: string
  activeView:
    | "Dashboard"
    | "Jobs"
    | "Candidates"
    | "Applications"
    | "Calendar"
    | "Messages"
    | "Analytics"
    | "Careers"
  careerSelectedJobId: string
  workspaceName: string
  isAddCandidateOpen: boolean
  addCandidateColumn: Candidate["status"]
  isAddJobOpen: boolean
  searchQuery: string
  theme: "light" | "dark"
  notifications: NotificationItem[]
  selectedCandidateId: string | null

  // ── Auth ─────────────────────────────────────────────────────────────────
  user: {
    id: string
    email: string
    name: string
    avatar: string
    role: "SEEKER" | "RECRUITER" | "ADMIN"
  } | null
  accessToken: string | null
  isAuthenticated: boolean
  authLoading: boolean
  authError: string | null
  socket: any | null

  // ── Auth actions ─────────────────────────────────────────────────────────
  loginUser: (email: string, password: string) => Promise<boolean>
  registerUser: (
    name: string,
    email: string,
    password: string,
    role: "SEEKER" | "RECRUITER"
  ) => Promise<boolean>
  logout: () => void
  setAccessToken: (token: string | null) => void
  initializeSocket: () => void

  // ── Recruiter actions ────────────────────────────────────────────────────
  selectJob: (jobId: string) => void
  moveCandidate: (candidateId: string, targetStatus: Candidate["status"]) => void
  addCandidate: (jobId: string, candidate: Omit<Candidate, "id" | "jobId">) => void
  addJob: (job: {
    title: string
    location: string
    type: string
    salary?: string
    description: string
    requirements: string[]
    skills: string[]
    benefits?: string[]
    categoryId: string
    featured?: boolean
    remote?: boolean
  }) => void
  toggleBookmark: (candidateId: string) => void
  setSearchQuery: (query: string) => void
  toggleTheme: () => void
  fetchNotifications: () => Promise<void>
  markNotificationsAsRead: () => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  deleteCandidate: (candidateId: string) => void
  setActiveView: (
    view:
      | "Dashboard"
      | "Jobs"
      | "Candidates"
      | "Applications"
      | "Calendar"
      | "Messages"
      | "Analytics"
      | "Careers"
  ) => void
  setCareerSelectedJobId: (jobId: string) => void
  applyToJob: (
    jobId: string,
    applicant: {
      name: string
      email: string
      phone: string
      title: string
      location: string
      linkedin?: string
      coverLetter?: string
    }
  ) => void
  setWorkspaceName: (name: string) => void
  setAddCandidateOpen: (open: boolean, col?: Candidate["status"]) => void
  setAddJobOpen: (open: boolean) => void
  setSelectedCandidateId: (id: string | null) => void
  fetchInitialData: () => Promise<void>
  fetchSeekerDashboard: () => Promise<void>

  // ── Seeker workspace ─────────────────────────────────────────────────────
  candidateActiveView: SeekerView
  publicJobs: PublicJob[]
  recommendedJobs: PublicJob[]
  seekerDashboard: SeekerDashboardData | null
  publicJobsLoading: boolean
  jobApplications: JobApplication[]
  discoverSearch: string
  discoverTypeFilter: string
  seekerProfile: SeekerProfileData | null
  setCandidateActiveView: (view: SeekerView) => void
  toggleJobBookmark: (id: string) => Promise<boolean>
  applyFromDiscover: (publicJobId: string) => Promise<boolean>
  saveJobFromDiscover: (publicJobId: string) => Promise<boolean>
  setDiscoverSearch: (q: string) => void
  setDiscoverTypeFilter: (t: string) => void

  // ── Calendar ─────────────────────────────────────────────────────────────
  events: CalendarEvent[]
  eventsLoading: boolean
  fetchEvents: () => Promise<void>
  createEvent: (data: Omit<CalendarEvent, "id">) => Promise<void>
  deleteEvent: (id: string) => Promise<void>

  // ── Documents ────────────────────────────────────────────────────────────
  documents: Document[]
  documentsLoading: boolean
  fetchDocuments: () => Promise<void>
  uploadDocument: (meta: { name: string; type: string; size: string; url: string }) => Promise<void>
  toggleDocumentActive: (id: string) => Promise<void>
  deleteDocument: (id: string) => Promise<void>

  // ── Messages ─────────────────────────────────────────────────────────────
  conversations: ConversationThread[]
  conversationsLoading: boolean
  activeConversationId: string | null
  conversationMessages: ChatMessage[]
  messagesLoading: boolean
  fetchConversations: () => Promise<void>
  fetchMessages: (applicationId: string) => Promise<void>
  sendMessage: (applicationId: string, text: string) => Promise<void>
  setActiveConversation: (id: string | null) => void
  deleteConversation: (applicationId: string) => Promise<void>
  unreadMessageCount: number
  fetchUnreadCount: () => Promise<void>

  // ── AI Chat ──────────────────────────────────────────────────────────────
  aiChatMessages: AiChatMessage[]
  aiChatLoading: boolean
  aiChatOpen: boolean
  sendAiChat: (message: string) => Promise<void>
  clearAiChat: () => void
  setAiChatOpen: (open: boolean) => void

  // ── Profile ──────────────────────────────────────────────────────────────
  profileUpdating: boolean
  updateProfile: (data: {
    name?: string
    title?: string
    location?: string
    phone?: string
    website?: string
    github?: string
    linkedin?: string
    bio?: string
    avatar?: string
    expectedSalary?: string
    preferredType?: string
    availability?: string
    yearsOfExperience?: string
    visibility?: string
    skills?: string[]
    languages?: string[]
    preferredLocations?: string[]
    experiences?: { role: string; company: string; duration: string; desc?: string }[]
    educations?: { school: string; degree: string; duration: string }[]
  }) => Promise<boolean>
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useJobStore = create<JobState>((set, get) => ({
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
      set({
        accessToken: data.accessToken,
        isAuthenticated: true,
        authLoading: false,
        user: { id: data.userId, role: data.role, email, name: "", avatar: "" },
      })
      get().initializeSocket()
      get().fetchInitialData()
      return true
    } catch (err: any) {
      set({ authError: err.message, authLoading: false })
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
      set({
        accessToken: data.accessToken,
        isAuthenticated: true,
        authLoading: false,
        user: { id: data.userId, role: data.role, email, name, avatar: "" },
      })
      get().initializeSocket()
      get().fetchInitialData()
      return true
    } catch (err: any) {
      set({ authError: err.message, authLoading: false })
      return false
    }
  },

  logout: async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" })
    } catch {}
    const s = get().socket
    if (s) s.disconnect()
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      socket: null,
      jobs: [],
      candidates: [],
      jobApplications: [],
      conversations: [],
      conversationMessages: [],
      events: [],
      documents: [],
      aiChatMessages: [],
    })
  },

  setAccessToken: (token) => {
    set((state) => {
      let userState = state.user
      if (token) {
        const decoded = decodeJwt(token)
        if (decoded) {
          userState = {
            id: decoded.sub,
            email: decoded.email || "",
            name: state.user?.name || "",
            avatar: state.user?.avatar || "",
            role: decoded.role as "SEEKER" | "RECRUITER" | "ADMIN",
          }
        }
      } else {
        userState = null
      }
      return {
        accessToken: token,
        isAuthenticated: !!token,
        user: userState,
      }
    })
    if (token) {
      get().initializeSocket()
      get().fetchInitialData()
    }
  },

  initializeSocket: () => {
    let token = get().accessToken
    if (!token && typeof window !== "undefined") {
      token = localStorage.getItem("accessToken") || localStorage.getItem("token") || ""
    }
    if (!token) return

    if (get().socket) {
      if (get().socket.connected) return
      get().socket.disconnect()
    }

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000", {
      auth: { token },
      withCredentials: true,
      transports: ["websocket", "polling"],
    })

    socket.on("connect", () => {
      const activeAppId = get().activeConversationId
      if (activeAppId) {
        socket.emit("join_chat", { applicationId: activeAppId })
      }
    })

    socket.on("application_status_updated", (data: any) => {
      const status = Object.values(APPLICATION_STATUS).includes(data.status)
        ? (data.status as ApplicationStatusCode)
        : null
      if (!status) return
      set((state) => ({
        jobApplications: state.jobApplications.map((app) =>
          app.id === data.applicationId ? { ...app, status, tag: data.tag } : app
        ),
      }))
    })

    socket.on("candidate_ai_scored", (data: any) => {
      set((state) => ({
        candidates: state.candidates.map((cand) =>
          cand.id === data.applicationId
            ? { ...cand, aiScore: data.score, aiSummary: data.summary }
            : cand
        ),
      }))
    })

    socket.on("new_message", (data: any) => {
      const state = get()
      const isActiveConv = state.activeConversationId === data.applicationId
      const isDuplicate = state.conversationMessages.some(
        (m) =>
          m.id === data.id ||
          (m.id.startsWith("temp-") &&
            m.text === data.text &&
            m.applicationId === data.applicationId)
      )

      // Only append to message list if viewing this conversation and not a duplicate
      if (isActiveConv && !isDuplicate) {
        set((s) => ({
          conversationMessages: [
            ...s.conversationMessages.filter((m) => !m.id.startsWith("temp-")),
            {
              id: data.id || String(Date.now()),
              applicationId: data.applicationId,
              senderId: data.senderId,
              senderType: data.senderType,
              text: data.text,
              read: false,
              createdAt: data.createdAt || new Date().toISOString(),
            },
          ],
        }))
      }

      // Always update sidebar conversation preview and unread count
      get().fetchUnreadCount()
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.applicationId === data.applicationId
            ? {
                ...c,
                lastMessage: data.text,
                lastMessageTime: "Just now",
                unreadCount: isActiveConv ? c.unreadCount : (c.unreadCount || 0) + 1,
              }
            : c
        ),
      }))
    })

    socket.on("notification", (data: any) => {
      set((state) => ({
        notifications: [
          {
            id: data.id || String(Date.now()),
            title: data.title || data.message || "New Notification",
            time: "Just now",
            read: false,
            type: data.type || "SYSTEM",
            actionView:
              notificationActionView(data.actionView) ||
              (isSeekerView(data.actionView) ? data.actionView : undefined),
          },
          ...state.notifications,
        ],
      }))
    })

    socket.on("unread_update", () => {
      get().fetchUnreadCount()
      get().fetchConversations()
    })

    set({ socket })
  },

  // ── Recruiter workspace state ─────────────────────────────────────────────
  activeView: "Applications",
  setActiveView: (view) => set({ activeView: view }),
  careerSelectedJobId: "senior-frontend-developer",
  setCareerSelectedJobId: (jobId) => set({ careerSelectedJobId: jobId }),
  workspaceName: "Acme Careers",
  isAddCandidateOpen: false,
  addCandidateColumn: "Applied",
  isAddJobOpen: false,
  selectedCandidateId: null,
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),

  // ── Seeker workspace state ────────────────────────────────────────────────
  candidateActiveView: "Dashboard",
  discoverSearch: "",
  discoverTypeFilter: "All",
  profileUpdating: false,
  publicJobsLoading: false,
  recommendedJobs: [],
  seekerDashboard: null,
  seekerProfile: null,
  setCandidateActiveView: (view) => set({ candidateActiveView: view }),
  setDiscoverSearch: (q) => set({ discoverSearch: q }),
  setDiscoverTypeFilter: (t) => set({ discoverTypeFilter: t }),

  updateProfile: async (data) => {
    set({ profileUpdating: true })
    try {
      const updated = await apiFetch("/profile", { method: "PUT", body: JSON.stringify(data) })
      const prev = get().user
      if (prev) {
        set({
          user: {
            ...prev,
            name: updated.user?.name ?? updated.name ?? prev.name,
            avatar: updated.user?.avatar ?? updated.avatar ?? prev.avatar,
          },
        })
      }
      return true
    } catch {
      return false
    } finally {
      set({ profileUpdating: false })
    }
  },

  // ── Public jobs (populated from backend on init) ────────────────────────
  publicJobs: [] as PublicJob[],

  jobApplications: [] as JobApplication[],

  jobs: [] as Job[],
  selectedJobId: "",
  searchQuery: "",
  theme: "light",
  notifications: [] as NotificationItem[],
  candidates: [] as Candidate[],

  // ── Recruiter actions ──────────────────────────────────────────────────────

  selectJob: (jobId) => set({ selectedJobId: jobId }),

  moveCandidate: async (candidateId, targetStatus) => {
    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === candidateId ? { ...c, status: targetStatus } : c
      ),
    }))
    try {
      await apiFetch(`/applications/${candidateId}`, {
        method: "PUT",
        body: JSON.stringify({ status: targetStatus.toUpperCase().replace(" ", "_") }),
      })
    } catch (e) {
      console.warn("Failed to sync candidate status update to database.", e)
    }
  },

  addCandidate: async (jobId, candidateData) => {
    try {
      const dbCandidate = await apiFetch(`/applications/jobs/${jobId}/apply`, {
        method: "POST",
        body: JSON.stringify({
          name: candidateData.name,
          email:
            candidateData.email ||
            `${candidateData.name.toLowerCase().replace(/\s+/g, "")}@example.com`,
          phone: candidateData.phone,
          title: candidateData.title,
          location: candidateData.location,
          coverLetter: candidateData.coverLetter,
        }),
      })
      set((state) => ({
        candidates: [
          ...state.candidates,
          {
            ...candidateData,
            id: dbCandidate.id,
            jobId,
            status: "Applied",
            bookmarked: false,
            dateText: "Just now",
            avatar:
              dbCandidate.user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateData.name)}`,
          },
        ],
      }))
    } catch (e) {
      console.warn("Failed to persist new candidate in database.", e)
    }
  },

  addJob: async (jobData) => {
    try {
      const dbJob = await apiFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: jobData.title,
          location: jobData.location,
          type: employmentTypeCode(jobData.type),
          salary: jobData.salary,
          description: jobData.description,
          requirements: jobData.requirements,
          skills: jobData.skills,
          benefits: jobData.benefits ?? [],
          categoryId: jobData.categoryId,
          featured: jobData.featured ?? false,
          remote: jobData.remote ?? false,
        }),
      })
      const newJob: Job = {
        id: dbJob.id,
        title: dbJob.title,
        location: dbJob.location,
        type: employmentTypeLabel(dbJob.type),
        posted: "Just now",
        status: "Active",
        color: dbJob.color || "purple",
        description: dbJob.description || jobData.description || "",
      }
      set((state) => ({
        jobs: [...state.jobs, newJob],
        selectedJobId: newJob.id,
        activeView: "Jobs",
      }))
    } catch (e) {
      console.warn("Failed to persist new job in database.", e)
    }
  },

  toggleBookmark: async (candidateId) => {
    const candidate = get().candidates.find((c) => c.id === candidateId)
    if (!candidate) return
    const isBookmarked = !candidate.bookmarked
    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === candidateId ? { ...c, bookmarked: isBookmarked } : c
      ),
    }))
    try {
      await apiFetch(`/applications/${candidateId}`, {
        method: "PUT",
        body: JSON.stringify({ recruiterBookmarked: isBookmarked }),
      })
    } catch (e) {
      console.warn("Failed to update bookmark status in database.", e)
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),

  fetchNotifications: async () => {
    try {
      const data = await apiFetch("/notifications")
      const mapped: NotificationItem[] = (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        time: new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        read: n.read,
        type: n.type || "SYSTEM",
        actionView:
          notificationActionView(n.actionView) ||
          (isSeekerView(n.actionView) ? n.actionView : undefined),
      }))
      set({ notifications: mapped })
    } catch {}
  },

  markNotificationsAsRead: async () => {
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }))
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" })
    } catch {}
  },

  markNotificationRead: async (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }))
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" })
    } catch {}
  },

  clearNotifications: async () => {
    set({ notifications: [] })
    try {
      await apiFetch("/notifications", { method: "DELETE" })
    } catch {}
  },

  deleteCandidate: async (candidateId) => {
    set((state) => ({ candidates: state.candidates.filter((c) => c.id !== candidateId) }))
    try {
      await apiFetch(`/applications/${candidateId}`, { method: "DELETE" })
    } catch (e) {
      console.warn("Failed to delete candidate from database.", e)
    }
  },

  setWorkspaceName: (name) => set({ workspaceName: name }),
  setAddCandidateOpen: (open, col = "Applied") =>
    set({ isAddCandidateOpen: open, addCandidateColumn: col }),
  setAddJobOpen: (open) => set({ isAddJobOpen: open }),

  applyToJob: async (jobId, applicant) => {
    try {
      await apiFetch(`/applications/jobs/${jobId}/apply`, {
        method: "POST",
        body: JSON.stringify(applicant),
      })
      get().fetchInitialData()
    } catch (e) {
      console.warn("Failed to submit applicant data to database.", e)
    }
  },

  fetchSeekerDashboard: async () => {
    try {
      const dashboard = await apiFetch("/dashboard/seeker")
      set({ seekerDashboard: dashboard })
    } catch {
      // The page retains its record-derived fallback when the dashboard API is unavailable.
    }
  },

  fetchInitialData: async () => {
    const role = get().user?.role
    if (!role) return

    try {
      if (role === "RECRUITER") {
        const dbJobs = await apiFetch("/jobs")
        const jobsList: Job[] = dbJobs.map((j: any) => ({
          id: j.id,
          title: j.title,
          location: j.location,
          type: employmentTypeLabel(j.type),
          posted: "Posted " + new Date(j.createdAt).toLocaleDateString(),
          status: j.status === "ACTIVE" ? "Active" : "Closed",
          color: j.color || "purple",
          description: j.description || "",
        }))

        const dbCandidates = await apiFetch("/applications/candidates")
        const candidatesList: Candidate[] = dbCandidates.map((c: any) => ({
          id: c.id,
          jobId: c.jobId,
          name: c.name,
          email: c.email,
          phone: c.phone,
          title: c.title,
          location: c.location,
          coverLetter: c.coverLetter,
          resumeUrl: c.resumeUrl,
          dateText: new Date(c.appliedAt).toLocaleDateString(),
          status:
            c.status === "IN_PROCESS"
              ? "In Process"
              : c.status === "INTERVIEWING"
                ? "Interviewing"
                : c.status === "OFFER"
                  ? "Offer"
                  : c.status === "ARCHIVED"
                    ? "Archived"
                    : c.status === "SAVED"
                      ? "Saved"
                      : "Applied",
          bookmarked: c.recruiterBookmarked,
          avatar:
            c.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}`,
          aiScore: c.aiScore,
          aiSummary: c.aiSummary,
          tag: c.tag,
        }))

        if (jobsList.length > 0 || candidatesList.length > 0) {
          set({
            jobs: jobsList,
            candidates: candidatesList,
            selectedJobId: jobsList[0]?.id || "",
          })
        }

        // Fetch user profile for workspace name
        try {
          const profile = await apiFetch("/profile/me")
          if (profile?.company?.name) set({ workspaceName: profile.company.name })
          if (profile) {
            set((state) => ({
              user: state.user
                ? {
                    ...state.user,
                    name: profile.name || state.user.name,
                    avatar: profile.avatar || state.user.avatar,
                  }
                : state.user,
            }))
          }
        } catch {}

        get().fetchConversations()
        get().fetchUnreadCount()
        get().fetchEvents()
        get().fetchNotifications()
      } else if (role === "SEEKER") {
        set({ publicJobsLoading: true })

        const [dbApps, dbDiscover] = await Promise.all([
          apiFetch("/applications/my"),
          apiFetch("/jobs/public"),
        ])

        const jobAppsList: JobApplication[] = dbApps.map((a: any) => ({
          id: a.id,
          publicJobId: a.jobId,
          company: a.job.company.name,
          title: a.job.title,
          companyColor: a.job.company.color || "purple",
          location: a.job.location,
          type: employmentTypeLabel(a.job.type),
          salary: a.job.salary || "Competitive",
          appliedDate: new Date(a.appliedAt).toLocaleDateString(),
          status: (Object.values(APPLICATION_STATUS).includes(a.status)
            ? a.status
            : APPLICATION_STATUS.APPLIED) as ApplicationStatusCode,
          bookmarked: a.seekerBookmarked,
          recruiterName: a.job.postedBy?.name || "Hiring Team",
          recruiterAvatar: a.job.postedBy?.avatar || `https://ui-avatars.com/api/?name=Hiring+Team`,
          interviewDate: a.calendarEvents?.[0]?.startTime
            ? new Date(a.calendarEvents[0].startTime).toLocaleDateString()
            : undefined,
          offerAmount: a.offerAmount,
          notes: a.notes,
          tag: a.tag,
        }))

        const publicJobsList: PublicJob[] = dbDiscover.map((pj: any) => ({
          id: pj.id,
          title: pj.title,
          company: pj.company.name,
          companyColor: pj.company.color || "purple",
          location: pj.location,
          type: employmentTypeLabel(pj.type),
          salary: pj.salary || "Competitive",
          posted: new Date(pj.createdAt).toLocaleDateString(),
          description: pj.description,
          requirements: pj.requirements || [],
          skills: pj.skills || [],
          benefits: pj.benefits || [],
          featured: pj.featured,
          remote: pj.remote,
        }))

        set({
          jobApplications: jobAppsList,
          publicJobs: publicJobsList,
          publicJobsLoading: false,
        })

        try {
          const recommendations = await apiFetch("/ai/featured-jobs")
          set({
            recommendedJobs: (recommendations || []).map((job: any) => ({
              id: job.id,
              title: job.title,
              company: job.company.name,
              companyColor: job.company.color || "purple",
              location: job.location,
              type: employmentTypeLabel(job.type),
              salary: job.salary || "Competitive",
              posted: new Date(job.createdAt).toLocaleDateString(),
              description: job.description,
              requirements: job.requirements || [],
              skills: job.skills || [],
              benefits: job.benefits || [],
              featured: job.featured,
              remote: job.remote,
            })),
          })
        } catch {
          // Still backend sourced: retain active featured roles when the AI
          // recommendation provider is unavailable.
          set({ recommendedJobs: publicJobsList.filter((job) => job.featured) })
        }

        // Fetch user profile data and store seeker profile
        try {
          const [meData, profileData] = await Promise.all([
            apiFetch("/profile/me"),
            apiFetch("/profile"),
          ])
          if (meData) {
            set((state) => ({
              user: state.user
                ? {
                    ...state.user,
                    name: meData.name || state.user.name,
                    avatar: meData.avatar || state.user.avatar,
                  }
                : state.user,
            }))
          }
          if (profileData) {
            set({
              seekerProfile: {
                title: profileData.title || "",
                location: profileData.location || "",
                bio: profileData.bio || "",
                skills: profileData.skills || [],
                languages: profileData.languages || [],
                expectedSalary: profileData.expectedSalary || "",
                preferredType: profileData.preferredType || JOB_TYPE_OPTIONS[0],
                availability: profileData.availability || "",
                preferredLocations: profileData.preferredLocations || [],
                visibility: profileData.visibility || "public",
                website: profileData.website || "",
                github: profileData.github || "",
                linkedin: profileData.linkedin || "",
                experiences: profileData.experiences || [],
                educations: profileData.educations || [],
              },
            })
          }
        } catch {}

        get().fetchEvents()
        get().fetchDocuments()
        get().fetchConversations()
        get().fetchUnreadCount()
        get().fetchNotifications()
        get().fetchSeekerDashboard()
      }
    } catch (e) {
      console.warn("Failed to load workspace data from backend API.", e)
      if (role === "SEEKER") set({ publicJobsLoading: false })
    }
  },

  // ── Seeker actions ─────────────────────────────────────────────────────────

  toggleJobBookmark: async (id) => {
    const app = get().jobApplications.find((a) => a.id === id)
    if (!app) return false
    const isBookmarked = !app.bookmarked
    set((state) => ({
      jobApplications: state.jobApplications.map((a) =>
        a.id === id ? { ...a, bookmarked: isBookmarked } : a
      ),
    }))
    try {
      await apiFetch(`/applications/${id}`, {
        method: "PUT",
        body: JSON.stringify({ seekerBookmarked: isBookmarked }),
      })
      return true
    } catch (e) {
      set((state) => ({
        jobApplications: state.jobApplications.map((a) =>
          a.id === id ? { ...a, bookmarked: app.bookmarked } : a
        ),
      }))
      console.warn("Failed to update bookmark status in database.", e)
      return false
    }
  },

  applyFromDiscover: async (publicJobId) => {
    const seeker = get().user
    const profile = get().seekerProfile
    if (!seeker) return false
    try {
      await apiFetch(`/applications/jobs/${publicJobId}/apply`, {
        method: "POST",
        body: JSON.stringify({
          name: seeker.name || "Anonymous Seeker",
          email: seeker.email,
          title: profile?.title || "Job Seeker",
          location: profile?.location || "Remote",
          phone: "",
          coverLetter: "",
        }),
      })
      await get().fetchInitialData()
      return true
    } catch (e) {
      console.warn("Failed to apply to job.", e)
      return false
    }
  },

  saveJobFromDiscover: async (publicJobId) => {
    const seeker = get().user
    const profile = get().seekerProfile
    if (!seeker) return false
    try {
      await apiFetch(`/applications/jobs/${publicJobId}/save`, {
        method: "POST",
        body: JSON.stringify({
          name: seeker.name || "Anonymous Seeker",
          email: seeker.email,
          title: profile?.title || "Job Seeker",
          location: profile?.location || "Remote",
        }),
      })
      await get().fetchInitialData()
      return true
    } catch (e) {
      console.warn("Failed to save job.", e)
      return false
    }
  },

  // ── Calendar ───────────────────────────────────────────────────────────────

  events: [],
  eventsLoading: false,

  fetchEvents: async () => {
    set({ eventsLoading: true })
    try {
      const data = await apiFetch("/calendar")
      const mapped: CalendarEvent[] = (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        type: (e.type || "other").toLowerCase() as CalendarEvent["type"],
        applicationId: e.applicationId,
        notes: e.notes,
      }))
      set({ events: mapped })
    } catch {
      // keep empty state
    } finally {
      set({ eventsLoading: false })
    }
  },

  createEvent: async (data) => {
    try {
      const created = await apiFetch("/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          startTime: data.startTime,
          endTime: data.endTime,
          type: data.type?.toUpperCase(),
          applicationId: data.applicationId,
          meetingUrl: data.meetingUrl,
          location: data.location,
          notes: data.notes,
        }),
      })
      set((state) => ({
        events: [
          ...state.events,
          {
            id: created.id,
            title: created.title,
            startTime: created.startTime,
            endTime: created.endTime,
            type: (created.type || "other").toLowerCase() as CalendarEvent["type"],
            applicationId: created.applicationId,
            meetingUrl: created.meetingUrl,
            location: created.location,
            notes: created.notes,
          },
        ],
      }))
    } catch (e) {
      console.warn("Failed to create calendar event.", e)
    }
  },

  deleteEvent: async (id) => {
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }))
    try {
      await apiFetch(`/calendar/${id}`, { method: "DELETE" })
    } catch (e) {
      console.warn("Failed to delete calendar event.", e)
    }
  },

  // ── Documents ──────────────────────────────────────────────────────────────

  documents: [],
  documentsLoading: false,

  fetchDocuments: async () => {
    set({ documentsLoading: true })
    try {
      const data = await apiFetch("/documents")
      const mapped: Document[] = (data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        type: (d.type || "other").toLowerCase() as Document["type"],
        size: d.size || "—",
        url: d.url || "",
        active: d.active ?? true,
        createdAt: d.createdAt,
      }))
      set({ documents: mapped })
    } catch {
      // keep empty
    } finally {
      set({ documentsLoading: false })
    }
  },

  uploadDocument: async (meta) => {
    try {
      const created = await apiFetch("/documents", {
        method: "POST",
        body: JSON.stringify(meta),
      })
      set((state) => ({
        documents: [
          ...state.documents,
          {
            id: created.id,
            name: created.name,
            type: (created.type || "other").toLowerCase() as Document["type"],
            size: created.size || meta.size,
            url: created.url || meta.url,
            active: created.active ?? true,
            createdAt: created.createdAt || new Date().toISOString(),
          },
        ],
      }))
    } catch (e) {
      console.warn("Failed to upload document.", e)
    }
  },

  toggleDocumentActive: async (id) => {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, active: !d.active } : d)),
    }))
    try {
      await apiFetch(`/documents/${id}/toggle`, { method: "PUT" })
    } catch (e) {
      console.warn("Failed to toggle document active state.", e)
    }
  },

  deleteDocument: async (id) => {
    set((state) => ({ documents: state.documents.filter((d) => d.id !== id) }))
    try {
      await apiFetch(`/documents/${id}`, { method: "DELETE" })
    } catch (e) {
      console.warn("Failed to delete document.", e)
    }
  },

  // ── Messages ───────────────────────────────────────────────────────────────

  conversations: [],
  conversationsLoading: false,
  activeConversationId: null,
  conversationMessages: [],
  messagesLoading: false,
  unreadMessageCount: 0,

  fetchConversations: async () => {
    set({ conversationsLoading: true })
    try {
      const data = await apiFetch("/messages/conversations")
      const role = get().user?.role || "SEEKER"
      const mapped: ConversationThread[] = (data || []).map((app: any) => {
        const lastMsg = app.messages?.[0]
        const isSeeker = role === "SEEKER"
        return {
          applicationId: app.id,
          candidateName: isSeeker
            ? app.job?.postedBy?.name || "Hiring Team"
            : app.user?.name || "Candidate",
          candidateAvatar: isSeeker
            ? app.job?.postedBy?.avatar || `https://ui-avatars.com/api/?name=Hiring+Team`
            : app.user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(app.user?.name || "C")}`,
          jobTitle: app.job?.title || "Position",
          company: app.job?.company?.name || "Company",
          lastMessage: lastMsg?.text || "No messages yet",
          lastMessageTime: lastMsg?.createdAt
            ? new Date(lastMsg.createdAt).toLocaleDateString()
            : "",
          unreadCount: app._unreadCount || 0,
          online: false,
        }
      })
      set({ conversations: mapped })
    } catch {
      // keep empty
    } finally {
      set({ conversationsLoading: false })
    }
  },

  fetchMessages: async (applicationId) => {
    set({ messagesLoading: true, activeConversationId: applicationId })
    // Join the socket chat room so real-time new_message events are received
    const sock = get().socket
    if (sock?.connected) {
      sock.emit("join_chat", { applicationId })
    }
    try {
      const data = await apiFetch(`/messages/${applicationId}`)
      const mapped: ChatMessage[] = (data || []).map((m: any) => ({
        id: m.id,
        applicationId: m.applicationId,
        senderId: m.senderId,
        senderType: m.senderType,
        text: m.text,
        read: m.read,
        createdAt: m.createdAt,
      }))
      set({ conversationMessages: mapped })
    } catch {
      set({ conversationMessages: [] })
    } finally {
      set({ messagesLoading: false })
    }
  },

  sendMessage: async (applicationId, text) => {
    const userId = get().user?.id || null
    const senderType: ChatMessage["senderType"] =
      get().user?.role === "RECRUITER" ? "RECRUITER" : "SEEKER"
    const tempId = `temp-${Date.now()}`

    // Optimistic update — shown immediately, replaced when server acks
    const optimistic: ChatMessage = {
      id: tempId,
      applicationId,
      senderId: userId,
      senderType,
      text,
      read: false,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ conversationMessages: [...state.conversationMessages, optimistic] }))

    const sock = get().socket
    if (sock?.connected) {
      // Use WebSocket — gateway uses client.to() so sender won't get a duplicate new_message
      sock.emit("send_message", { applicationId, text }, (ack: any) => {
        if (ack?.id) {
          // Replace optimistic entry with real message from server ack
          set((state) => ({
            conversationMessages: state.conversationMessages.map((m) =>
              m.id === tempId ? { ...m, id: ack.id, createdAt: ack.createdAt || m.createdAt } : m
            ),
          }))
        }
      })
    } else {
      // WebSocket not available — fall back to REST
      try {
        const saved = await apiFetch(`/messages/${applicationId}`, {
          method: "POST",
          body: JSON.stringify({ text }),
        })
        if (saved?.id) {
          set((state) => ({
            conversationMessages: state.conversationMessages.map((m) =>
              m.id === tempId
                ? { ...m, id: saved.id, createdAt: saved.createdAt || m.createdAt }
                : m
            ),
          }))
        }
      } catch (e) {
        console.warn("Failed to send message via REST fallback.", e)
        // Remove failed optimistic message
        set((state) => ({
          conversationMessages: state.conversationMessages.filter((m) => m.id !== tempId),
        }))
      }
    }

    // Update sidebar last message optimistically
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.applicationId === applicationId
          ? { ...c, lastMessage: text, lastMessageTime: "Just now" }
          : c
      ),
    }))
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  deleteConversation: async (applicationId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.applicationId !== applicationId),
      activeConversationId:
        state.activeConversationId === applicationId ? null : state.activeConversationId,
      conversationMessages:
        state.activeConversationId === applicationId ? [] : state.conversationMessages,
    }))
    try {
      await apiFetch(`/messages/conversations/${applicationId}`, { method: "DELETE" })
    } catch (e) {
      console.warn("Failed to delete conversation.", e)
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await apiFetch("/messages/unread-count")
      set({ unreadMessageCount: data?.count || 0 })
    } catch {
      /* swallow */
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
        content: data.reply || "I'm having trouble responding right now.",
        timestamp: Date.now(),
      }
      set((state) => ({
        aiChatMessages: [...state.aiChatMessages, assistantMsg],
        aiChatLoading: false,
      }))
    } catch {
      const fallback: AiChatMessage = {
        role: "assistant",
        content: "I'm currently offline. Please check your connection and try again.",
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
}))
