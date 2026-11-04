import { isApiError, type Candidate, type Job } from "hyrr.shared"
import { useJobStore } from "../store/useJobStore"

// ─── Views <-> URL paths ──────────────────────────────────────────────────────

export const RECRUITER_VIEWS = [
  "Dashboard",
  "Jobs",
  "Applications",
  "Candidates",
  "Calendar",
  "Messages",
  "Analytics",
  "Settings",
] as const

export type RecruiterView = (typeof RECRUITER_VIEWS)[number]

export function isRecruiterView(value: unknown): value is RecruiterView {
  return typeof value === "string" && (RECRUITER_VIEWS as readonly string[]).includes(value)
}

export function viewToPath(view: string): string {
  return isRecruiterView(view) ? `/${view.toLowerCase()}` : "/dashboard"
}

export function pathToView(pathname: string): RecruiterView | null {
  const segment = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")[0]
    ?.toLowerCase()
  return RECRUITER_VIEWS.find((v) => v.toLowerCase() === segment) ?? null
}

// ─── Pipeline statuses (display labels) ───────────────────────────────────────

/** Ordered kanban columns. WITHDRAWN cards are rendered in the Archived column. */
export const PIPELINE_STATUSES = [
  "Applied",
  "In Process",
  "Interviewing",
  "Offer",
  "Archived",
] as const
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number]

export const WITHDRAWN_STATUS = "Withdrawn"

export function isWithdrawn(candidate: Pick<Candidate, "status">): boolean {
  return candidate.status === WITHDRAWN_STATUS
}

/** Column a candidate is displayed in. */
export function columnForStatus(status: Candidate["status"]): string {
  return status === WITHDRAWN_STATUS ? "Archived" : status
}

export type BadgeVariant = "primary" | "info" | "warning" | "success" | "destructive" | "secondary"

export function statusBadgeVariant(status: Candidate["status"]): BadgeVariant {
  switch (status) {
    case "Applied":
      return "info"
    case "In Process":
      return "warning"
    case "Interviewing":
      return "primary"
    case "Offer":
      return "success"
    case "Archived":
    case WITHDRAWN_STATUS:
      return "destructive"
    default:
      return "secondary"
  }
}

// ─── Jobs: moderation, verification, publish errors ───────────────────────────

/** FLAGGED jobs (enough user reports) are hidden from candidates until an admin reviews them. */
export function isFlaggedJob(job: Pick<Job, "status"> | null | undefined): boolean {
  return job?.status === "Flagged"
}

export const FLAGGED_JOB_TOOLTIP =
  "Several reports about this job are being reviewed. It is hidden from candidates until the review is done."

/** The recruiter's company is verified when the API marks its jobs' company as verified. */
export function useCompanyVerified(): boolean {
  return useJobStore((s) => s.jobs.some((j) => j.companyVerified))
}

export type JobPublishError =
  { kind: "content"; message: string; details: string[] } | { kind: "unverified"; message: string }

/** Maps the job-specific API errors to an inline dialog state (null → generic toast). */
export function jobPublishError(err: unknown): JobPublishError | null {
  if (!isApiError(err)) return null
  if (err.errorCode === "JOB_CONTENT_REJECTED") {
    const details = Array.isArray(err.details)
      ? err.details.filter((d): d is string => typeof d === "string" && !!d)
      : []
    return { kind: "content", message: err.message, details }
  }
  if (err.errorCode === "EMAIL_NOT_VERIFIED") return { kind: "unverified", message: err.message }
  return null
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string" && err) return err
  return fallback
}

export function avatarFallback(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=6C63FF&color=fff`
}

// ─── Labels, sources, relative time ───────────────────────────────────────────

/** Fixed label palette (saved as the label's colour; reads well on light and dark surfaces). */
export const LABEL_COLORS = [
  { value: "#7c5cfc", name: "Violet" },
  { value: "#3b82f6", name: "Blue" },
  { value: "#06b6d4", name: "Cyan" },
  { value: "#10b981", name: "Green" },
  { value: "#84cc16", name: "Lime" },
  { value: "#f59e0b", name: "Amber" },
  { value: "#f97316", name: "Orange" },
  { value: "#ef4444", name: "Red" },
  { value: "#ec4899", name: "Pink" },
  { value: "#6b7485", name: "Gray" },
] as const

export const DEFAULT_LABEL_COLOR = LABEL_COLORS[0].value

export const APPLICATION_SOURCE_LABEL: Record<string, string> = {
  DIRECT: "Applied directly",
  GUEST: "Guest",
  RECRUITER_ADDED: "Added by team",
}

export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null
  return APPLICATION_SOURCE_LABEL[source] ?? null
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

/** "3 hours ago", "just now". */
export function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const date = typeof iso === "string" ? new Date(iso) : iso
  const diff = (date.getTime() - Date.now()) / 1000
  if (Number.isNaN(diff)) return ""
  if (Math.abs(diff) < 45) return "just now"
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit)
  }
  return rtf.format(Math.round(diff / 60), "minute")
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}
