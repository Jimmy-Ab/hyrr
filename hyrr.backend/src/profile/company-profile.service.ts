import { Injectable } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { CacheService } from "../cache/cache.service"
import { requireCompanyWriter, resolveCompanyMembership } from "../core/access/company-membership"
import { CompanyVerificationService } from "../core/verification/company-verification.service"
import { PrismaService } from "../prisma/prisma.service"
import { UpdateCompanyProfileDto } from "./dtos/company-profile.dto"

export const COMPANY_PROFILE_SELECT = {
  id: true,
  name: true,
  logo: true,
  color: true,
  website: true,
  description: true,
  industry: true,
  country: true,
  city: true,
  verified: true,
  verifiedDomain: true,
} satisfies Prisma.CompanySelect

type CompanyActor = { userId: string; role: string; companyId?: string | null }

const sameWebsite = (a: string | null | undefined, b: string | null | undefined) =>
  (a || "").trim().replace(/\/+$/, "").toLowerCase() ===
  (b || "").trim().replace(/\/+$/, "").toLowerCase()

/** Recruiter-facing company profile (GET: any member; PUT: OWNER / RECRUITER members). */
@Injectable()
export class CompanyProfileService {
  constructor(
    private prisma: PrismaService,
    private verification: CompanyVerificationService,
    private cache: CacheService
  ) {}

  async get(actor: CompanyActor) {
    const { companyId } = await resolveCompanyMembership(this.prisma, actor)
    return this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: COMPANY_PROFILE_SELECT,
    })
  }

  async update(actor: CompanyActor, dto: UpdateCompanyProfileDto) {
    const { companyId } = await requireCompanyWriter(this.prisma, actor)
    const current = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { website: true },
    })

    const data: Prisma.CompanyUpdateInput = {}
    for (const key of ["name", "logo", "color", "country"] as const) {
      if (dto[key] !== undefined && dto[key] !== null) data[key] = dto[key]
    }
    for (const key of ["website", "description", "industry", "city"] as const) {
      if (dto[key] !== undefined) data[key] = dto[key] || null
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data,
      select: COMPANY_PROFILE_SELECT,
    })
    // Public job listings embed company fields.
    await this.cache.delByPattern("jobs:public*")
    if (dto.website !== undefined && !sameWebsite(current.website, updated.website)) {
      await this.verification.refreshForCompany(companyId)
      return this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: COMPANY_PROFILE_SELECT,
      })
    }
    return updated
  }
}
