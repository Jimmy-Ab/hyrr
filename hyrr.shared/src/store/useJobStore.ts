import { io, type Socket } from "socket.io-client"
import { create } from "zustand"
import { ApiError, apiFetch } from "../lib/api"
import { SOCKET_URL } from "../lib/config"
import {
  type AiAnalysis,
  type AiStatus,
  APPLICATION_STATUS,
  type ApplicationStatusCode,
  applicationStatusCode,
  type ApplicationStatusLabel,
  applicationStatusLabel,
  type CalendarEventType,
  type ConversationClosedReason,
  type DocumentType,
  employmentTypeCode,
  employmentTypeLabel,
  isAiStatus,
  isApplicationStatus,
  isSeekerView,
  JOB_TYPE_OPTIONS,
  type JobType,
  type MessageDeliveryStatus,
  type MessageSenderType,
  type NotificationAction,
  notificationActionView,
  type NotificationType,
  type SeekerView,
  type UserTheme,
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a local date (YYYY-MM-DD) + time (HH:mm) into a full ISO string with offset. */
export function toIsoFromLocal(date: string, time: string): string {
  return new Date(`${date}T${time || "00:00"}`).toISOString()
}

/** Normalises a timestamp that may be a local "YYYY-MM-DDTHH:mm" value into ISO-8601 UTC. */
function normalizeIso(value?: string): string | undefined {
  if (!value) return value
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return new Date(value).toISOString()
  return value
}

/** Date + time label, e.g. "Nov 3, 10:42 AM" (year added when not the current year). */
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  })
}

/** The applicationId a MESSAGE notification points at, if any. */
export function notificationConversationId(n: {
  type: NotificationType
  action?: NotificationAction
  targetId?: string
}): string | null {
  if (!n.targetId) return null
  return n.type === "MESSAGE" || n.action === "MESSAGES" ? n.targetId : null
}

function avatarFor(name?: string | null) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}`
}

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err
  return new Error(fallback)
}

function applyThemeClass(theme: UserTheme) {
  if (typeof document === "undefined") return
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", !!dark)
}

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

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapJob(j: any): Job {
  return {
    id: j.id,
    title: j.title,
    location: j.location || "",
    type: j.type ? employmentTypeLabel(j.type) : "",
    posted: "Posted " + new Date(j.createdAt || Date.now()).toLocaleDateString(),
    status: j.status === "ACTIVE" ? "Active" : j.status === "DRAFT" ? "Draft" : "Closed",
    color: j.color || j.company?.color || "purple",
    description: j.description || "",
    requirements: Array.isArray(j.requirements) ? j.requirements : [],
  }
}

function mapCandidate(c: any): Candidate {
  const name = c.name || c.user?.name || "Candidate"
  return {
    id: c.id,
    jobId: c.jobId,
    name,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    title: c.title || "",
    location: c.location || "",
    coverLetter: c.coverLetter ?? undefined,
    resumeUrl: c.resumeUrl ?? undefined,
    dateText: new Date(c.appliedAt || c.createdAt || Date.now()).toLocaleDateString(),
    status: applicationStatusLabel(isApplicationStatus(c.status) ? c.status : "APPLIED"),
    bookmarked: !!c.recruiterBookmarked,
    avatar: c.user?.avatar || avatarFor(name),
    aiScore: typeof c.aiScore === "number" ? c.aiScore : null,
    aiSummary: c.aiSummary ?? undefined,
    aiAnalysis: mapAiAnalysis(c.aiAnalysis),
    aiStatus: isAiStatus(c.aiStatus) ? c.aiStatus : null,
    aiModel: c.aiModel ?? null,
    aiScoredAt: c.aiScoredAt ?? null,
    aiError: c.aiError ?? null,
    tag: c.tag ?? undefined,
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function mapAiAnalysis(a: any): AiAnalysis | null {
  if (!a || typeof a !== "object") return null
  const recommendation =
    a.recommendation === "STRONG_FIT" ||
    a.recommendation === "POSSIBLE_FIT" ||
    a.recommendation === "NOT_A_FIT"
      ? a.recommendation
      : "POSSIBLE_FIT"
  return {
    recommendation,
    summary: typeof a.summary === "string" ? a.summary : "",
    matchedSkills: stringList(a.matchedSkills),
    missingSkills: stringList(a.missingSkills),
    strengths: stringList(a.strengths),
    concerns: stringList(a.concerns),
    experienceFit: typeof a.experienceFit === "string" ? a.experienceFit : "",
    cvUsed: !!a.cvUsed,
    cvNote: typeof a.cvNote === "string" && a.cvNote ? a.cvNote : undefined,
  }
}

function mapPublicJob(pj: any): PublicJob {
  return {
    id: pj.id,
    title: pj.title,
    company: pj.company?.name || "Company",
    companyColor: pj.company?.color || "purple",
    location: pj.location || "",
    type: employmentTypeLabel(pj.type),
    salary: pj.salary || "Competitive",
    posted: new Date(pj.createdAt || Date.now()).toLocaleDateString(),
    description: pj.description || "",
    requirements: pj.requirements || [],
    skills: pj.skills || [],
    benefits: pj.benefits || [],
    featured: pj.featured,
    remote: pj.remote,
  }
}

function mapJobApplication(a: any): JobApplication {
  const job = a.job || {}
  return {
    id: a.id,
    publicJobId: a.jobId,
    company: job.company?.name || "Company",
    title: job.title || a.title || "Position",
    companyColor: job.company?.color || "purple",
    location: job.location || "",
    type: job.type ? employmentTypeLabel(job.type) : "",
    salary: job.salary || "Competitive",
    appliedDate: new Date(a.appliedAt || a.createdAt || Date.now()).toLocaleDateString(),
    updatedAt: a.updatedAt || a.appliedAt || new Date().toISOString(),
    status: isApplicationStatus(a.status) ? a.status : APPLICATION_STATUS.APPLIED,
    bookmarked: !!a.seekerBookmarked,
    recruiterName: job.postedBy?.name || "Hiring Team",
    recruiterAvatar: job.postedBy?.avatar || avatarFor("Hiring Team"),
    interviewDate: a.calendarEvents?.[0]?.startTime
      ? new Date(a.calendarEvents[0].startTime).toLocaleDateString()
      : undefined,
    offerAmount: a.offerAmount ?? undefined,
    notes: a.notes ?? undefined,
    tag: a.tag ?? undefined,
  }
}

function mapEvent(e: any): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime ?? undefined,
    type: (e.type || "other").toLowerCase() as CalendarEventType,
    applicationId: e.applicationId ?? undefined,
    meetingUrl: e.meetingUrl ?? undefined,
    location: e.location ?? undefined,
    notes: e.notes ?? undefined,
  }
}

function mapDocument(d: any): Document {
  return {
    id: d.id,
    name: d.name,
    type: (d.type || "other").toLowerCase() as DocumentType,
    size: d.size || "—",
    url: d.url || "",
    active: d.active ?? true,
    createdAt: d.createdAt || new Date().toISOString(),
  }
}

function mapNotification(n: any): NotificationItem {
  const createdAt = n.createdAt || new Date().toISOString()
  const action = typeof n.actionView === "string" ? n.actionView : undefined
  return {
    id: n.id || String(Date.now()),
    title: n.title || n.message || "New notification",
    time: formatDateTime(createdAt),
    createdAt,
    read: !!n.read,
    type: n.type || "SYSTEM",
    action: notificationActionView(action) ? (action as NotificationAction) : undefined,
    actionView: notificationActionView(action) || (isSeekerView(action) ? action : undefined),
    targetId: typeof n.targetId === "string" && n.targetId ? n.targetId : undefined,
  }
}

function mapMessage(m: any): ChatMessage {
  const senderType: MessageSenderType =
    m.senderType === "SEEKER" ||
    m.senderType === "RECRUITER" ||
    m.senderType === "ADMIN" ||
    m.senderType === "SYSTEM"
      ? m.senderType
      : m.senderId
        ? "RECRUITER"
        : "SYSTEM"
  return {
    id: m.id,
    applicationId: m.applicationId,
    senderId: m.senderId ?? null,
    senderType,
    senderName: m.sender?.name ?? m.senderName ?? undefined,
    senderRole: m.sender?.role ?? undefined,
    senderAvatar: m.sender?.avatar ?? undefined,
    clientId: m.clientId ?? null,
    status: "sent",
    text: typeof m.text === "string" ? m.text : "",
    read: !!m.read,
    createdAt: m.createdAt || new Date().toISOString(),
  }
}

function mapThread(t: any): ConversationThread {
  const name = t.candidateName || "Conversation"
  const last = t.lastMessage && typeof t.lastMessage === "object" ? t.lastMessage : null
  const lastAt: string | null = t.lastMessageAt || last?.createdAt || null
  const closedReason =
    t.closedReason === "WITHDRAWN" || t.closedReason === "SAVED" ? t.closedReason : null
  return {
    applicationId: t.applicationId,
    candidateName: name,
    candidateAvatar: t.avatar || avatarFor(name),
    jobId: t.jobId ?? undefined,
    jobTitle: t.jobTitle || "Position",
    company: t.company?.name || "",
    companyLogo: t.company?.logo ?? null,
    status: isApplicationStatus(t.status) ? t.status : undefined,
    isGuest: !!t.isGuest,
    canSend: t.canSend !== false,
    closedReason,
    lastMessage: last?.text || "",
    lastMessageTime: lastAt ? formatDateTime(lastAt) : "",
    lastMessageAt: lastAt,
    unreadCount: typeof t.unreadCount === "number" ? t.unreadCount : 0,
  }
}

/** Inserts or replaces a message, matching by server id first and then by clientId. */
function upsertMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  let idx = list.findIndex((m) => m.id === msg.id)
  if (idx < 0 && msg.clientId) idx = list.findIndex((m) => m.clientId === msg.clientId)
  if (idx < 0) return [...list, msg]
  const next = [...list]
  next[idx] = msg
  // A message that matched by id may still have a temp twin with the same clientId.
  return msg.clientId ? next.filter((m, i) => i === idx || m.clientId !== msg.clientId) : next
}

/** Moves (or inserts) a thread to the top of the inbox with a patch applied. */
function bumpThread(
  list: ConversationThread[],
  applicationId: string,
  patch: (t: ConversationThread) => ConversationThread,
  fallback?: ConversationThread | null
): ConversationThread[] {
  const existing = list.find((c) => c.applicationId === applicationId) ?? fallback ?? null
  if (!existing) return list
  return [patch(existing), ...list.filter((c) => c.applicationId !== applicationId)]
}

function newClientId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    // insecure context: fall through
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function isVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

function mapTeamMember(m: any): TeamMember {
  return {
    id: m.id,
    userId: m.userId || m.user?.id,
    name: m.user?.name || m.name || "",
    email: m.user?.email || m.email || "",
    avatar: m.user?.avatar || undefined,
    role: m.role,
  }
}

function mapSeekerProfile(p: any): SeekerProfileData {
  return {
    title: p.title || "",
    location: p.location || "",
    phone: p.phone || "",
    bio: p.bio || "",
    skills: p.skills || [],
    languages: p.languages || [],
    expectedSalary: p.expectedSalary || "",
    preferredType: p.preferredType || JOB_TYPE_OPTIONS[0],
    availability: p.availability || "",
    yearsOfExperience: p.yearsOfExperience || "",
    preferredLocations: p.preferredLocations || [],
    visibility: p.visibility || "public",
    website: p.website || "",
    github: p.github || "",
    linkedin: p.linkedin || "",
    experiences: p.experiences || [],
    educations: p.educations || [],
  }
}

// ─── Session bookkeeping (module level, not reactive) ─────────────────────────

let initialLoad: { userId: string; promise: Promise<void> } | null = null
let socketAuthRetries = 0
const SEND_ACK_TIMEOUT_MS = 8000
const READ_DEBOUNCE_MS = 500
const UNREAD_DEBOUNCE_MS = 300
const CONVERSATIONS_DEBOUNCE_MS = 300
const TYPING_TTL_MS = 4000
const TYPING_THROTTLE_MS = 2000
const TYPING_IDLE_MS = 3000

/** Monotonic token: responses of an older openConversation call are ignored. */
let openSeq = 0
let conversationsSeq = 0
const readTimers = new Map<string, ReturnType<typeof setTimeout>>()
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()
let unreadTimer: ReturnType<typeof setTimeout> | null = null
let conversationsTimer: ReturnType<typeof setTimeout> | null = null
let typingOut: { applicationId: string; lastEmit: number } | null = null
let typingIdleTimer: ReturnType<typeof setTimeout> | null = null
let visibilityListenerAttached = false
let socketConnectedOnce = false

class AckTimeoutError extends Error {}

function clearMessagingTimers() {
  readTimers.forEach((t) => clearTimeout(t))
  readTimers.clear()
  typingTimers.forEach((t) => clearTimeout(t))
  typingTimers.clear()
  if (unreadTimer) clearTimeout(unreadTimer)
  if (conversationsTimer) clearTimeout(conversationsTimer)
  if (typingIdleTimer) clearTimeout(typingIdleTimer)
  unreadTimer = conversationsTimer = typingIdleTimer = null
  typingOut = null
  socketConnectedOnce = false
}

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

// ─── Store ────────────────────────────────────────────────────────────────────

export const useJobStore = create<JobState>((set, get) => {
  /** Ensures the seeker application payload sent to /apply satisfies the DTO. */
  const applicantBody = (input: ApplyInput = {}) => {
    const user = get().user
    const profile = get().seekerProfile
    return {
      name: user?.name || user?.email?.split("@")[0] || "Applicant",
      email: user?.email || "",
      title: profile?.title || "Job Seeker",
      location: profile?.location || "Remote",
      ...(input.phone || profile?.phone ? { phone: input.phone || profile?.phone } : {}),
      ...(input.coverLetter ? { coverLetter: input.coverLetter } : {}),
      ...(input.resumeUrl ? { resumeUrl: input.resumeUrl } : {}),
    }
  }

  // ── Messaging helpers (closure) ─────────────────────────────────────────────

  const mySide = (): "SEEKER" | "RECRUITER" =>
    get().user?.role === "SEEKER" ? "SEEKER" : "RECRUITER"

  const scheduleRead = (applicationId: string) => {
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

  const scheduleUnreadFetch = () => {
    if (unreadTimer) clearTimeout(unreadTimer)
    unreadTimer = setTimeout(() => {
      unreadTimer = null
      void get().fetchUnreadCount()
    }, UNREAD_DEBOUNCE_MS)
  }

  const scheduleConversationsFetch = () => {
    if (conversationsTimer) clearTimeout(conversationsTimer)
    conversationsTimer = setTimeout(() => {
      conversationsTimer = null
      void get().fetchConversations()
    }, CONVERSATIONS_DEBOUNCE_MS)
  }

  const patchMessage = (clientId: string, patch: Partial<ChatMessage>) =>
    set((state) => ({
      conversationMessages: state.conversationMessages.map((m) =>
        m.clientId === clientId ? { ...m, ...patch } : m
      ),
    }))

  /** Socket first (8s ack); on timeout / no connection, one REST attempt with the same clientId. */
  const deliverMessage = async (applicationId: string, text: string, clientId: string) => {
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

  const runSend = async (applicationId: string, text: string, clientId: string) => {
    try {
      const saved = await deliverMessage(applicationId, text, clientId)
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
        scheduleConversationsFetch()
      }
    } catch (err) {
      patchMessage(clientId, { status: "failed" })
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

  const loadSettings = async () => {
    try {
      const settings = await apiFetch("/settings")
      const theme = settings?.theme
      if (theme === "light" || theme === "dark" || theme === "system") {
        set({ theme })
        applyThemeClass(theme)
      }
    } catch (e) {
      console.warn("Failed to load settings.", e)
    }
  }

  const loadMe = async () => {
    const me = await apiFetch("/profile/me")
    if (!me) return me
    set((state) => ({
      user: state.user
        ? {
            ...state.user,
            name: me.name || state.user.name,
            email: me.email || state.user.email,
            avatar: me.avatar || state.user.avatar,
          }
        : state.user,
    }))
    return me
  }

  const loadRecruiter = async () => {
    const [dbJobs, dbCandidates] = await Promise.all([
      apiFetch("/jobs"),
      apiFetch("/applications/candidates"),
    ])
    const jobsList: Job[] = (dbJobs || []).map(mapJob)
    const candidatesList: Candidate[] = (dbCandidates || []).map(mapCandidate)
    set((state) => ({
      jobs: jobsList,
      candidates: candidatesList,
      // "" = All jobs (the board's default); keep an explicit selection while it still exists.
      selectedJobId: jobsList.some((j) => j.id === state.selectedJobId) ? state.selectedJobId : "",
    }))

    const secondary = [
      loadMe().then((me) => {
        if (me?.company?.name) set({ workspaceName: me.company.name })
      }),
      loadSettings(),
      get()
        .fetchTeam()
        .catch((e) => console.warn("Failed to load team.", e)),
      get().fetchConversations(),
      get().fetchUnreadCount(),
      get().fetchEvents(),
      get().fetchNotifications(),
    ]
    await Promise.allSettled(secondary)
  }

  const loadSeeker = async () => {
    set({ publicJobsLoading: true })
    try {
      const [dbApps, dbDiscover] = await Promise.all([
        apiFetch("/applications/my"),
        apiFetch("/jobs/public"),
      ])
      const publicJobsList: PublicJob[] = (dbDiscover || []).map(mapPublicJob)
      set({
        jobApplications: (dbApps || []).map(mapJobApplication),
        publicJobs: publicJobsList,
      })

      const recommendations = apiFetch("/ai/featured-jobs")
        .then((recs) => set({ recommendedJobs: (recs || []).map(mapPublicJob) }))
        .catch(() => {
          // AI provider unavailable: fall back to backend-flagged featured roles.
          set({ recommendedJobs: publicJobsList.filter((job) => job.featured) })
        })

      const profile = Promise.all([loadMe(), apiFetch("/profile")]).then(([, profileData]) => {
        if (profileData) set({ seekerProfile: mapSeekerProfile(profileData) })
      })

      await Promise.allSettled([
        recommendations,
        profile,
        loadSettings(),
        get().fetchEvents(),
        get().fetchDocuments(),
        get().fetchConversations(),
        get().fetchUnreadCount(),
        get().fetchNotifications(),
      ])
    } finally {
      set({ publicJobsLoading: false })
    }
  }

  return {
    // ── Auth initial state ───────────────────────────────────────────────────
    user: null,
    accessToken: null,
    isAuthenticated: false,
    authLoading: false,
    authError: null,
    socket: null,
    isInitialLoading: false,
    initialLoadError: null,

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
      initialLoad = null
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
        initialLoad = null
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

    initializeSocket: () => {
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
        socketAuthRetries = 0
        const activeAppId = get().activeConversationId
        if (activeAppId) socket.emit("join_chat", { applicationId: activeAppId })
        if (socketConnectedOnce) {
          // Reconnected: catch up on anything missed while offline.
          if (activeAppId)
            void get()
              .openConversation(activeAppId)
              .catch(() => {})
          scheduleConversationsFetch()
          scheduleUnreadFetch()
        }
        socketConnectedOnce = true
      })

      if (!visibilityListenerAttached && typeof document !== "undefined") {
        visibilityListenerAttached = true
        document.addEventListener("visibilitychange", () => {
          const activeId = get().activeConversationId
          if (activeId && isVisible() && get().isAuthenticated) {
            void get().markConversationRead(activeId)
          }
        })
      }

      // The server disconnects sockets with an expired/invalid token. Refresh once and retry.
      const recoverAuth = () => {
        if (!get().accessToken || socketAuthRetries >= 2) return
        socketAuthRetries += 1
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

      socket.on("application_status_updated", (data: any) => {
        if (!isApplicationStatus(data?.status)) return
        const status = data.status as ApplicationStatusCode
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

        if (!known && !fallback) scheduleConversationsFetch()
        if (seenNow && !fromMe) scheduleRead(applicationId)
      })

      socket.on("messages_read", (data: any) => {
        const applicationId = data?.applicationId
        if (!applicationId || !data.readerSide || data.readerSide === mySide()) return
        if (get().activeConversationId !== applicationId) return
        const side = mySide()
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

      socket.on("notification", (data: any) => {
        const item = mapNotification(data || {})
        set((state) =>
          state.notifications.some((n) => n.id === item.id)
            ? {}
            : { notifications: [item, ...state.notifications] }
        )
      })

      socket.on("unread_update", () => {
        scheduleUnreadFetch()
      })

      set({ socket })
    },

    // ── Recruiter workspace state ─────────────────────────────────────────────
    activeView: "Applications",
    setActiveView: (view) => set({ activeView: view, searchQuery: "" }),
    careerSelectedJobId: "",
    setCareerSelectedJobId: (jobId) => set({ careerSelectedJobId: jobId }),
    workspaceName: "",
    isAddCandidateOpen: false,
    addCandidateColumn: "Applied",
    isAddJobOpen: false,
    selectedCandidateId: null,
    setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),
    team: [],

    // ── Seeker workspace state ────────────────────────────────────────────────
    candidateActiveView: "Dashboard",
    discoverSearch: "",
    discoverTypeFilter: "All",
    profileUpdating: false,
    publicJobsLoading: false,
    recommendedJobs: [],
    seekerDashboard: null,
    seekerProfile: null,
    setCandidateActiveView: (view) => set({ candidateActiveView: view, searchQuery: "" }),
    setDiscoverSearch: (q) => set({ discoverSearch: q }),
    setDiscoverTypeFilter: (t) => set({ discoverTypeFilter: t }),

    updateProfile: async (data) => {
      set({ profileUpdating: true })
      try {
        const updated = await apiFetch("/profile", { method: "PUT", body: JSON.stringify(data) })
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                name: updated?.user?.name ?? data.name ?? state.user.name,
                avatar: updated?.user?.avatar ?? data.avatar ?? state.user.avatar,
              }
            : state.user,
          seekerProfile:
            state.user?.role === "SEEKER"
              ? updated && typeof updated === "object" && "skills" in updated
                ? mapSeekerProfile(updated)
                : state.seekerProfile
                  ? ({ ...state.seekerProfile, ...data } as SeekerProfileData)
                  : state.seekerProfile
              : state.seekerProfile,
        }))
      } finally {
        set({ profileUpdating: false })
      }
    },

    publicJobs: [],
    jobApplications: [],
    jobs: [],
    selectedJobId: "",
    searchQuery: "",
    theme: "light",
    notifications: [],
    candidates: [],

    // ── Recruiter actions ──────────────────────────────────────────────────────

    selectJob: (jobId) => set({ selectedJobId: jobId }),

    moveCandidate: async (candidateId, targetStatus) => {
      const previous = get().candidates.find((c) => c.id === candidateId)
      if (!previous) return
      set((state) => ({
        candidates: state.candidates.map((c) =>
          c.id === candidateId ? { ...c, status: targetStatus } : c
        ),
      }))
      try {
        const updated = await apiFetch(`/applications/${candidateId}`, {
          method: "PUT",
          body: JSON.stringify({ status: applicationStatusCode(targetStatus) }),
        })
        if (updated?.id) {
          const merged = mapCandidate(updated)
          set((state) => ({
            candidates: state.candidates.map((c) =>
              c.id === candidateId
                ? {
                    ...c,
                    status: merged.status,
                    tag: merged.tag,
                    aiScore: updated.aiScore !== undefined ? merged.aiScore : c.aiScore,
                    aiSummary: merged.aiSummary ?? c.aiSummary,
                  }
                : c
            ),
          }))
        }
      } catch (err) {
        set((state) => ({
          candidates: state.candidates.map((c) => (c.id === candidateId ? previous : c)),
        }))
        throw toError(err, "Failed to update candidate status")
      }
    },

    addCandidate: async (jobId, input) => {
      const created = await apiFetch(`/applications/jobs/${jobId}/candidates`, {
        method: "POST",
        body: JSON.stringify({
          candidateName: input.name,
          email: input.email,
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.title ? { title: input.title } : {}),
          ...(input.location ? { location: input.location } : {}),
          ...(input.status ? { status: applicationStatusCode(input.status) } : {}),
        }),
      })
      const candidate = mapCandidate({ jobId, ...created, name: created?.name || input.name })
      set((state) => ({
        candidates: [candidate, ...state.candidates.filter((c) => c.id !== candidate.id)],
      }))
      return candidate
    },

    addJob: async (jobData) => {
      const dbJob = await apiFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: jobData.title,
          location: jobData.location,
          type: employmentTypeCode(jobData.type as JobType),
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
      const newJob = mapJob({
        ...dbJob,
        description: dbJob?.description || jobData.description,
        requirements: dbJob?.requirements || jobData.requirements,
      })
      // Keep the board's current filter: jumping to the new (empty) job hid every candidate.
      set((state) => ({ jobs: [...state.jobs, newJob] }))
    },

    updateJob: async (jobId, patch) => {
      const previous = get().jobs.find((j) => j.id === jobId)
      const body: Record<string, unknown> = { ...patch }
      if (patch.employmentType) {
        body.employmentType =
          employmentTypeCode(patch.employmentType as JobType) || patch.employmentType
      }
      if (previous) {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.description !== undefined ? { description: patch.description } : {}),
                  ...(patch.location !== undefined ? { location: patch.location } : {}),
                  ...(patch.requirements !== undefined ? { requirements: patch.requirements } : {}),
                  ...(patch.employmentType !== undefined
                    ? { type: employmentTypeLabel(patch.employmentType as JobType) }
                    : {}),
                  ...(patch.status !== undefined
                    ? { status: mapJob({ status: patch.status }).status }
                    : {}),
                }
              : j
          ),
        }))
      }
      try {
        const updated = await apiFetch(`/jobs/${jobId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
        if (updated?.id) {
          set((state) => ({
            jobs: state.jobs.map((j) =>
              j.id === jobId
                ? { ...j, ...mapJob({ ...updated, color: updated.color || j.color }) }
                : j
            ),
          }))
        }
      } catch (err) {
        if (previous) {
          set((state) => ({ jobs: state.jobs.map((j) => (j.id === jobId ? previous : j)) }))
        }
        throw toError(err, "Failed to update job")
      }
    },

    deleteJob: async (jobId) => {
      const prevJobs = get().jobs
      const prevCandidates = get().candidates
      const prevSelected = get().selectedJobId
      set((state) => {
        const jobs = state.jobs.filter((j) => j.id !== jobId)
        return {
          jobs,
          candidates: state.candidates.filter((c) => c.jobId !== jobId),
          selectedJobId: state.selectedJobId === jobId ? "" : state.selectedJobId,
        }
      })
      try {
        await apiFetch(`/jobs/${jobId}`, { method: "DELETE" })
      } catch (err) {
        set({ jobs: prevJobs, candidates: prevCandidates, selectedJobId: prevSelected })
        throw toError(err, "Failed to delete job")
      }
    },

    toggleBookmark: async (candidateId) => {
      const candidate = get().candidates.find((c) => c.id === candidateId)
      if (!candidate) return
      const isBookmarked = !candidate.bookmarked
      const setFlag = (value: boolean) =>
        set((state) => ({
          candidates: state.candidates.map((c) =>
            c.id === candidateId ? { ...c, bookmarked: value } : c
          ),
        }))
      setFlag(isBookmarked)
      try {
        await apiFetch(`/applications/${candidateId}`, {
          method: "PUT",
          body: JSON.stringify({ recruiterBookmarked: isBookmarked }),
        })
      } catch (err) {
        setFlag(candidate.bookmarked)
        throw toError(err, "Failed to update bookmark")
      }
    },

    setSearchQuery: (query) => set({ searchQuery: query }),

    setTheme: async (theme) => {
      const previous = get().theme
      set({ theme })
      applyThemeClass(theme)
      try {
        await apiFetch("/settings", { method: "PUT", body: JSON.stringify({ theme }) })
      } catch (err) {
        set({ theme: previous })
        applyThemeClass(previous)
        throw toError(err, "Failed to save theme")
      }
    },

    toggleTheme: async () => {
      const next: UserTheme = get().theme === "dark" ? "light" : "dark"
      try {
        await get().setTheme(next)
      } catch (e) {
        console.warn("Failed to persist theme.", e)
      }
    },

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

    deleteCandidate: async (candidateId) => {
      const previous = get().candidates
      set({ candidates: previous.filter((c) => c.id !== candidateId) })
      try {
        await apiFetch(`/applications/${candidateId}`, { method: "DELETE" })
      } catch (err) {
        set({ candidates: previous })
        throw toError(err, "Failed to delete candidate")
      }
    },

    setWorkspaceName: (name) => set({ workspaceName: name }),
    setAddCandidateOpen: (open, col = "Applied") =>
      set({ isAddCandidateOpen: open, addCandidateColumn: col }),
    setAddJobOpen: (open) => set({ isAddJobOpen: open }),

    // ── Team ─────────────────────────────────────────────────────────────────

    fetchTeam: async () => {
      const data = await apiFetch("/talent/team")
      set({ team: (data || []).map(mapTeamMember) })
    },

    addTeamMember: async (email, role) => {
      const created = await apiFetch("/talent/team", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      })
      const member = mapTeamMember(created)
      set((state) => ({ team: [...state.team.filter((m) => m.id !== member.id), member] }))
    },

    removeTeamMember: async (memberId) => {
      const previous = get().team
      set({ team: previous.filter((m) => m.id !== memberId) })
      try {
        await apiFetch(`/talent/team/${memberId}`, { method: "DELETE" })
      } catch (err) {
        set({ team: previous })
        throw toError(err, "Failed to remove team member")
      }
    },

    // ── Initial data ─────────────────────────────────────────────────────────

    fetchSeekerDashboard: async () => {
      try {
        const dashboard = await apiFetch("/dashboard/seeker")
        set({ seekerDashboard: dashboard })
      } catch (e) {
        console.warn("Failed to load seeker dashboard.", e)
      }
    },

    fetchInitialData: (options) => {
      const user = get().user
      if (!user?.role || !get().accessToken) return Promise.resolve()
      if (!options?.force && initialLoad && initialLoad.userId === user.id) {
        return initialLoad.promise
      }

      const run = async () => {
        set({ isInitialLoading: true, initialLoadError: null })
        try {
          if (user.role === "RECRUITER") await loadRecruiter()
          else if (user.role === "SEEKER") await loadSeeker()
          else await loadSettings()
          set({ isInitialLoading: false })
        } catch (err) {
          // Allow a retry via fetchInitialData({ force: true }) or a fresh call.
          if (initialLoad?.userId === user.id) initialLoad = null
          set({
            isInitialLoading: false,
            initialLoadError: toError(err, "Failed to load your workspace").message,
          })
        }
      }
      const promise = run()
      initialLoad = { userId: user.id, promise }
      return promise
    },

    // ── Seeker actions ─────────────────────────────────────────────────────────

    fetchApplications: async () => {
      const dbApps = await apiFetch("/applications/my")
      set({ jobApplications: (dbApps || []).map(mapJobApplication) })
    },

    applyToJob: async (jobId, input = {}) => {
      await apiFetch(`/applications/jobs/${jobId}/apply`, {
        method: "POST",
        body: JSON.stringify(applicantBody(input)),
      })
      // The apply response is seeker-safe but lacks job relations; reload the list.
      try {
        await get().fetchApplications()
      } catch (e) {
        console.warn("Applied, but failed to refresh applications.", e)
      }
    },

    applyFromDiscover: async (publicJobId, input) => get().applyToJob(publicJobId, input),

    saveJobFromDiscover: async (publicJobId) => {
      await apiFetch(`/applications/jobs/${publicJobId}/save`, {
        method: "POST",
        body: JSON.stringify(applicantBody()),
      })
      try {
        await get().fetchApplications()
      } catch (e) {
        console.warn("Saved, but failed to refresh applications.", e)
      }
    },

    toggleJobBookmark: async (id) => {
      const app = get().jobApplications.find((a) => a.id === id)
      if (!app) return
      const setFlag = (value: boolean) =>
        set((state) => ({
          jobApplications: state.jobApplications.map((a) =>
            a.id === id ? { ...a, bookmarked: value } : a
          ),
        }))
      setFlag(!app.bookmarked)
      try {
        await apiFetch(`/applications/${id}`, {
          method: "PUT",
          body: JSON.stringify({ seekerBookmarked: !app.bookmarked }),
        })
      } catch (err) {
        setFlag(app.bookmarked)
        throw toError(err, "Failed to update bookmark")
      }
    },

    withdrawApplication: async (applicationId) => {
      const previous = get().jobApplications
      const app = previous.find((a) => a.id === applicationId)
      if (!app) return
      const isSaved = app.status === APPLICATION_STATUS.SAVED
      set({
        jobApplications: isSaved
          ? previous.filter((a) => a.id !== applicationId)
          : previous.map((a) =>
              a.id === applicationId
                ? {
                    ...a,
                    status: APPLICATION_STATUS.WITHDRAWN,
                    updatedAt: new Date().toISOString(),
                  }
                : a
            ),
      })
      try {
        const res = await apiFetch(`/applications/${applicationId}`, { method: "DELETE" })
        if (res?.deleted) {
          set((state) => ({
            jobApplications: state.jobApplications.filter((a) => a.id !== applicationId),
          }))
        } else if (isApplicationStatus(res?.status)) {
          set((state) => ({
            jobApplications: state.jobApplications.map((a) =>
              a.id === applicationId ? { ...a, status: res.status } : a
            ),
          }))
        }
      } catch (err) {
        set({ jobApplications: previous })
        throw toError(err, "Failed to withdraw application")
      }
    },

    // ── Calendar ───────────────────────────────────────────────────────────────

    events: [],
    eventsLoading: false,

    fetchEvents: async () => {
      set({ eventsLoading: true })
      try {
        const data = await apiFetch("/calendar")
        set({ events: (data || []).map(mapEvent) })
      } catch (e) {
        console.warn("Failed to load calendar events.", e)
      } finally {
        set({ eventsLoading: false })
      }
    },

    createEvent: async (data) => {
      const created = await apiFetch("/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          startTime: normalizeIso(data.startTime),
          endTime: normalizeIso(data.endTime),
          type: data.type?.toUpperCase(),
          applicationId: data.applicationId || undefined,
          meetingUrl: data.meetingUrl || undefined,
          location: data.location || undefined,
          notes: data.notes || undefined,
        }),
      })
      const mapped = mapEvent({
        ...created,
        meetingUrl: created?.meetingUrl ?? data.meetingUrl,
        location: created?.location ?? data.location,
      })
      set((state) => ({ events: [...state.events, mapped] }))
    },

    deleteEvent: async (id) => {
      const previous = get().events
      set({ events: previous.filter((e) => e.id !== id) })
      try {
        await apiFetch(`/calendar/${id}`, { method: "DELETE" })
      } catch (err) {
        set({ events: previous })
        throw toError(err, "Failed to delete event")
      }
    },

    // ── Documents ──────────────────────────────────────────────────────────────

    documents: [],
    documentsLoading: false,

    fetchDocuments: async () => {
      set({ documentsLoading: true })
      try {
        const data = await apiFetch("/documents")
        set({ documents: (data || []).map(mapDocument) })
      } catch (e) {
        console.warn("Failed to load documents.", e)
      } finally {
        set({ documentsLoading: false })
      }
    },

    uploadDocument: async (meta) => {
      const created = await apiFetch("/documents", {
        method: "POST",
        body: JSON.stringify(meta),
      })
      const doc = mapDocument({ ...created, size: created?.size || meta.size })
      set((state) => ({
        documents: [
          doc,
          // Backend deactivates other resumes when a new resume is uploaded.
          ...state.documents.map((d) =>
            doc.type === "resume" && d.type === "resume" ? { ...d, active: false } : d
          ),
        ],
      }))
    },

    toggleDocumentActive: async (id) => {
      const previous = get().documents
      const target = previous.find((d) => d.id === id)
      if (!target) return
      const activating = !target.active
      set({
        documents: previous.map((d) => {
          if (d.id === id) return { ...d, active: activating }
          if (activating && target.type === "resume" && d.type === "resume") {
            return { ...d, active: false }
          }
          return d
        }),
      })
      try {
        await apiFetch(`/documents/${id}/toggle`, { method: "PUT" })
      } catch (err) {
        set({ documents: previous })
        throw toError(err, "Failed to update document")
      }
    },

    deleteDocument: async (id) => {
      const previous = get().documents
      set({ documents: previous.filter((d) => d.id !== id) })
      try {
        await apiFetch(`/documents/${id}`, { method: "DELETE" })
      } catch (err) {
        set({ documents: previous })
        throw toError(err, "Failed to delete document")
      }
    },

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
      const seq = ++conversationsSeq
      set({ conversationsLoading: true })
      try {
        const data = await apiFetch("/messages/conversations")
        if (seq !== conversationsSeq) return
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
        if (seq === conversationsSeq) set({ conversationsLoading: false })
      }
    },

    openConversation: async (applicationId) => {
      const state = get()
      const previousId = state.activeConversationId
      const sock = state.socket
      const switching = previousId !== applicationId
      if (switching && previousId) {
        if (sock?.connected) sock.emit("leave_chat", { applicationId: previousId })
        if (typingOut?.applicationId === previousId) get().sendTyping(previousId, false)
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

      const seq = ++openSeq
      try {
        const [meta, messages] = await Promise.all([
          apiFetch(`/messages/${applicationId}/meta`),
          apiFetch(`/messages/${applicationId}`),
        ])
        if (seq !== openSeq || get().activeConversationId !== applicationId) return
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
        if (seq === openSeq && get().activeConversationId === applicationId) {
          // Thread is gone or not accessible: close it instead of showing an empty shell.
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
            get().leaveConversation()
          } else {
            set({ messagesLoading: false })
          }
        }
        throw toError(err, "Failed to load messages")
      }
      if (seq === openSeq) set({ messagesLoading: false })
      await get().markConversationRead(applicationId)
    },

    leaveConversation: () => {
      const previousId = get().activeConversationId
      openSeq += 1
      if (previousId) {
        if (typingOut?.applicationId === previousId) get().sendTyping(previousId, false)
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
      if (typingOut?.applicationId === applicationId) get().sendTyping(applicationId, false)
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
      await runSend(applicationId, body, clientId)
    },

    retryMessage: async (applicationId, clientId) => {
      const msg = get().conversationMessages.find((m) => m.clientId === clientId)
      if (!msg || msg.status === "sending") return
      patchMessage(clientId, { status: "sending", createdAt: new Date().toISOString() })
      await runSend(applicationId, msg.text, clientId)
    },

    sendTyping: (applicationId, isTyping) => {
      const sock = get().socket
      const emit = (value: boolean) => {
        if (sock?.connected) sock.emit("typing", { applicationId, isTyping: value })
      }
      if (typingIdleTimer) clearTimeout(typingIdleTimer)
      typingIdleTimer = null
      if (!isTyping) {
        if (typingOut?.applicationId === applicationId) emit(false)
        if (typingOut?.applicationId === applicationId) typingOut = null
        return
      }
      const now = Date.now()
      if (typingOut && typingOut.applicationId !== applicationId) {
        if (sock?.connected) {
          sock.emit("typing", { applicationId: typingOut.applicationId, isTyping: false })
        }
        typingOut = null
      }
      if (!typingOut || now - typingOut.lastEmit >= TYPING_THROTTLE_MS) {
        emit(true)
        typingOut = { applicationId, lastEmit: now }
      }
      // Stop the indicator after a pause in typing.
      typingIdleTimer = setTimeout(() => get().sendTyping(applicationId, false), TYPING_IDLE_MS)
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
        openSeq += 1
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
        scheduleUnreadFetch()
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
  }
})
