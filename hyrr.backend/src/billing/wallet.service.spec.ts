import { fakeBillingDb } from "./testing/fake-billing-db"
import { WalletService } from "./wallet.service"

describe("WalletService", () => {
  let db: any
  let wallet: WalletService

  beforeEach(() => {
    db = fakeBillingDb()
    wallet = new WalletService(db)
    db.creditWallet.rows.push({ id: "w1", companyId: "co-1", balance: 20 })
  })

  it("credits atomically and writes a ledger row with balanceAfter", async () => {
    const res = await wallet.credit({
      companyId: "co-1",
      amount: 30,
      type: "PURCHASE",
      referenceId: "p1",
    })
    expect(res.balanceAfter).toBe(50)
    expect(db.creditTransaction.rows).toEqual([
      expect.objectContaining({
        amount: 30,
        type: "PURCHASE",
        balanceAfter: 50,
        referenceId: "p1",
      }),
    ])
    expect(res.transactionId).toBe(db.creditTransaction.rows[0].id)
  })

  it("creates a missing wallet on credit", async () => {
    const res = await wallet.credit({ companyId: "co-new", amount: 20, type: "SIGNUP_BONUS" })
    expect(res.balanceAfter).toBe(20)
    expect(await wallet.getBalance("co-new")).toBe(20)
  })

  it("debits with a conditional update and records a negative ledger row", async () => {
    const res = await wallet.debit({
      companyId: "co-1",
      amount: 12,
      type: "JOB_PUBLISH",
      referenceId: "job-1",
      actorId: "u1",
    })
    expect(res.balanceAfter).toBe(8)
    expect(db.creditWallet.updateMany).toHaveBeenCalledWith({
      where: { companyId: "co-1", balance: { gte: 12 } },
      data: { balance: { decrement: 12 } },
    })
    expect(db.creditTransaction.rows[0]).toEqual(
      expect.objectContaining({ amount: -12, balanceAfter: 8, actorId: "u1", type: "JOB_PUBLISH" })
    )
  })

  it("rejects an insufficient balance with 402 INSUFFICIENT_CREDITS and details", async () => {
    await expect(
      wallet.debit({ companyId: "co-1", amount: 21, type: "JOB_PUBLISH" })
    ).rejects.toMatchObject({
      status: 402,
      errorCode: "INSUFFICIENT_CREDITS",
      details: { balance: 20, required: 21 },
    })
    expect(db.creditWallet.rows[0].balance).toBe(20)
    expect(db.creditTransaction.rows).toHaveLength(0)
  })

  it("treats amount 0 as a no-op without a ledger row", async () => {
    const res = await wallet.debit({ companyId: "co-1", amount: 0, type: "JOB_PUBLISH" })
    expect(res).toEqual({ balanceAfter: 20, transactionId: null })
    expect(db.creditTransaction.rows).toHaveLength(0)
  })

  it("rejects negative or fractional amounts", async () => {
    await expect(
      wallet.debit({ companyId: "co-1", amount: -5, type: "ADJUSTMENT" })
    ).rejects.toMatchObject({ errorCode: "INVALID_AMOUNT" })
    await expect(
      wallet.credit({ companyId: "co-1", amount: 1.5, type: "ADJUSTMENT" })
    ).rejects.toMatchObject({ errorCode: "INVALID_AMOUNT" })
  })

  it("two concurrent debits cannot overspend (only one wins)", async () => {
    const results = await Promise.allSettled([
      wallet.debit({ companyId: "co-1", amount: 15, type: "JOB_PUBLISH", referenceId: "a" }),
      wallet.debit({ companyId: "co-1", amount: 15, type: "JOB_PUBLISH", referenceId: "b" }),
    ])
    const ok = results.filter((r) => r.status === "fulfilled")
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0].reason).toMatchObject({ errorCode: "INSUFFICIENT_CREDITS" })
    expect(db.creditWallet.rows[0].balance).toBe(5)
    expect(db.creditTransaction.rows).toHaveLength(1)
  })

  it("uses the caller's transaction client when given", async () => {
    const tx = fakeBillingDb()
    tx.creditWallet.rows.push({ id: "w", companyId: "co-1", balance: 5 })
    await wallet.debit({ companyId: "co-1", amount: 5, type: "AI_ANALYSIS" }, tx)
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(tx.creditWallet.rows[0].balance).toBe(0)
  })

  it("hasCharge looks up the ledger by type and reference", async () => {
    db.creditTransaction.rows.push({ id: "t", type: "REFUND", referenceId: "run-1" })
    expect(await wallet.hasCharge("REFUND", "run-1")).toBe(true)
    expect(await wallet.hasCharge("REFUND", "run-2")).toBe(false)
  })
})
