import { ForbiddenException } from "@nestjs/common"
import { CompanyMemberRole, CompanyStatus, PrismaClient } from "@prisma/client"
import { AppException } from "../exceptions/app-exception"

type MembershipActor = { userId: string; role: string; companyId?: string | null }
type MembershipDb = Pick<PrismaClient, "companyMember"> & Partial<Pick<PrismaClient, "company">>

export const COMPANY_WRITE_ROLES: CompanyMemberRole[] = [
  CompanyMemberRole.OWNER,
  CompanyMemberRole.RECRUITER,
]

/**
 * Resolves the caller's company and member role.
 * Legacy companies that have no member rows at all treat their (only) recruiter as OWNER.
 */
export async function resolveCompanyMembership(
  prisma: MembershipDb,
  actor: MembershipActor
): Promise<{ companyId: string; role: CompanyMemberRole }> {
  if (actor.role !== "RECRUITER" || !actor.companyId)
    throw new ForbiddenException("A recruiter company is required")
  const companyId = actor.companyId
  const member = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId: actor.userId } },
  })
  if (member) return { companyId, role: member.role }
  const members = await prisma.companyMember.count({ where: { companyId } })
  return { companyId, role: members === 0 ? CompanyMemberRole.OWNER : CompanyMemberRole.RECRUITER }
}

/** Like resolveCompanyMembership, but requires a RECRUITER/OWNER member role (write access). */
export async function requireCompanyWriter(prisma: MembershipDb, actor: MembershipActor) {
  const membership = await resolveCompanyMembership(prisma, actor)
  if (!COMPANY_WRITE_ROLES.includes(membership.role))
    throw new ForbiddenException("Your team role does not allow changes")
  // A company suspended by an admin keeps read access but can't change anything.
  const company = await prisma.company?.findUnique({
    where: { id: membership.companyId },
    select: { status: true },
  })
  if (company?.status === CompanyStatus.SUSPENDED)
    throw new AppException(
      "Your company is suspended. Contact support to restore access.",
      403,
      "COMPANY_SUSPENDED"
    )
  return membership
}
