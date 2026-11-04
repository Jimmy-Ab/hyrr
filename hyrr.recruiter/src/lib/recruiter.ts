import type { Candidate } from "hyrr.shared"

// ─── Views <-> URL paths ──────────────────────────────────────────────────────

export const RECRUITER_VIEWS = [
  "Dashboard",
  "Jobs",
  "Applications",
  "Candidates",
  "Calendar",
  "Messages",
  "Analytics",
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

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string" && err) return err
  return fallback
}

export function avatarFallback(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=6C63FF&color=fff`
}
