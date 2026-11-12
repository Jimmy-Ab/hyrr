import type { SalaryRangeValue } from "./validation"

/** Discover filters (Hyrr jobs and jobs from the web). Undefined = not filtered. */
export interface JobFilterInput {
  categoryId?: string
  remote?: boolean
  /** EmploymentType code (FULL_TIME, PART_TIME, CONTRACT, REMOTE). */
  type?: string
  /** min and/or max with currency + period; empty bounds = no salary filter. */
  salary?: SalaryRangeValue | null
  /** Days: 1, 3, 7, 14 or 30. */
  postedWithin?: number
  /** Only Hyrr jobs in a language from the seeker's profile (web jobs have no language data). */
  matchLanguages?: boolean
}

export const POSTED_WITHIN_OPTIONS = [
  { value: 1, label: "Last 24 hours" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last week" },
  { value: 14, label: "Last 2 weeks" },
  { value: 30, label: "Last month" },
] as const

/** Query-string entries for GET /matching/jobs and GET /external-jobs. */
export function jobFilterParams(f: JobFilterInput | undefined): Record<string, string> {
  if (!f) return {}
  const out: Record<string, string> = {}
  if (f.categoryId) out.categoryId = f.categoryId
  if (f.remote) out.remote = "true"
  if (f.type) out.type = f.type
  if (f.postedWithin) out.postedWithin = String(f.postedWithin)
  if (f.matchLanguages) out.matchLanguages = "true"
  const s = f.salary
  if (s && (s.min != null || s.max != null)) {
    if (s.min != null) out.salaryMin = String(s.min)
    if (s.max != null) out.salaryMax = String(s.max)
    out.salaryCurrency = s.currency
    out.salaryPeriod = s.period
  }
  return out
}

/** Stable text of the active filters (refetch when it changes). */
export const jobFiltersKey = (f: JobFilterInput | undefined) => JSON.stringify(jobFilterParams(f))
