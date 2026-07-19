import { create } from "zustand"
import { apiFetch } from "../lib/api"
import { io } from "socket.io-client"

function decodeJwt(token: string) {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
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
  status: "Saved" | "Applied" | "In Process" | "Offer" | "Archived"
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
}

export interface PublicJob {
  id: string
  title: string
  company: string
  companyColor: "purple" | "blue" | "green" | "orange"
  location: string
  type: "Full Time" | "Part Time" | "Contract" | "Remote"
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
  status: "Saved" | "Applied" | "In Process" | "Offer" | "Archived"
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
  type: "interview" | "deadline" | "offer" | "other"
  applicationId?: string
  notes?: string
}

export interface Document {
  id: string
  name: string
  type: "resume" | "cover" | "cert" | "portfolio" | "other"
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
  activeView: "Dashboard" | "Jobs" | "Candidates" | "Applications" | "Calendar" | "Messages" | "Analytics" | "Careers"
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
  user: { id: string; email: string; name: string; avatar: string; role: "SEEKER" | "RECRUITER" | "ADMIN" } | null
  accessToken: string | null
  isAuthenticated: boolean
  authLoading: boolean
  authError: string | null
  socket: any | null

  // ── Auth actions ─────────────────────────────────────────────────────────
  loginUser: (email: string, password: string) => Promise<boolean>
  registerUser: (name: string, email: string, password: string, role: "SEEKER" | "RECRUITER") => Promise<boolean>
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
  markNotificationsAsRead: () => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  deleteCandidate: (candidateId: string) => void
  setActiveView: (view: "Dashboard" | "Jobs" | "Candidates" | "Applications" | "Calendar" | "Messages" | "Analytics" | "Careers") => void
  setCareerSelectedJobId: (jobId: string) => void
  applyToJob: (jobId: string, applicant: { name: string; email: string; phone: string; title: string; location: string; linkedin?: string; coverLetter?: string }) => void
  setWorkspaceName: (name: string) => void
  setAddCandidateOpen: (open: boolean, col?: Candidate["status"]) => void
  setAddJobOpen: (open: boolean) => void
  setSelectedCandidateId: (id: string | null) => void
  fetchInitialData: () => Promise<void>

  // ── Seeker workspace ─────────────────────────────────────────────────────
  candidateActiveView: "Dashboard" | "Discover" | "Applications" | "Messages" | "Notifications" | "Calendar" | "Documents" | "Profile" | "Settings"
  publicJobs: PublicJob[]
  publicJobsLoading: boolean
  jobApplications: JobApplication[]
  discoverSearch: string
  discoverTypeFilter: string
  seekerProfile: SeekerProfileData | null
  setCandidateActiveView: (view: "Dashboard" | "Discover" | "Applications" | "Messages" | "Notifications" | "Calendar" | "Documents" | "Profile" | "Settings") => void
  moveJobApplication: (id: string, status: JobApplication["status"]) => void
  toggleJobBookmark: (id: string) => void
  applyFromDiscover: (publicJobId: string) => void
  saveJobFromDiscover: (publicJobId: string) => void
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
  updateProfile: (data: { name?: string; title?: string; location?: string }) => Promise<boolean>
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
    } catch { }
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
    const token = get().accessToken
    if (!token) return

    if (get().socket) get().socket.disconnect()

    const socket = io("http://localhost:3000", { auth: { token } })

    socket.on("application_status_updated", (data: any) => {
      set((state) => ({
        jobApplications: state.jobApplications.map((app) =>
          app.id === data.applicationId ? { ...app, status: data.status, tag: data.tag } : app
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
      // Append to active conversation if it matches
      if (get().activeConversationId === data.applicationId) {
        set((state) => ({
          conversationMessages: [
            ...state.conversationMessages,
            {
              id: data.id || String(Date.now()),
              applicationId: data.applicationId,
              senderId: data.senderId,
              senderType: data.senderType,
              text: data.text,
              read: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }))
      }
      // Refresh unread count
      get().fetchUnreadCount()
      // Update last message in conversations list
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.applicationId === data.applicationId
            ? { ...c, lastMessage: data.text, lastMessageTime: "Just now", unreadCount: c.unreadCount + 1 }
            : c
        ),
      }))
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
  addCandidateColumn: "Saved",
  isAddJobOpen: false,
  selectedCandidateId: null,
  setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),

  // ── Seeker workspace state ────────────────────────────────────────────────
  candidateActiveView: "Dashboard",
  discoverSearch: "",
  discoverTypeFilter: "All",
  profileUpdating: false,
  publicJobsLoading: false,
  seekerProfile: null,
  setCandidateActiveView: (view) => set({ candidateActiveView: view }),
  setDiscoverSearch: (q) => set({ discoverSearch: q }),
  setDiscoverTypeFilter: (t) => set({ discoverTypeFilter: t }),

  updateProfile: async (data) => {
    set({ profileUpdating: true })
    try {
      const updated = await apiFetch("/profile", { method: "PATCH", body: JSON.stringify(data) })
      const prev = get().user
      if (prev) {
        set({ user: { ...prev, name: updated.name ?? prev.name } })
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
      candidates: state.candidates.map((c) => c.id === candidateId ? { ...c, status: targetStatus } : c),
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
          email: candidateData.email || `${candidateData.name.toLowerCase().replace(/\s+/g, "")}@example.com`,
          phone: candidateData.phone,
          title: candidateData.title,
          location: candidateData.location,
          coverLetter: candidateData.coverLetter,
        }),
      })
      set((state) => ({
        candidates: [...state.candidates, {
          ...candidateData,
          id: dbCandidate.id,
          jobId,
          status: "Applied",
          bookmarked: false,
          dateText: "Just now",
          avatar: dbCandidate.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateData.name)}`,
        }],
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
          type: jobData.type,
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
        type: dbJob.type,
        posted: "Just now",
        status: "Active",
        color: dbJob.color || "purple",
      }
      set((state) => ({ jobs: [...state.jobs, newJob], selectedJobId: newJob.id, activeView: "Jobs" }))
    } catch (e) {
      console.warn("Failed to persist new job in database.", e)
    }
  },

  toggleBookmark: async (candidateId) => {
    const candidate = get().candidates.find((c) => c.id === candidateId)
    if (!candidate) return
    const isBookmarked = !candidate.bookmarked
    set((state) => ({
      candidates: state.candidates.map((c) => c.id === candidateId ? { ...c, bookmarked: isBookmarked } : c),
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
  markNotificationsAsRead: () =>
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) })),
  markNotificationRead: (id) =>
    set((state) => ({ notifications: state.notifications.map((n) => n.id === id ? { ...n, read: true } : n) })),
  clearNotifications: () => set({ notifications: [] }),

  deleteCandidate: async (candidateId) => {
    set((state) => ({ candidates: state.candidates.filter((c) => c.id !== candidateId) }))
    try {
      await apiFetch(`/applications/${candidateId}`, { method: "DELETE" })
    } catch (e) {
      console.warn("Failed to delete candidate from database.", e)
    }
  },

  setWorkspaceName: (name) => set({ workspaceName: name }),
  setAddCandidateOpen: (open, col = "Saved") => set({ isAddCandidateOpen: open, addCandidateColumn: col }),
  setAddJobOpen: (open) => set({ isAddJobOpen: open }),

  applyToJob: async (jobId, applicant) => {
    try {
      await apiFetch(`/applications/jobs/${jobId}/apply`, { method: "POST", body: JSON.stringify(applicant) })
      get().fetchInitialData()
    } catch (e) {
      console.warn("Failed to submit applicant data to database.", e)
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
          type: j.type,
          posted: "Posted " + new Date(j.createdAt).toLocaleDateString(),
          status: j.status === "ACTIVE" ? "Active" : "Closed",
          color: j.color || "purple",
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
          status: c.status === "IN_PROCESS" ? "In Process" : c.status === "OFFER" ? "Offer" : c.status === "ARCHIVED" ? "Archived" : c.status === "SAVED" ? "Saved" : "Applied",
          bookmarked: c.recruiterBookmarked,
          avatar: c.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}`,
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
              user: state.user ? { ...state.user, name: profile.name || state.user.name, avatar: profile.avatar || state.user.avatar } : state.user,
            }))
          }
        } catch { }

        get().fetchConversations()
        get().fetchUnreadCount()
        get().fetchEvents()

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
          type: a.job.type,
          salary: a.job.salary || "Competitive",
          appliedDate: new Date(a.appliedAt).toLocaleDateString(),
          status: a.status === "IN_PROCESS" ? "In Process" : a.status === "OFFER" ? "Offer" : a.status === "ARCHIVED" ? "Archived" : a.status === "SAVED" ? "Saved" : "Applied",
          bookmarked: a.seekerBookmarked,
          recruiterName: a.job.postedBy?.name || "Hiring Team",
          recruiterAvatar: a.job.postedBy?.avatar || `https://ui-avatars.com/api/?name=Hiring+Team`,
          interviewDate: a.calendarEvents?.[0]?.startTime ? new Date(a.calendarEvents[0].startTime).toLocaleDateString() : undefined,
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
          type: pj.type,
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

        // Fetch user profile data and store seeker profile
        try {
          const [meData, profileData] = await Promise.all([
            apiFetch("/profile/me"),
            apiFetch("/profile"),
          ])
          if (meData) {
            set((state) => ({
              user: state.user ? { ...state.user, name: meData.name || state.user.name, avatar: meData.avatar || state.user.avatar } : state.user,
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
                preferredType: profileData.preferredType || "Full Time",
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
        } catch { }

        get().fetchEvents()
        get().fetchDocuments()
        get().fetchConversations()
        get().fetchUnreadCount()
      }
    } catch (e) {
      console.warn("Failed to load workspace data from backend API.", e)
    }
  },

  // ── Seeker actions ─────────────────────────────────────────────────────────

  moveJobApplication: async (id, status) => {
    set((state) => ({
      jobApplications: state.jobApplications.map((a) => a.id === id ? { ...a, status } : a),
    }))
    try {
      await apiFetch(`/applications/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: status.toUpperCase().replace(" ", "_") }),
      })
    } catch (e) {
      console.warn("Failed to sync application status update to database.", e)
    }
  },

  toggleJobBookmark: async (id) => {
    const app = get().jobApplications.find((a) => a.id === id)
    if (!app) return
    const isBookmarked = !app.bookmarked
    set((state) => ({
      jobApplications: state.jobApplications.map((a) => a.id === id ? { ...a, bookmarked: isBookmarked } : a),
    }))
    try {
      await apiFetch(`/applications/${id}`, {
        method: "PUT",
        body: JSON.stringify({ seekerBookmarked: isBookmarked }),
      })
    } catch (e) {
      console.warn("Failed to update bookmark status in database.", e)
    }
  },

  applyFromDiscover: async (publicJobId) => {
    const seeker = get().user
    const profile = get().seekerProfile
    if (!seeker) return
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
      get().fetchInitialData()
    } catch (e) {
      console.warn("Failed to apply to job.", e)
    }
  },

  saveJobFromDiscover: async (publicJobId) => {
    const seeker = get().user
    const profile = get().seekerProfile
    if (!seeker) return
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
      get().fetchInitialData()
    } catch (e) {
      console.warn("Failed to save job.", e)
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
          notes: data.notes,
        }),
      })
      set((state) => ({
        events: [...state.events, {
          id: created.id,
          title: created.title,
          startTime: created.startTime,
          endTime: created.endTime,
          type: (created.type || "other").toLowerCase() as CalendarEvent["type"],
          applicationId: created.applicationId,
          notes: created.notes,
        }],
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
      if (mapped.length > 0) set({ documents: mapped })
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
        documents: [...state.documents, {
          id: created.id,
          name: created.name,
          type: (created.type || "other").toLowerCase() as Document["type"],
          size: created.size || meta.size,
          url: created.url || meta.url,
          active: created.active ?? true,
          createdAt: created.createdAt || new Date().toISOString(),
        }],
      }))
    } catch (e) {
      console.warn("Failed to upload document.", e)
    }
  },

  toggleDocumentActive: async (id) => {
    set((state) => ({
      documents: state.documents.map((d) => d.id === id ? { ...d, active: !d.active } : d),
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
          candidateName: isSeeker ? (app.job?.postedBy?.name || "Hiring Team") : (app.user?.name || "Candidate"),
          candidateAvatar: isSeeker ? (app.job?.postedBy?.avatar || `https://ui-avatars.com/api/?name=Hiring+Team`) : (app.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.user?.name || "C")}`),
          jobTitle: app.job?.title || "Position",
          company: app.job?.company?.name || "Company",
          lastMessage: lastMsg?.text || "No messages yet",
          lastMessageTime: lastMsg?.createdAt ? new Date(lastMsg.createdAt).toLocaleDateString() : "",
          unreadCount: app._count?.messages || 0,
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
    const senderType = get().user?.role === "RECRUITER" ? "RECRUITER" : "SEEKER"

    // Optimistic update
    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      applicationId,
      senderId: userId,
      senderType: senderType as any,
      text,
      read: false,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ conversationMessages: [...state.conversationMessages, optimistic] }))

    try {
      await apiFetch(`/messages/${applicationId}`, {
        method: "POST",
        body: JSON.stringify({ text }),
      })
      // Update conversation last message
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.applicationId === applicationId
            ? { ...c, lastMessage: text, lastMessageTime: "Just now" }
            : c
        ),
      }))
    } catch (e) {
      console.warn("Failed to send message.", e)
    }
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  fetchUnreadCount: async () => {
    try {
      const data = await apiFetch("/messages/unread-count")
      set({ unreadMessageCount: data?.count || 0 })
    } catch { /* swallow */ }
  },

  // ── AI Chat ────────────────────────────────────────────────────────────────

  aiChatMessages: [],
  aiChatLoading: false,
  aiChatOpen: false,

  sendAiChat: async (message) => {
    const history = get().aiChatMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
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
      set((state) => ({ aiChatMessages: [...state.aiChatMessages, fallback], aiChatLoading: false }))
    }
  },

  clearAiChat: () => set({ aiChatMessages: [] }),
  setAiChatOpen: (open) => set({ aiChatOpen: open }),
}))
