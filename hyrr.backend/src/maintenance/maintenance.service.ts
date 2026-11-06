import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { QueueService } from "../queue/queue.service"

const DAY_MS = 24 * 60 * 60 * 1000
export const TOKEN_CLEANUP_CRON = "0 3 * * *"
export const STALE_PAYMENTS_CRON = "0 * * * *"

/** Housekeeping on the `maintenance` queue: expired auth tokens and abandoned checkouts. */
@Injectable()
export class MaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queue?: QueueService
  ) {}

  onModuleInit() {
    if (!this.queue) return
    this.queue.process("maintenance", "token-cleanup", () => this.cleanupTokens())
    this.queue.process("maintenance", "stale-payments", () => this.failStalePayments())
    this.queue.repeat("maintenance", "token-cleanup", TOKEN_CLEANUP_CRON)
    this.queue.repeat("maintenance", "stale-payments", STALE_PAYMENTS_CRON)
  }

  /** Deletes verification/reset tokens that expired or were used more than 7 days ago. */
  async cleanupTokens(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 7 * DAY_MS)
    const { count } = await this.prisma.authToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
    })
    if (count) this.logger.log(`Removed ${count} old auth token(s)`)
    return count
  }

  /**
   * Checkouts still PENDING after 48 h were abandoned (Stripe sessions expire after 24 h): mark them
   * FAILED so payment history is accurate.
   */
  async failStalePayments(now = new Date()): Promise<number> {
    const { count } = await this.prisma.payment.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 2 * DAY_MS) } },
      data: { status: "FAILED" },
    })
    if (count) this.logger.log(`Marked ${count} abandoned payment(s) as FAILED`)
    return count
  }
}
