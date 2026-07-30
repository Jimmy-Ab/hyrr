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

export type ApplicationStatusCode = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS]

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatusCode, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  IN_PROCESS: "In Process",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  ARCHIVED: "Archived",
}

export type ApplicationStatusLabel = typeof APPLICATION_STATUS_LABEL[ApplicationStatusCode]

export const APPLICATION_STATUS_COLUMNS = Object.values(APPLICATION_STATUS)

export function applicationStatusLabel(status: ApplicationStatusCode): string {
  return APPLICATION_STATUS_LABEL[status]
}

export const JOB_TYPES = ["All", "Full Time", "Part Time", "Contract", "Remote"] as const
export type JobType = Exclude<typeof JOB_TYPES[number], "All">

export const CALENDAR_EVENT_TYPE = {
  INTERVIEW: "INTERVIEW",
  DEADLINE: "DEADLINE",
  OFFER: "OFFER",
  OTHER: "OTHER",
} as const

export type CalendarEventTypeCode = typeof CALENDAR_EVENT_TYPE[keyof typeof CALENDAR_EVENT_TYPE]
export type CalendarEventType = Lowercase<CalendarEventTypeCode>

export const CALENDAR_EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  interview: "Interview",
  deadline: "Deadline",
  offer: "Offer / Onboarding",
  other: "Other",
}

export const DOCUMENT_TYPES = ["resume", "cover", "cert", "portfolio", "other"] as const
export type DocumentType = typeof DOCUMENT_TYPES[number]
