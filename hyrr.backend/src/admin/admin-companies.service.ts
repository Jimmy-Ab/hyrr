import { Injectable, Logger, Optional } from "@nestjs/common"
import { CompanyStatus, JobStatus, Prisma } from "@prisma/client"
import { WalletService } from "../billing/wallet.service"
import { CacheService } from "../cache/cache.service"
import { NotFoundAppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { SearchService } from "../search/search.service"
import type { AdminCtx } from "./admin-moderation.service"
import { AuditService } from "./audit.service"
import { pageArgs, pageOf } from "./pagination"

const COMPANY_LIST_SELECT = {
  id: true,
  name: true,
  logo: true,
  verified: true,
  status: true,
  joinedAt: true,
  plan: true,
  wallet: { select: { balance: true } },
  subscription: { select: { plan: true } },
  _count: { select: { teamMembers: true, jobs: true } },
} satisfies Prisma.CompanySelect

type CompanyRow = Prisma.CompanyGetPayload<{ select: typeof COMPANY_LIST_SELECT }>

export type CompanyFilters = { q?: string; status?: CompanyStatus }

/** Admin company management: verify badge, suspension, credit adjustments. */
@Injectable()
export class AdminCompaniesService {
  private readonly logger = new Logger(AdminCompaniesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    @Optional() private readonly search?: SearchService
  ) {}

  private async toItems(rows: CompanyRow[]) {
    const ids = rows.map((r) => r.id)
    const live = ids.length
      ? await this.prisma.job.groupBy({
          by: ["companyId"],
          where: { companyId: { in: ids }, status: JobStatus.ACTIVE },
          _count: { _all: true },
        })
      : []
    const liveBy = new Map(live.map((g) => [g.companyId, g._count._all]))
    return rows.map(({ wallet, subscription, _count, plan, ...c }) => ({
      ...c,
      members: _count.teamMembers,
      jobs: _count.jobs,
      liveJobs: liveBy.get(c.id) ?? 0,
      balance: wallet?.balance ?? 0,
      plan: subscription?.plan ?? plan,
    }))
  }

  async list(filters: CompanyFilters, cursor?: string, limit?: number) {
    const where: Prisma.CompanyWhereInput = {}
    if (filters.status) where.status = filters.status
    if (filters.q) where.name = { contains: filters.q, mode: "insensitive" }
    const rows = await this.prisma.company.findMany({
      where,
      select: COMPANY_LIST_SELECT,
      orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
      ...pageArgs(cursor, limit),
    })
    const page = pageOf(rows, limit)
    return { items: await this.toItems(page.items), nextCursor: page.nextCursor }
  }

  async detail(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { ...COMPANY_LIST_SELECT, website: true, verifiedDomain: true },
    })
    if (!company) throw new NotFoundAppException("Company not found", "COMPANY_NOT_FOUND")
    const userSelect = { id: true, name: true, email: true, status: true } as const
    const [[item], memberRows, legacyMembers, jobs, transactions, payments, subscription, audit] =
      await Promise.all([
        this.toItems([company]),
        this.prisma.companyMember.findMany({
          where: { companyId: id },
          select: { role: true, user: { select: userSelect } },
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.user.findMany({ where: { companyId: id }, select: userSelect }),
        this.prisma.job.findMany({
          where: { companyId: id },
          select: {
            id: true,
            title: true,
            status: true,
            _count: { select: { applications: { where: { status: { not: "SAVED" } } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        this.prisma.creditTransaction.findMany({
          where: { companyId: id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 10,
        }),
        this.prisma.payment.findMany({
          where: { companyId: id },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        this.prisma.subscription.findUnique({ where: { companyId: id } }),
        this.audit.forTarget(`company:${id}`, 10),
      ])
    const members = memberRows.map((m) => ({ ...m.user, role: m.role as string }))
    // Accounts linked only through the legacy User.companyId count as owners.
    for (const u of legacyMembers)
      if (!members.some((m) => m.id === u.id)) members.push({ ...u, role: "OWNER" })
    return {
      ...item,
      website: company.website,
      verifiedDomain: company.verifiedDomain,
      members,
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        applicants: j._count.applications,
      })),
      wallet: { balance: item.balance, recent: transactions },
      payments,
      subscription,
      audit,
    }
  }

  private async load(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, verified: true },
    })
    if (!company) throw new NotFoundAppException("Company not found", "COMPANY_NOT_FOUND")
    return company
  }

  /** Verified badge on; a PENDING company becomes VERIFIED. */
  async verify(id: string, ctx: AdminCtx) {
    const company = await this.load(id)
    const status =
      company.status === CompanyStatus.PENDING ? CompanyStatus.VERIFIED : company.status
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: { verified: true, verifiedAt: new Date(), status },
      })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "company.verify",
          target: `company:${id}`,
          details: `Verified ${company.name}`,
          meta: {
            before: { verified: company.verified, status: company.status },
            after: { verified: true, status },
          },
          ip: ctx.ip,
          severity: "info",
        },
        tx
      )
    })
    await this.refreshPublicJobs(id)
    return { id, verified: true, status }
  }

  /** Verified badge off; a VERIFIED company goes back to PENDING. */
  async unverify(id: string, reason: string, ctx: AdminCtx) {
    const company = await this.load(id)
    const status =
      company.status === CompanyStatus.VERIFIED ? CompanyStatus.PENDING : company.status
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: { verified: false, verifiedAt: null, status },
      })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "company.unverify",
          target: `company:${id}`,
          details: `Removed the verified badge from ${company.name}`,
          reason,
          meta: {
            before: { verified: company.verified, status: company.status },
            after: { verified: false, status },
          },
          ip: ctx.ip,
          severity: "warning",
        },
        tx
      )
    })
    await this.refreshPublicJobs(id)
    return { id, verified: false, status }
  }

  /** SUSPENDED: jobs leave public search/detail, members lose manage rights, publishing is blocked. */
  async suspend(id: string, reason: string, ctx: AdminCtx) {
    const company = await this.load(id)
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id }, data: { status: CompanyStatus.SUSPENDED } })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "company.suspend",
          target: `company:${id}`,
          details: `Suspended ${company.name}`,
          reason,
          meta: {
            before: { status: company.status },
            after: { status: CompanyStatus.SUSPENDED },
          },
          ip: ctx.ip,
          severity: "critical",
        },
        tx
      )
    })
    await this.refreshPublicJobs(id)
    return { id, status: CompanyStatus.SUSPENDED }
  }

  /** Back to VERIFIED (badge on) or PENDING. */
  async reactivate(id: string, ctx: AdminCtx) {
    const company = await this.load(id)
    const status = company.verified ? CompanyStatus.VERIFIED : CompanyStatus.PENDING
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id }, data: { status } })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "company.reactivate",
          target: `company:${id}`,
          details: `Reactivated ${company.name}`,
          meta: { before: { status: company.status }, after: { status } },
          ip: ctx.ip,
          severity: "info",
        },
        tx
      )
    })
    await this.refreshPublicJobs(id)
    return { id, status }
  }

  /** ADJUSTMENT credit (amount > 0) or debit (amount < 0; 402 INSUFFICIENT_CREDITS beyond the balance). */
  async adjustCredits(id: string, amount: number, reason: string, ctx: AdminCtx) {
    const company = await this.load(id)
    const balance = await this.prisma.$transaction(async (tx) => {
      const entry = {
        companyId: id,
        amount: Math.abs(amount),
        type: "ADJUSTMENT" as const,
        actorId: ctx.actorId,
        note: reason,
      }
      const result =
        amount > 0 ? await this.wallet.credit(entry, tx) : await this.wallet.debit(entry, tx)
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "company.credits",
          target: `company:${id}`,
          details: `${amount > 0 ? "Added" : "Removed"} ${Math.abs(amount)} credits ${amount > 0 ? "to" : "from"} ${company.name}`,
          reason,
          meta: {
            amount,
            balanceAfter: result.balanceAfter,
            transactionId: result.transactionId,
          },
          ip: ctx.ip,
          severity: "warning",
        },
        tx
      )
      return result.balanceAfter
    })
    return { balance }
  }

  /** Public listings are cached; the company's jobs are re-synced with the search index. */
  private async refreshPublicJobs(companyId: string) {
    try {
      await this.cache.delByPattern("jobs:public*")
      await this.cache.delByPattern("ai:featured-jobs:*")
      if (this.search?.isEnabled()) {
        const jobs = await this.prisma.job.findMany({
          where: { companyId, status: JobStatus.ACTIVE },
          select: { id: true },
          take: 1000,
        })
        for (const job of jobs) this.search.indexJobSoon(job.id)
      }
    } catch (err: any) {
      this.logger.warn(`Public job refresh failed for company ${companyId}: ${err?.message}`)
    }
  }
}
