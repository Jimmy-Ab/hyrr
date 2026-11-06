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
