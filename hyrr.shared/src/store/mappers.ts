import {
  type AiAnalysis,
  APPLICATION_STATUS,
  applicationStatusLabel,
  type CalendarEventType,
  type DocumentType,
  employmentTypeLabel,
  isAiStatus,
  isApplicationStatus,
  isSeekerView,
  JOB_TYPE_OPTIONS,
  type JobType,
  type MessageSenderType,
  type NotificationAction,
  notificationActionView,
  type NotificationType,
  type UserTheme,
} from "../lib/contracts"
import type {
  AlertFrequency,
  ApplicationSource,
  CalendarEvent,
  Candidate,
  CandidateLabel,
  CandidateNote,
  ChatMessage,
  CompanyProfile,
  ConversationThread,
  CvSuggestions,
  Document,
  InterviewInvite,
  Job,
  JobAlertItem,
  JobApplication,
  JobMatch,
  NotificationItem,
  Offer,
  PublicJob,
  SavedSearchFilters,
  SavedSearchItem,
  ScreeningQuestion,
  SeekerProfileData,
  TeamMember,
  TimelineEntry,
} from "./types"

export function decodeJwt(token: string) {
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
export function normalizeIso(value?: string): string | undefined {
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

export function avatarFor(name?: string | null) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}`
}

export function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err
  return new Error(fallback)
}

export function applyThemeClass(theme: UserTheme) {
  if (typeof document === "undefined") return
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", !!dark)
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

export function mapJob(j: any): Job {
  return {
    id: j.id,
    title: j.title,
    location: j.location || "",
    type: j.type ? employmentTypeLabel(j.type) : "",
    posted: "Posted " + new Date(j.createdAt || Date.now()).toLocaleDateString(),
    status: mapJobStatus(j.status),
    color: j.color || j.company?.color || "purple",
    description: j.description || "",
    requirements: Array.isArray(j.requirements) ? j.requirements : [],
    companyVerified: j.company?.verified === true,
    remote: !!j.remote,
    salary: j.salary ?? undefined,
    salaryMin: j.salaryMin ?? null,
    salaryMax: j.salaryMax ?? null,
    salaryCurrency: j.salaryCurrency ?? null,
    salaryPeriod: j.salaryPeriod ?? null,
    categoryId: j.categoryId ?? j.category?.id ?? undefined,
    featured: !!j.featured,
    featuredUntil: j.featuredUntil ?? null,
    publishedAt: j.publishedAt ?? null,
    removedAt: j.removedAt ?? null,
    removedReason: j.removedReason ?? null,
    momentumCost: typeof j.momentumCost === "number" ? j.momentumCost : undefined,
  }
}

export function mapJobStatus(status: unknown): Job["status"] {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "DRAFT":
      return "Draft"
    case "FLAGGED":
      return "Flagged"
    default:
      return "Closed"
  }
}

export function mapCandidate(c: any): Candidate {
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
    source: mapApplicationSource(c.source),
    labels: Array.isArray(c.labels) ? c.labels.map(mapLabel) : [],
    notesCount: typeof c.notesCount === "number" ? c.notesCount : 0,
    screeningAnswers: Array.isArray(c.screeningAnswers)
      ? c.screeningAnswers.map((a: any) => ({
          questionId: String(a.questionId ?? ""),
          question: typeof a.question === "string" ? a.question : "",
          answer: typeof a.answer === "string" ? a.answer : "",
        }))
      : [],
  }
}

export function mapApplicationSource(value: unknown): ApplicationSource {
  return value === "GUEST" || value === "RECRUITER_ADDED" ? value : "DIRECT"
}

export function mapLabel(l: any): CandidateLabel {
  // Accepts both { id, name, color } and join rows shaped { label: { ... } }.
  const src = l?.label && typeof l.label === "object" ? l.label : l
  return {
    id: src?.id,
    name: src?.name || "",
    color: src?.color || "gray",
    ...(typeof src?.count === "number" ? { count: src.count } : {}),
  }
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

export function mapAiAnalysis(a: any): AiAnalysis | null {
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

export function mapPublicJob(pj: any): PublicJob {
  return {
    id: pj.id,
    title: pj.title,
    company: pj.company?.name || "Company",
    companyColor: pj.company?.color || "purple",
    companyVerified: pj.company?.verified === true,
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
    ...(pj.match && typeof pj.match === "object" ? { match: mapJobMatch(pj.match) } : {}),
  }
}

export function mapJobMatch(m: any): JobMatch {
  const score = typeof m?.score === "number" ? Math.max(0, Math.min(100, Math.round(m.score))) : 0
  return { score, reasons: stringList(m?.reasons).slice(0, 4) }
}

const ALERT_FREQUENCIES: AlertFrequency[] = ["INSTANT", "DAILY", "WEEKLY"]

export function mapAlert(a: any): JobAlertItem {
  return {
    id: a.id,
    name: a.name || "Job alert",
    keywords: stringList(a.keywords),
    locations: stringList(a.locations),
    jobTypes: stringList(a.jobTypes) as JobAlertItem["jobTypes"],
    minSalary: typeof a.minSalary === "number" ? a.minSalary : null,
    remoteOnly: !!a.remoteOnly,
    frequency: ALERT_FREQUENCIES.includes(a.frequency) ? a.frequency : "DAILY",
    active: a.active !== false,
    lastSentAt: a.lastSentAt ?? null,
    createdAt: a.createdAt || new Date().toISOString(),
  }
}

export function mapSavedSearch(s: any): SavedSearchItem {
  const f = s?.filters && typeof s.filters === "object" ? s.filters : {}
  const filters: SavedSearchFilters = {}
  if (typeof f.location === "string" && f.location) filters.location = f.location
  // API stores the EmploymentType code; the UI filter works with labels.
  if (typeof f.type === "string" && f.type) filters.type = employmentTypeLabel(f.type as JobType)
  if (typeof f.remote === "boolean") filters.remote = f.remote
  if (typeof f.categoryId === "string" && f.categoryId) filters.categoryId = f.categoryId
  if (f.tab === "for-you" || f.tab === "all") filters.tab = f.tab
  return {
    id: s.id,
    name: s.name || "Saved search",
    query: typeof s.query === "string" ? s.query : "",
    filters,
    createdAt: s.createdAt || new Date().toISOString(),
  }
}

export function mapCvSuggestions(raw: any): CvSuggestions {
  const s = raw && typeof raw === "object" ? raw : {}
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
  return {
    title: str(s.title),
    bio: str(s.bio),
    yearsOfExperience:
      typeof s.yearsOfExperience === "number"
        ? String(s.yearsOfExperience)
        : str(s.yearsOfExperience),
    skills: stringList(s.skills),
    languages: stringList(s.languages),
    experiences: Array.isArray(s.experiences)
      ? s.experiences
          .filter((e: any) => e && (e.role || e.company))
          .map((e: any) => ({
            role: String(e.role || ""),
            company: String(e.company || ""),
            duration: String(e.duration || ""),
            ...(str(e.desc) ? { desc: str(e.desc) } : {}),
          }))
      : [],
    educations: Array.isArray(s.educations)
      ? s.educations
          .filter((e: any) => e && (e.school || e.degree))
          .map((e: any) => ({
            school: String(e.school || ""),
            degree: String(e.degree || ""),
            duration: String(e.duration || ""),
          }))
      : [],
  }
}

export function mapScreeningQuestion(q: any): ScreeningQuestion {
  return {
    ...(q?.id ? { id: String(q.id) } : {}),
    question: typeof q?.question === "string" ? q.question : "",
    required: !!q?.required,
  }
}

export function mapNote(n: any): CandidateNote {
  return {
    id: n.id,
    body: typeof n.body === "string" ? n.body : "",
    createdAt: n.createdAt || new Date().toISOString(),
    updatedAt: n.updatedAt || n.createdAt || new Date().toISOString(),
    author: {
      id: n.author?.id || n.authorId || "",
      name: n.author?.name || "Team member",
      avatar: n.author?.avatar || undefined,
    },
    mine: !!n.mine,
  }
}

export function mapTimelineEntry(t: any): TimelineEntry {
  const status = isApplicationStatus(t?.status) ? t.status : APPLICATION_STATUS.APPLIED
  return {
    status,
    label: typeof t?.label === "string" && t.label ? t.label : applicationStatusLabel(status),
    at: t?.at || new Date().toISOString(),
    ...(t?.actor?.name ? { actorName: String(t.actor.name) } : {}),
  }
}

export function mapCompanyProfile(c: any): CompanyProfile {
  const s = (v: unknown) => (typeof v === "string" ? v : "")
  return {
    id: c?.id || "",
    name: s(c?.name),
    logo: s(c?.logo),
    color: s(c?.color),
    website: s(c?.website),
    description: s(c?.description),
    industry: s(c?.industry),
    country: s(c?.country),
    city: s(c?.city),
    verified: c?.verified === true,
    verifiedDomain: typeof c?.verifiedDomain === "string" ? c.verifiedDomain : null,
  }
}

export function mapJobApplication(a: any): JobApplication {
  const job = a.job || {}
  return {
    id: a.id,
    publicJobId: a.jobId,
    company: job.company?.name || "Company",
    title: job.title || a.title || "Position",
    companyColor: job.company?.color || "purple",
    companyVerified: job.company?.verified === true,
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
    tag: a.tag ?? undefined,
  }
}

export function mapEvent(e: any): CalendarEvent {
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
    companyName: e.application?.job?.company?.name ?? undefined,
    jobTitle: e.application?.job?.title ?? undefined,
    organizerName:
      e.user?.role === "RECRUITER" || e.user?.role === "ADMIN" ? e.user.name : undefined,
  }
}

export function mapDocument(d: any): Document {
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

export function mapNotification(n: any): NotificationItem {
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

export function mapMessage(m: any): ChatMessage {
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

export function mapThread(t: any): ConversationThread {
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
export function upsertMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  let idx = list.findIndex((m) => m.id === msg.id)
  if (idx < 0 && msg.clientId) idx = list.findIndex((m) => m.clientId === msg.clientId)
  if (idx < 0) return [...list, msg]
  const next = [...list]
  next[idx] = msg
  // A message that matched by id may still have a temp twin with the same clientId.
  return msg.clientId ? next.filter((m, i) => i === idx || m.clientId !== msg.clientId) : next
}

/** Moves (or inserts) a thread to the top of the inbox with a patch applied. */
export function bumpThread(
  list: ConversationThread[],
  applicationId: string,
  patch: (t: ConversationThread) => ConversationThread,
  fallback?: ConversationThread | null
): ConversationThread[] {
  const existing = list.find((c) => c.applicationId === applicationId) ?? fallback ?? null
  if (!existing) return list
  return [patch(existing), ...list.filter((c) => c.applicationId !== applicationId)]
}

export function newClientId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    // insecure context: fall through
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function isVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

export function mapTeamMember(m: any): TeamMember {
  return {
    id: m.id,
    userId: m.userId || m.user?.id,
    name: m.user?.name || m.name || "",
    email: m.user?.email || m.email || "",
    avatar: m.user?.avatar || undefined,
    role: m.role,
  }
}

/** ISO date (first of month, UTC) → "YYYY-MM"; "" when missing. */
const isoToMonth = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 7) : "")

export function mapSeekerProfile(p: any): SeekerProfileData {
  return {
    title: p.title || "",
    location: p.location || "",
    phone: p.phone || "",
    bio: p.bio || "",
    skills: p.skills || [],
    languages: p.languages || [],
    expectedSalary: p.expectedSalary || "",
    expectedSalaryMin: p.expectedSalaryMin ?? null,
    expectedSalaryMax: p.expectedSalaryMax ?? null,
    expectedSalaryCurrency: p.expectedSalaryCurrency ?? null,
    expectedSalaryPeriod: p.expectedSalaryPeriod ?? null,
    preferredType: p.preferredType || JOB_TYPE_OPTIONS[0],
    availability: p.availability || "",
    yearsOfExperience: p.yearsOfExperience || "",
    preferredLocations: p.preferredLocations || [],
    visibility: p.visibility || "public",
    website: p.website || "",
    github: p.github || "",
    linkedin: p.linkedin || "",
    experiences: (p.experiences || []).map((e: any) => ({
      id: e.id,
      role: e.role || "",
      company: e.company || "",
      duration: e.duration || "",
      startDate: isoToMonth(e.startDate),
      endDate: e.current ? null : isoToMonth(e.endDate) || null,
      current: !!e.current,
      desc: e.desc || "",
    })),
    educations: (p.educations || []).map((e: any) => ({
      id: e.id,
      school: e.school || "",
      degree: e.degree || "",
      duration: e.duration || "",
      startYear: typeof e.startYear === "number" ? e.startYear : null,
      endYear: typeof e.endYear === "number" ? e.endYear : null,
    })),
  }
}

export function mapInterviewInvite(i: any): InterviewInvite {
  return {
    id: i.id,
    applicationId: i.applicationId,
    title: i.title,
    durationMin: i.durationMin,
    location: i.location ?? undefined,
    meetingUrl: i.meetingUrl ?? undefined,
    note: i.note ?? undefined,
    status: i.status,
    eventId: i.eventId ?? undefined,
    createdAt: i.createdAt,
    jobTitle: i.jobTitle ?? "",
    companyName: i.companyName ?? undefined,
    candidateName: i.candidateName ?? "",
    organizerName: i.organizerName ?? undefined,
    slots: (i.slots ?? []).map((s: any) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      booked: !!s.booked,
    })),
  }
}

export function mapOffer(o: any): Offer {
  return {
    id: o.id,
    applicationId: o.applicationId,
    jobTitle: o.jobTitle,
    companyName: o.companyName ?? undefined,
    candidateName: o.candidateName ?? "",
    createdBy: o.createdBy ?? undefined,
    baseSalary: o.baseSalary,
    salaryCurrency: o.salaryCurrency,
    salaryPeriod: o.salaryPeriod,
    bonusAmount: o.bonusAmount ?? undefined,
    equityPercentage: o.equityPercentage ?? undefined,
    startDate: o.startDate,
    expiresAt: o.expiresAt,
    benefits: o.benefits ?? [],
    message: o.message ?? undefined,
    status: o.status,
    signatureName: o.signatureName ?? undefined,
    signedAt: o.signedAt ?? undefined,
    declineReason: o.declineReason ?? undefined,
    createdAt: o.createdAt,
  }
}
