import { MaintenanceService } from "./maintenance.service"

describe("MaintenanceService", () => {
  const now = new Date("2026-11-05T12:00:00Z")
  const prisma: any = {
    authToken: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }
  const queue: any = { process: jest.fn(), repeat: jest.fn() }
  const service = new MaintenanceService(prisma, queue)

  it("registers both repeatable jobs with handlers", () => {
    service.onModuleInit()
    expect(queue.process.mock.calls.map((c: any[]) => c[1])).toEqual([
      "token-cleanup",
      "stale-payments",
    ])
    expect(queue.repeat.mock.calls.map((c: any[]) => c[1])).toEqual([
      "token-cleanup",
      "stale-payments",
    ])
  })

  it("deletes tokens expired or used more than 7 days ago", async () => {
    await expect(service.cleanupTokens(now)).resolves.toBe(3)
    const cutoff = new Date("2026-10-29T12:00:00Z")
    expect(prisma.authToken.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
    })
  })

  it("fails only PENDING payments older than 48 hours", async () => {
    await expect(service.failStalePayments(now)).resolves.toBe(1)
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { status: "PENDING", createdAt: { lt: new Date("2026-11-03T12:00:00Z") } },
      data: { status: "FAILED" },
    })
  })

  it("is a no-op without a queue", () => {
    expect(() => new MaintenanceService(prisma).onModuleInit()).not.toThrow()
  })
})
