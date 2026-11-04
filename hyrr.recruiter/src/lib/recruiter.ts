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
