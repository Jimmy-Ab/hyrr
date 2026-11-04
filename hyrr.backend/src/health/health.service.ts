import { Injectable, Optional } from "@nestjs/common"
import { CacheService } from "../cache/cache.service"
import { PrismaService } from "../prisma/prisma.service"

export type CheckState = "ok" | "error" | "disabled"
export type Readiness = { status: "ok" | "error"; db: CheckState; redis: CheckState }

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
    @Optional() private readonly cache?: CacheService
  ) {}

  liveness() {
    return { status: "ok" as const, uptime: Math.round(process.uptime()) }
  }

  async readiness(): Promise<Readiness> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()])
    const status = db === "error" || redis === "error" ? "error" : "ok"
    return { status, db, redis }
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
    if (!process.env.REDIS_HOST?.trim() || !this.cache) return "disabled"
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
}
