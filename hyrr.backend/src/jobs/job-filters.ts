import { EmploymentType, Prisma, SalaryPeriod } from "@prisma/client"
import type { JobFilters } from "./dtos/job-filters.dto"

const DAY = 86_400_000
/** Web salaries are annual; filter amounts are converted before comparing. */
const PER_YEAR: Record<SalaryPeriod, number> = { YEAR: 1, MONTH: 12, HOUR: 2080 }

const since = (days: number) => new Date(Date.now() - days * DAY)

/** Hyrr jobs: every active filter must hold (AND). */
export function hyrrJobFilterWhere(f: JobFilters): Prisma.JobWhereInput[] {
  const and: Prisma.JobWhereInput[] = []
  if (f.categoryId) and.push({ categoryId: f.categoryId })
  if (f.remote) and.push({ OR: [{ remote: true }, { type: EmploymentType.REMOTE }] })
  if (f.type) and.push({ type: f.type })
  if (f.postedWithin) {
    const from = since(f.postedWithin)
    and.push({
      OR: [{ publishedAt: { gte: from } }, { publishedAt: null, createdAt: { gte: from } }],
    })
  }
  if (f.salary) {
    const { min, max, currency, period } = f.salary
    // Range overlap in the same currency and period; jobs without a salary don't match.
    and.push({ salaryCurrency: currency, salaryPeriod: period })
    if (min != null)
      and.push({
        OR: [{ salaryMax: { gte: min } }, { salaryMax: null, salaryMin: { gte: min } }],
      })
    if (max != null) and.push({ salaryMin: { lte: max } })
    if (min == null && max == null) and.push({ salaryMin: { not: null } })
  }
  return and
}

/** Provider employment-type text ("full_time", "Full-time", "contractor"…) per enum code. */
const WEB_TYPE_WORDS: Record<EmploymentType, string[]> = {
  FULL_TIME: ["full", "permanent"],
  PART_TIME: ["part"],
  CONTRACT: ["contract", "freelance", "temporary"],
  REMOTE: [],
}

/** Jobs from the web: categories and types are provider text, matched by keyword. */
export function webJobFilterWhere(
  f: JobFilters,
  categoryName?: string | null
): Prisma.ExternalJobWhereInput[] {
  const and: Prisma.ExternalJobWhereInput[] = []
  if (f.categoryId) {
    // Unknown category id: nothing matches rather than silently ignoring the filter.
    and.push(
      categoryName
        ? { category: { contains: categoryName, mode: "insensitive" } }
        : { id: { in: [] } }
    )
  }
  if (f.remote || f.type === EmploymentType.REMOTE) and.push({ remote: true })
  if (f.type && f.type !== EmploymentType.REMOTE) {
    and.push({
      OR: WEB_TYPE_WORDS[f.type].map((w) => ({
        employmentType: { contains: w, mode: "insensitive" as const },
      })),
    })
  }
  if (f.postedWithin) and.push({ postedAt: { gte: since(f.postedWithin) } })
  if (f.salary) {
    const k = PER_YEAR[f.salary.period]
    const min = f.salary.min != null ? f.salary.min * k : undefined
    const max = f.salary.max != null ? f.salary.max * k : undefined
    and.push({ salaryCurrency: f.salary.currency })
    if (min != null)
      and.push({
        OR: [{ salaryMax: { gte: min } }, { salaryMax: null, salaryMin: { gte: min } }],
      })
    if (max != null) and.push({ salaryMin: { lte: max } })
    if (min == null && max == null) and.push({ salaryMin: { not: null } })
  }
  return and
}
