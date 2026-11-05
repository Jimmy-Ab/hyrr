import { HttpStatus, Injectable } from "@nestjs/common"
import { CreditTransactionType, Prisma } from "@prisma/client"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"

/** Exactly one owner: a company (recruiter team) or a user (seeker). */
export type WalletOwner =
  { companyId: string; userId?: null } | { userId: string; companyId?: null }

export type WalletEntry = WalletOwner & {
  amount: number
  type: CreditTransactionType | keyof typeof CreditTransactionType
  referenceId?: string | null
  actorId?: string | null
  note?: string | null
}

export type WalletResult = { balanceAfter: number; transactionId: string | null }

type Db = Prisma.TransactionClient

/** Unique where-clause for the owner's wallet (companyId and userId are both unique). */
export function ownerWhere(owner: WalletOwner): { companyId: string } | { userId: string } {
  if (owner.companyId) return { companyId: owner.companyId }
  if (owner.userId) return { userId: owner.userId }
  throw new AppException("Wallet owner missing", 500, "WALLET_OWNER_MISSING")
}

/**
 * Momentum credit wallet. Every balance change is a conditional atomic update plus an append-only
 * ledger row carrying the balance right after it. Debits use
 * `UPDATE ... SET balance = balance - n WHERE companyId = ? AND balance >= n`, so concurrent debits
 * can never overspend and the balance can never go negative.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private run<T>(tx: Db | undefined, fn: (db: Db) => Promise<T>): Promise<T> {
    if (tx) return fn(tx)
    return this.prisma.$transaction((db) => fn(db))
  }

  async ensureWallet(companyId: string, tx?: Db) {
    return this.ensureOwnerWallet({ companyId }, tx)
  }

  async ensureOwnerWallet(owner: WalletOwner, tx?: Db) {
    const db: Db = tx ?? (this.prisma as unknown as Db)
    const where = ownerWhere(owner)
    return db.creditWallet.upsert({ where, create: { ...where, balance: 0 }, update: {} })
  }

  async getBalance(companyId: string): Promise<number> {
    return this.getOwnerBalance({ companyId })
  }

  async getOwnerBalance(owner: WalletOwner): Promise<number> {
    const wallet = await this.prisma.creditWallet.findUnique({ where: ownerWhere(owner) })
    return wallet?.balance ?? 0
  }

  async hasCharge(type: WalletEntry["type"], referenceId: string): Promise<boolean> {
    const row = await this.prisma.creditTransaction.findFirst({
      where: { type: type as CreditTransactionType, referenceId },
      select: { id: true },
    })
    return !!row
  }

  async debit(entry: WalletEntry, tx?: Db): Promise<WalletResult> {
    const amount = this.validAmount(entry.amount)
    return this.run(tx, async (db) => {
      if (amount === 0) {
        const wallet = await this.ensureOwnerWallet(entry, db)
        return { balanceAfter: wallet.balance, transactionId: null }
      }
      await this.ensureOwnerWallet(entry, db)
      const updated = await db.creditWallet.updateMany({
        where: { ...ownerWhere(entry), balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (updated.count !== 1) {
        const wallet = await db.creditWallet.findUnique({ where: ownerWhere(entry) })
        throw new AppException(
          "Not enough Momentum credits",
          HttpStatus.PAYMENT_REQUIRED,
          "INSUFFICIENT_CREDITS",
          { balance: wallet?.balance ?? 0, required: amount }
        )
      }
      return this.record(db, entry, -amount)
    })
  }

  async credit(entry: WalletEntry, tx?: Db): Promise<WalletResult> {
    const amount = this.validAmount(entry.amount)
    return this.run(tx, async (db) => {
      if (amount === 0) {
        const wallet = await this.ensureOwnerWallet(entry, db)
        return { balanceAfter: wallet.balance, transactionId: null }
      }
      const where = ownerWhere(entry)
      await db.creditWallet.upsert({
        where,
        create: { ...where, balance: amount },
        update: { balance: { increment: amount } },
      })
      return this.record(db, entry, amount)
    })
  }

  /**
   * Refunds the application fee of every still-unreviewed (APPLIED) application of a job that is
   * closing or being deleted. Once per application (REFUND with referenceId = application id);
   * serialized per job with an advisory lock so concurrent close/delete calls can't double-refund.
   */
  async refundUnreviewedApplications(jobId: string, tx?: Db): Promise<number> {
    return this.run(tx, async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${jobId}`}))`
      const apps = await db.application.findMany({
        where: { jobId, status: "APPLIED", userId: { not: null } },
        select: { id: true, userId: true },
      })
      if (!apps.length) return 0
      const ids = apps.map((a) => a.id)
      const ledger = await db.creditTransaction.findMany({
        where: { referenceId: { in: ids }, type: { in: ["APPLICATION", "REFUND"] } },
        select: { referenceId: true, type: true, amount: true },
      })
      let refunded = 0
      for (const app of apps) {
        const charge = ledger.find((t) => t.referenceId === app.id && t.type === "APPLICATION")
        const done = ledger.some((t) => t.referenceId === app.id && t.type === "REFUND")
        if (!charge || done || charge.amount >= 0) continue
        await this.credit(
          {
            userId: app.userId!,
            amount: -charge.amount,
            type: "REFUND",
            referenceId: app.id,
            note: "Refund: the job closed before your application was reviewed",
          },
          db
        )
        refunded++
      }
      return refunded
    })
  }

  private validAmount(amount: number): number {
    if (!Number.isInteger(amount) || amount < 0)
      throw new AppException("Credit amount must be a non-negative integer", 400, "INVALID_AMOUNT")
    return amount
  }

  /** Reads the post-update balance (row is locked by our update) and appends the ledger row. */
  private async record(db: Db, entry: WalletEntry, signed: number): Promise<WalletResult> {
    const where = ownerWhere(entry)
    const wallet = await db.creditWallet.findUnique({ where })
    const balanceAfter = wallet?.balance ?? 0
    const row = await db.creditTransaction.create({
      data: {
        ...where,
        amount: signed,
        type: entry.type as CreditTransactionType,
        balanceAfter,
        referenceId: entry.referenceId ?? null,
        actorId: entry.actorId ?? null,
        note: entry.note ?? null,
      },
    })
    return { balanceAfter, transactionId: row.id }
  }
}
