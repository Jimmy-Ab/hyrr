import { EmploymentType } from "@prisma/client"
import { toEmploymentType } from "../matching/scoring"

export type AlertCriteria = {
  keywords: string[]
  locations: string[]
  jobTypes: string[]
  remoteOnly: boolean
}

export type AlertJob = {
  title: string
  description?: string | null
  skills?: string[] | null
  requirements?: string[] | null
  location?: string | null
  remote?: boolean | null
  type: EmploymentType
}

const clean = (values: string[] | null | undefined) =>
  (values || []).map((v) => v.trim().toLowerCase()).filter(Boolean)

/**
 * Pure alert rule: every non-empty criterion must match.
 * - keywords: any keyword in title / description / skills / requirements (case-insensitive)
 * - locations: any location is a substring of the job location, or "remote" for remote jobs
 * - jobTypes: EmploymentType values (legacy labels such as "Full Time" are accepted too)
 * - remoteOnly: the job must be remote
 */
export function jobMatchesAlert(job: AlertJob, alert: AlertCriteria): boolean {
  if (alert.remoteOnly && !job.remote) return false

  const types = (alert.jobTypes || [])
    .map((t) => toEmploymentType(t) ?? (t.trim().toUpperCase() as EmploymentType))
    .filter(Boolean)
  if (types.length && !types.includes(job.type)) return false

  const keywords = clean(alert.keywords)
  if (keywords.length) {
    const text = [
      job.title,
      job.description || "",
      ...(job.skills || []),
      ...(job.requirements || []),
    ]
      .join(" \n ")
      .toLowerCase()
    if (!keywords.some((k) => text.includes(k))) return false
  }

  const locations = clean(alert.locations)
  if (locations.length) {
    const jobLocation = (job.location || "").toLowerCase()
    const ok = locations.some(
      (l) => (l === "remote" && !!job.remote) || (!!jobLocation && jobLocation.includes(l))
    )
    if (!ok) return false
  }
  return true
}
