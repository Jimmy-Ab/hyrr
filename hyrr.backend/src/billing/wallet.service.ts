import { HttpStatus, Injectable } from "@nestjs/common"
import { CreditTransactionType, Prisma } from "@prisma/client"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"

export type WalletEntry = {
  companyId: string
  amount: number
  type: CreditTransactionType | keyof typeof CreditTransactionType
  referenceId?: string | null
  actorId?: string | null
  note?: string | null
}

export type WalletResult = { balanceAfter: number; transactionId: string | null }

type Db = Prisma.TransactionClient

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
    const db: Db = tx ?? (this.prisma as unknown as Db)
    return db.creditWallet.upsert({
      where: { companyId },
      create: { companyId, balance: 0 },
      update: {},
    })
  }

  async getBalance(companyId: string): Promise<number> {
    const wallet = await this.prisma.creditWallet.findUnique({ where: { companyId } })
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
        const wallet = await this.ensureWallet(entry.companyId, db)
        return { balanceAfter: wallet.balance, transactionId: null }
      }
      await this.ensureWallet(entry.companyId, db)
      const updated = await db.creditWallet.updateMany({
        where: { companyId: entry.companyId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (updated.count !== 1) {
        const wallet = await db.creditWallet.findUnique({ where: { companyId: entry.companyId } })
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
        const wallet = await this.ensureWallet(entry.companyId, db)
        return { balanceAfter: wallet.balance, transactionId: null }
      }
      await db.creditWallet.upsert({
        where: { companyId: entry.companyId },
        create: { companyId: entry.companyId, balance: amount },
        update: { balance: { increment: amount } },
      })
      return this.record(db, entry, amount)
    })
  }

  private validAmount(amount: number): number {
    if (!Number.isInteger(amount) || amount < 0)
      throw new AppException("Credit amount must be a non-negative integer", 400, "INVALID_AMOUNT")
    return amount
  }

  /** Reads the post-update balance (row is locked by our update) and appends the ledger row. */
  private async record(db: Db, entry: WalletEntry, signed: number): Promise<WalletResult> {
    const wallet = await db.creditWallet.findUnique({ where: { companyId: entry.companyId } })
    const balanceAfter = wallet?.balance ?? 0
    const row = await db.creditTransaction.create({
      data: {
        companyId: entry.companyId,
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
