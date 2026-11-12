import { CompanyStatus, JobStatus, Prisma } from "@prisma/client"

/**
 * A job is publicly visible (search, detail, apply, search index) when it is ACTIVE and its
 * company is not suspended by an admin. Kept in its own file so search/applications can use it
 * without importing JobsService.
 */
export const PUBLIC_JOB_WHERE = {
  status: JobStatus.ACTIVE,
  company: { status: { not: CompanyStatus.SUSPENDED } },
} satisfies Prisma.JobWhereInput

/**
 * Job columns that never leave the server for seekers or anonymous visitors: moderation
 * (risk score/reasons, removal), billing (credits charged) and recruiter-internal data.
 * Recruiter endpoints keep the full row.
 */
export const PUBLIC_JOB_OMIT = {
  recruiterId: true,
  riskScore: true,
  riskReasons: true,
  momentumCost: true,
  removedAt: true,
  removedReason: true,
  scorecardCompetencies: true,
} as const satisfies Prisma.JobOmit

type InternalKey = keyof typeof PUBLIC_JOB_OMIT

/** The job as seekers and the public may see it (also strips rows read from caches). */
export function toPublicJob<T extends object>(job: T): Omit<T, InternalKey> {
  if (!job) return job
  const out = { ...job } as Record<string, unknown>
  for (const key of Object.keys(PUBLIC_JOB_OMIT)) delete out[key]
  return out as Omit<T, InternalKey>
}
