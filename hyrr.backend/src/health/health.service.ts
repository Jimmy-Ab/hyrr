import { Injectable, Optional } from "@nestjs/common"
import { CacheService } from "../cache/cache.service"
import { isRedisConfigured } from "../core/redis/redis-options"
import { PrismaService } from "../prisma/prisma.service"
import { QueueService } from "../queue/queue.service"
import { SearchService } from "../search/search.service"

export type CheckState = "ok" | "error" | "disabled"
export type QueueDriverState = "bullmq" | "inline" | "disabled" | "error"
export type Readiness = {
  status: "ok" | "error"
  db: CheckState
  redis: CheckState
  /** Queue driver (informational; never fails readiness). */
  queues: QueueDriverState
  /** Failed jobs per queue, when the driver reports them. */
  failedJobs?: Record<string, number>
  /** Meilisearch (informational; search falls back to Postgres). */
  search: CheckState
}

const CHECK_TIMEOUT_MS = 3_000

function withTimeout<T>(promise: Promise<T>, ms = CHECK_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms)
  })
  return Promise.race([promise, timeout]).finally(() => timer && clearTimeout(timer))
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
    @Optional() private readonly search?: SearchService,
    @Optional() private readonly queue?: QueueService
  ) {}

  liveness() {
    return { status: "ok" as const, uptime: Math.round(process.uptime()) }
  }

  /** Fails only on the database, and on Redis when it is configured. */
  async readiness(): Promise<Readiness> {
    const [db, redis, queue, search] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkSearch(),
    ])
    const status = db === "error" || redis === "error" ? "error" : "ok"
    return {
      status,
      db,
      redis,
      queues: queue.driver,
      ...(queue.failed ? { failedJobs: queue.failed } : {}),
      search,
    }
  }

  private async checkDb(): Promise<CheckState> {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`)
      return "ok"
    } catch {
      return "error"
    }
  }

  /** Redis is optional: "disabled" unless REDIS_HOST is configured. */
  private async checkRedis(): Promise<CheckState> {
    if (!isRedisConfigured() || !this.cache) return "disabled"
    const cache: any = this.cache
    try {
      if (typeof cache.ping === "function") {
        await withTimeout(Promise.resolve(cache.ping()))
        return "ok"
      }
      // CacheService keeps its ioredis client private; ping it directly.
      const client = cache["client"]
      if (!client || typeof client.ping !== "function") return "error"
      const reply = await withTimeout<string>(client.ping())
      return reply === "PONG" ? "ok" : "error"
    } catch {
      return "error"
    }
  }

  private async checkQueues(): Promise<{
    driver: QueueDriverState
    failed?: Record<string, number>
  }> {
    if (!this.queue) return { driver: "disabled" }
    try {
      const status = await withTimeout(Promise.resolve(this.queue.status()))
      const failed: Record<string, number> = {}
      for (const [name, counts] of Object.entries(status.queues || {}))
        if (typeof counts?.failed === "number") failed[name] = counts.failed
      return { driver: status.driver, ...(Object.keys(failed).length ? { failed } : {}) }
    } catch {
      return { driver: "error" }
    }
  }

  private async checkSearch(): Promise<CheckState> {
    if (!this.search) return "disabled"
    try {
      return await withTimeout(this.search.health())
    } catch {
      return "error"
    }
  }
}
