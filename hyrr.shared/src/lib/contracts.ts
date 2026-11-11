/**
 * Frontend representations of backend enum values. Keep API values in one
 * place and convert them to display labels only at the UI boundary.
 */
export const APPLICATION_STATUS = {
  SAVED: "SAVED",
  SOURCED: "SOURCED",
  APPLIED: "APPLIED",
  IN_PROCESS: "IN_PROCESS",
  INTERVIEWING: "INTERVIEWING",
  OFFER: "OFFER",
  ARCHIVED: "ARCHIVED",
  WITHDRAWN: "WITHDRAWN",
} as const

export type ApplicationStatusCode = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS]

export const APPLICATION_STATUS_LABEL = {
  SAVED: "Saved",
  SOURCED: "Reached out",
  APPLIED: "Applied",
  IN_PROCESS: "In Process",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  ARCHIVED: "Archived",
  WITHDRAWN: "Withdrawn",
} as const

export type ApplicationStatusLabel = (typeof APPLICATION_STATUS_LABEL)[ApplicationStatusCode]

/** Label -> API code (inverse of APPLICATION_STATUS_LABEL). */
export const APPLICATION_STATUS_BY_LABEL = Object.fromEntries(
  Object.entries(APPLICATION_STATUS_LABEL).map(([code, label]) => [label, code])
) as Record<ApplicationStatusLabel, ApplicationStatusCode>

/** Board columns. WITHDRAWN applications are shown in the Archived column with a badge. */
export const APPLICATION_STATUS_COLUMNS: ApplicationStatusCode[] = [
  APPLICATION_STATUS.SAVED,
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.IN_PROCESS,
  APPLICATION_STATUS.INTERVIEWING,
  APPLICATION_STATUS.OFFER,
  APPLICATION_STATUS.ARCHIVED,
]

export function isApplicationStatus(value: unknown): value is ApplicationStatusCode {
  return typeof value === "string" && value in APPLICATION_STATUS_LABEL
}

export function applicationStatusLabel(status: ApplicationStatusCode): ApplicationStatusLabel {
  return APPLICATION_STATUS_LABEL[status] ?? "Applied"
}

export function applicationStatusCode(
  label: ApplicationStatusLabel | string
): ApplicationStatusCode {
  if (isApplicationStatus(label)) return label
  return APPLICATION_STATUS_BY_LABEL[label as ApplicationStatusLabel] ?? APPLICATION_STATUS.APPLIED
}

export const EMPLOYMENT_TYPE = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACT",
  REMOTE: "REMOTE",
} as const
export type EmploymentTypeCode = (typeof EMPLOYMENT_TYPE)[keyof typeof EMPLOYMENT_TYPE]
export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentTypeCode, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACT: "Contract",
  REMOTE: "Remote",
}
export type JobType = (typeof EMPLOYMENT_TYPE_LABEL)[EmploymentTypeCode]
export const JOB_TYPES = ["All", ...Object.values(EMPLOYMENT_TYPE_LABEL)] as const
export const JOB_TYPE_OPTIONS = Object.values(EMPLOYMENT_TYPE_LABEL) as JobType[]
export function employmentTypeLabel(value: EmploymentTypeCode | JobType): JobType {
  return value in EMPLOYMENT_TYPE_LABEL
    ? EMPLOYMENT_TYPE_LABEL[value as EmploymentTypeCode]
    : (value as JobType)
}
export function employmentTypeCode(value: EmploymentTypeCode | JobType): EmploymentTypeCode {
  if (value in EMPLOYMENT_TYPE) return value as EmploymentTypeCode
  return Object.entries(EMPLOYMENT_TYPE_LABEL).find(
    ([, label]) => label === value
  )?.[0] as EmploymentTypeCode
}

export const CALENDAR_EVENT_TYPE = {
  INTERVIEW: "INTERVIEW",
  DEADLINE: "DEADLINE",
  OFFER: "OFFER",
  OTHER: "OTHER",
} as const

export type CalendarEventTypeCode = (typeof CALENDAR_EVENT_TYPE)[keyof typeof CALENDAR_EVENT_TYPE]
export type CalendarEventType = Lowercase<CalendarEventTypeCode>

export const CALENDAR_EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  interview: "Interview",
  deadline: "Deadline",
  offer: "Offer / Onboarding",
  other: "Other",
}

export const DOCUMENT_TYPES = ["resume", "cover", "cert", "portfolio", "other"] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const NOTIFICATION_TYPE = {
  APPLICATION: "APPLICATION",
  INTERVIEW: "INTERVIEW",
  MESSAGE: "MESSAGE",
  OFFER: "OFFER",
  JOB_ALERT: "JOB_ALERT",
  SYSTEM: "SYSTEM",
} as const

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE]

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  APPLICATION: "Application",
  INTERVIEW: "Interview",
  MESSAGE: "Message",
  OFFER: "Offer",
  JOB_ALERT: "Job alert",
  SYSTEM: "System",
}

/** Persisted seeker notification destinations; use these instead of free-form page names. */
export const SEEKER_VIEW = {
  DASHBOARD: "Dashboard",
  DISCOVER: "Discover",
  ALERTS: "Alerts",
  APPLICATIONS: "Applications",
  MESSAGES: "Messages",
  NOTIFICATIONS: "Notifications",
  CALENDAR: "Calendar",
  DOCUMENTS: "Documents",
  MOMENTUM: "Momentum",
  PROFILE: "Profile",
  SETTINGS: "Settings",
} as const

export type SeekerView = (typeof SEEKER_VIEW)[keyof typeof SEEKER_VIEW]

export function isSeekerView(value: unknown): value is SeekerView {
  return Object.values(SEEKER_VIEW).includes(value as SeekerView)
}

/** Backend notification destination codes, mapped to UI views at the boundary. */
export const NOTIFICATION_ACTION = {
  APPLICATIONS: "APPLICATIONS",
  DISCOVER: "DISCOVER",
  MESSAGES: "MESSAGES",
  CALENDAR: "CALENDAR",
} as const

export type NotificationAction = (typeof NOTIFICATION_ACTION)[keyof typeof NOTIFICATION_ACTION]

const NOTIFICATION_ACTION_VIEW: Record<NotificationAction, SeekerView> = {
  APPLICATIONS: SEEKER_VIEW.APPLICATIONS,
  DISCOVER: SEEKER_VIEW.DISCOVER,
  MESSAGES: SEEKER_VIEW.MESSAGES,
  CALENDAR: SEEKER_VIEW.CALENDAR,
}

export function notificationActionView(value: unknown): SeekerView | undefined {
  return typeof value === "string" && value in NOTIFICATION_ACTION_VIEW
    ? NOTIFICATION_ACTION_VIEW[value as NotificationAction]
    : undefined
}

export const PROFILE_VISIBILITY = { PUBLIC: "public", PRIVATE: "private" } as const
export type ProfileVisibility = (typeof PROFILE_VISIBILITY)[keyof typeof PROFILE_VISIBILITY]

export const USER_THEME = { LIGHT: "light", DARK: "dark", SYSTEM: "system" } as const
export type UserTheme = (typeof USER_THEME)[keyof typeof USER_THEME]

// ─── AI candidate analysis ─────────────────────────────────────────────────────

export const AI_STATUS = {
  PENDING: "PENDING",
  DONE: "DONE",
  FAILED: "FAILED",
  DISABLED: "DISABLED",
} as const
export type AiStatus = (typeof AI_STATUS)[keyof typeof AI_STATUS]

export function isAiStatus(value: unknown): value is AiStatus {
  return typeof value === "string" && value in AI_STATUS
}

export const AI_RECOMMENDATION = {
  STRONG_FIT: "STRONG_FIT",
  POSSIBLE_FIT: "POSSIBLE_FIT",
  NOT_A_FIT: "NOT_A_FIT",
} as const
export type AiRecommendation = (typeof AI_RECOMMENDATION)[keyof typeof AI_RECOMMENDATION]

export const AI_RECOMMENDATION_LABEL: Record<AiRecommendation, string> = {
  STRONG_FIT: "Strong fit",
  POSSIBLE_FIT: "Possible fit",
  NOT_A_FIT: "Not a fit",
}

export interface AiAnalysis {
  recommendation: AiRecommendation
  summary: string
  matchedSkills: string[]
  missingSkills: string[]
  strengths: string[]
  concerns: string[]
  experienceFit: string
  cvUsed: boolean
  cvNote?: string
}

// ─── Messaging ─────────────────────────────────────────────────────────────────

export type ConversationClosedReason = "WITHDRAWN" | "SAVED"
export type MessageSenderType = "SEEKER" | "RECRUITER" | "ADMIN" | "SYSTEM"
export type MessageDeliveryStatus = "sending" | "sent" | "failed"

/**
 * Real-time events shared by the three apps (socket.io). The backend emits these names;
 * hyrr.shared/src/store/socket.ts and hyrr.admin/src/lib/live.ts listen.
 */
export const SYNC_SOCKET_EVENTS = {
  // Candidate lifecycle
  CANDIDATE_APPLIED: "candidate_applied",
  APPLICATION_STATUS_UPDATED: "application_status_updated",
  CANDIDATE_AI_SCORED: "candidate_ai_scored",
  CANDIDATE_AI_STATUS: "candidate_ai_status",
  SCORECARD_SUBMITTED: "scorecard_submitted",
  // Offer lifecycle
  OFFER_EXTENDED: "offer_extended",
  OFFER_UPDATED: "offer_updated",
  OFFER_ACCEPTED: "offer_accepted",
  OFFER_DECLINED: "offer_declined",
  // Talent search
  OUTREACH_RECEIVED: "outreach_received",
  // Scheduling
  INTERVIEW_INVITE_RECEIVED: "interview_invite_received",
  INTERVIEW_INVITE_UPDATED: "interview_invite_updated",
  CALENDAR_EVENT_CONFIRMED: "calendar_event_confirmed",
  // Governance & economy
  WALLET_UPDATED: "wallet_updated",
  /** Admin changed prices, packs or plans: refetch the billing catalog. */
  PRICING_UPDATED: "pricing_updated",
  JOB_MODERATED: "job_moderated",
  JOB_REMOVED: "job_removed",
  COMPANY_STATUS: "company_status",
  COMPANY_VERIFIED: "company_verified",
  ACCOUNT_SUSPENDED: "account_suspended",
  // Admin live counters (admins with 2FA only)
  ADMIN_METRIC: "admin_metric",
} as const

export type SyncSocketEvent = (typeof SYNC_SOCKET_EVENTS)[keyof typeof SYNC_SOCKET_EVENTS]
