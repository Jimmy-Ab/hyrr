import type { Socket } from "socket.io-client"
import type {
  AiAnalysis,
  AiStatus,
  ApplicationStatusCode,
  ApplicationStatusLabel,
  CalendarEventType,
  ConversationClosedReason,
  DocumentType,
  JobType,
  MessageDeliveryStatus,
  MessageSenderType,
  NotificationAction,
  NotificationType,
  SeekerView,
  UserTheme,
} from "../lib/contracts"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Job {
  id: string
  title: string
  location: string
  type: string
  posted: string
  status: "Active" | "Closed" | "Draft"
  color: "purple" | "blue" | "green" | "orange"
  description: string
  requirements: string[]
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
  /** null = not scored yet */
  aiScore: number | null
  aiSummary?: string
  aiAnalysis: AiAnalysis | null
  /** null = never analysed */
  aiStatus: AiStatus | null
  aiModel: string | null
  aiScoredAt: string | null
  aiError: string | null
}

export interface NewCandidateInput {
  name: string
  email: string
  phone?: string
  title?: string
  location?: string
  status?: Candidate["status"]
}

export interface TeamMember {
  id: string
  userId: string
  name: string
  email: string
  avatar?: string
  role: "OWNER" | "RECRUITER" | "HIRING_MANAGER" | "VIEWER"
}

export interface JobUpdatePatch {
  title: string
  description: string
  location: string
  status: "ACTIVE" | "CLOSED" | "DRAFT"
  salaryMin: number
  salaryMax: number
  employmentType: string
  requirements: string[]
}

export interface ApplyInput {
  coverLetter?: string
  resumeUrl?: string
  phone?: string
}

export interface NotificationItem {
  id: string
  title: string
  /** Display label including the date */
  time: string
  createdAt: string
  read: boolean
  type: NotificationType
  /** Backend destination code (APPLICATIONS | DISCOVER | MESSAGES | CALENDAR) */
  action?: NotificationAction
  /** Seeker view for the backend destination */
  actionView?: SeekerView
  /** Entity the notification points at (applicationId for MESSAGE notifications) */
  targetId?: string
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
  phone?: string
  bio?: string
  skills: string[]
  languages: string[]
  expectedSalary?: string
  preferredType?: string
  availability?: string
  yearsOfExperience?: string
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
  /** ISO timestamp of the last update (falls back to appliedAt) */
  updatedAt: string
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
  /** The other party's display name */
  candidateName: string
  candidateAvatar: string
  jobId?: string
  jobTitle: string
  /** Company display name ("" when unknown) */
  company: string
  companyLogo?: string | null
  status?: ApplicationStatusCode
  /** Candidate applied without an account (recruiter side) */
  isGuest: boolean
  /** false when the thread is read-only (withdrawn / saved) */
  canSend: boolean
  closedReason?: ConversationClosedReason | null
  /** Text of the newest message ("" when none) */
  lastMessage: string
  /** Display label of the newest message time */
  lastMessageTime: string
  lastMessageAt: string | null
  unreadCount: number
  online?: boolean
}

export interface ChatMessage {
  id: string
  applicationId: string
  senderId: string | null
  senderType: MessageSenderType
  /** Display name of the sender, when the backend provides it */
  senderName?: string
  senderRole?: string
  senderAvatar?: string
  /** Client-generated id used for optimistic sends and de-duplication */
  clientId?: string | null
  /** Local delivery state; undefined for messages loaded from the server */
  status?: MessageDeliveryStatus
  text: string
  /** The other side has read it */
  read: boolean
  createdAt: string
}

export interface TypingState {
  name: string
  until: number
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

export type RecruiterView =
  | "Dashboard"
  | "Jobs"
  | "Candidates"
  | "Applications"
  | "Calendar"
  | "Messages"
  | "Analytics"
  | "Careers"
  | "Team"
  | "Settings"

export interface ProfileUpdateInput {
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
}

// ─── State Interface ───────────────────────────────────────────────────────────

export interface JobState {
  // ── Recruiter workspace ──────────────────────────────────────────────────
  jobs: Job[]
  candidates: Candidate[]
  selectedJobId: string
  activeView: RecruiterView
  careerSelectedJobId: string
  workspaceName: string
  isAddCandidateOpen: boolean
  addCandidateColumn: Candidate["status"]
  isAddJobOpen: boolean
  searchQuery: string
  theme: UserTheme
  notifications: NotificationItem[]
  selectedCandidateId: string | null
  team: TeamMember[]

  // ── Loading ──────────────────────────────────────────────────────────────
  isInitialLoading: boolean
  initialLoadError: string | null

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
  socket: Socket | null

  // ── Auth actions ─────────────────────────────────────────────────────────
  loginUser: (email: string, password: string) => Promise<boolean>
  registerUser: (
    name: string,
    email: string,
    password: string,
    role: "SEEKER" | "RECRUITER"
  ) => Promise<boolean>
  logout: () => Promise<void>
  /** Swaps the access token (login, restore, silent refresh). Never loads workspace data. */
  setAccessToken: (token: string | null) => void
  initializeSocket: () => void
  deleteAccount: (password?: string) => Promise<void>

  // ── Recruiter actions ────────────────────────────────────────────────────
  selectJob: (jobId: string) => void
  moveCandidate: (candidateId: string, targetStatus: Candidate["status"]) => Promise<void>
  addCandidate: (jobId: string, input: NewCandidateInput) => Promise<Candidate>
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
  }) => Promise<void>
  updateJob: (jobId: string, patch: Partial<JobUpdatePatch>) => Promise<void>
  deleteJob: (jobId: string) => Promise<void>
  toggleBookmark: (candidateId: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setTheme: (theme: UserTheme) => Promise<void>
  toggleTheme: () => Promise<void>
  fetchNotifications: () => Promise<void>
  markNotificationsAsRead: () => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  clearNotifications: () => Promise<void>
  deleteCandidate: (candidateId: string) => Promise<void>
  setActiveView: (view: RecruiterView) => void
  setCareerSelectedJobId: (jobId: string) => void
  applyToJob: (jobId: string, input?: ApplyInput) => Promise<void>
  setWorkspaceName: (name: string) => void
  setAddCandidateOpen: (open: boolean, col?: Candidate["status"]) => void
  setAddJobOpen: (open: boolean) => void
  setSelectedCandidateId: (id: string | null) => void
  fetchInitialData: (options?: { force?: boolean }) => Promise<void>
  fetchSeekerDashboard: () => Promise<void>

  // ── Team ─────────────────────────────────────────────────────────────────
  fetchTeam: () => Promise<void>
  addTeamMember: (email: string, role: "RECRUITER" | "HIRING_MANAGER" | "VIEWER") => Promise<void>
  removeTeamMember: (memberId: string) => Promise<void>

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
  fetchApplications: () => Promise<void>
  toggleJobBookmark: (id: string) => Promise<void>
  applyFromDiscover: (publicJobId: string, input?: ApplyInput) => Promise<void>
  saveJobFromDiscover: (publicJobId: string) => Promise<void>
  withdrawApplication: (applicationId: string) => Promise<void>
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
  /** Header data for the open thread (also for draft threads that have no messages yet) */
  activeThreadMeta: ConversationThread | null
  typingByThread: Record<string, TypingState>
  fetchConversations: () => Promise<void>
  /** Opens a thread: joins the room, loads meta + messages, marks it read. */
  openConversation: (applicationId: string) => Promise<void>
  /** Closes the open thread and leaves its room. */
  leaveConversation: () => void
  /** @deprecated alias of openConversation */
  fetchMessages: (applicationId: string) => Promise<void>
  sendMessage: (applicationId: string, text: string) => Promise<void>
  retryMessage: (applicationId: string, clientId: string) => Promise<void>
  sendTyping: (applicationId: string, isTyping: boolean) => void
  markConversationRead: (applicationId: string) => Promise<void>
  /** @deprecated thin alias: id → openConversation, null → leaveConversation */
  setActiveConversation: (id: string | null) => void
  deleteConversation: (applicationId: string) => Promise<void>
  unreadMessageCount: number
  fetchUnreadCount: () => Promise<void>

  // ── AI candidate analysis ────────────────────────────────────────────────
  analyzeCandidate: (candidateId: string) => Promise<void>

  // ── AI Chat ──────────────────────────────────────────────────────────────
  aiChatMessages: AiChatMessage[]
  aiChatLoading: boolean
  aiChatOpen: boolean
  sendAiChat: (message: string) => Promise<void>
  clearAiChat: () => void
  setAiChatOpen: (open: boolean) => void

  // ── Profile ──────────────────────────────────────────────────────────────
  profileUpdating: boolean
  updateProfile: (data: ProfileUpdateInput) => Promise<void>
}
