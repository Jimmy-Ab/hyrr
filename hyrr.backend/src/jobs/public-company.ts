import { Prisma } from "@prisma/client"

/**
 * Company fields that candidates and anonymous visitors may see. Internal columns
 * (plan, status, verifiedDomain, billing data …) stay out of seeker/public payloads.
 */
export const PUBLIC_COMPANY_SELECT = {
  id: true,
  name: true,
  logo: true,
  color: true,
  country: true,
  city: true,
  website: true,
  description: true,
  industry: true,
  verified: true,
} satisfies Prisma.CompanySelect
