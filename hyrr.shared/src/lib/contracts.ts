/**
 * Frontend representations of backend enum values. Keep API values in one
 * place and convert them to display labels only at the UI boundary.
 */
export const APPLICATION_STATUS = {
  SAVED: "SAVED",
  APPLIED: "APPLIED",
  IN_PROCESS: "IN_PROCESS",
  INTERVIEWING: "INTERVIEWING",
  OFFER: "OFFER",
  ARCHIVED: "ARCHIVED",
} as const

export type ApplicationStatusCode = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS]

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatusCode, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  IN_PROCESS: "In Process",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  ARCHIVED: "Archived",
}

export type ApplicationStatusLabel = (typeof APPLICATION_STATUS_LABEL)[ApplicationStatusCode]

export const APPLICATION_STATUS_COLUMNS = Object.values(APPLICATION_STATUS)

export function applicationStatusLabel(status: ApplicationStatusCode): string {
  return APPLICATION_STATUS_LABEL[status]
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
  APPLICATIONS: "Applications",
  MESSAGES: "Messages",
  NOTIFICATIONS: "Notifications",
  CALENDAR: "Calendar",
  DOCUMENTS: "Documents",
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
