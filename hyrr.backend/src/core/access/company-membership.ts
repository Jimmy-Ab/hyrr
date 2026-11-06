import { ForbiddenException } from "@nestjs/common"
import { CompanyMemberRole, PrismaClient } from "@prisma/client"

type MembershipActor = { userId: string; role: string; companyId?: string | null }
type MembershipDb = Pick<PrismaClient, "companyMember">

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
  return membership
}
