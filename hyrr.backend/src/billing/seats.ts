import { HttpStatus } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { AppException } from "../core/exceptions/app-exception"

type SeatDb = Pick<PrismaClient, "user" | "company" | "subscription" | "plan"> &
  Partial<Pick<PrismaClient, "companyInvite">>

/** Company.plan holds the plan *name* ("Starter" / "Pro" / "Enterprise"); map it to Plan.code. */
export function planCodeFromName(name?: string | null): string {
  const n = (name || "").trim().toUpperCase()
  if (n === "PRO" || n === "ENTERPRISE" || n === "STARTER") return n
  if (n.startsWith("ENTERPRISE")) return "ENTERPRISE"
  if (n.startsWith("PRO")) return "PRO"
  return "STARTER"
}

const DEFAULT_SEATS: Record<string, number | null> = { STARTER: 3, PRO: 10, ENTERPRISE: null }

/** The company's effective plan code: an active Subscription wins, else Company.plan. */
export async function effectivePlanCode(db: SeatDb, companyId: string): Promise<string> {
  const [subscription, company] = await Promise.all([
    db.subscription.findUnique({ where: { companyId } }),
    db.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
  ])
  if (subscription && subscription.status !== "CANCELED") return subscription.plan || "STARTER"
  return planCodeFromName(company?.plan)
}

/** Open (not accepted/declined/revoked, not expired) invites hold a seat until they are answered. */
export const openInviteWhere = (companyId: string, now = new Date()) => ({
  companyId,
  acceptedAt: null,
  declinedAt: null,
  revokedAt: null,
  expiresAt: { gt: now },
})

/**
 * Seats = distinct users attached to the company (member rows or the legacy User.companyId)
 * plus open invites.
 */
export async function seatUsage(
  db: SeatDb,
  companyId: string
): Promise<{ used: number; limit: number | null; planCode: string }> {
  const planCode = await effectivePlanCode(db, companyId)
  const [members, invites, plan] = await Promise.all([
    db.user.count({
      where: { OR: [{ companyId }, { companyMemberships: { some: { companyId } } }] },
    }),
    db.companyInvite ? db.companyInvite.count({ where: openInviteWhere(companyId) }) : 0,
    db.plan.findUnique({ where: { code: planCode }, select: { seatLimit: true } }),
  ])
  const limit = plan ? plan.seatLimit : (DEFAULT_SEATS[planCode] ?? null)
  return { used: (members ?? 0) + (invites ?? 0), limit, planCode }
}

/** Throws 402 SEAT_LIMIT_REACHED when adding one more member would exceed the plan's seats. */
export async function assertSeatAvailable(db: SeatDb, companyId: string): Promise<void> {
  const { used, limit, planCode } = await seatUsage(db, companyId)
  if (limit !== null && limit !== undefined && used >= limit)
    throw new AppException(
      `Your ${planCode.charAt(0) + planCode.slice(1).toLowerCase()} plan includes ${limit} seats. Upgrade to add more teammates.`,
      HttpStatus.PAYMENT_REQUIRED,
      "SEAT_LIMIT_REACHED",
      { used, limit, plan: planCode }
    )
}
