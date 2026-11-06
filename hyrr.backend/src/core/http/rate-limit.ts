import { Logger } from "@nestjs/common"
import { NextFunction, Request, Response } from "express"

/** Current state of one fixed window after counting a hit. */
export type RateLimitHit = { count: number; resetAt: number }

/**
 * Counts hits per key in a fixed window. Sync (in-memory) or async (Redis); the limiter
 * handles both and stays synchronous for the in-memory store.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, at: number): RateLimitHit | Promise<RateLimitHit>
}

export type RateLimitRule = {
  /** Bucket name — requests are counted per client IP + bucket. */
  name: string
  limit: number
  windowMs: number
  matches: (req: Request) => boolean
}

export type RateLimitOptions = {
  rules: RateLimitRule[]
  /** Fallback limit for everything else, counted per IP + route group (first path segment). */
  defaultLimit: number
  windowMs: number
  /** Requests for which the limiter is bypassed entirely (e.g. health probes). */
  skip?: (req: Request) => boolean
  /** Hard cap on tracked keys of the in-memory store, so memory stays bounded under spoofed-IP floods. */
  maxKeys?: number
  /** Shared store (e.g. RedisRateLimitStore). Defaults to a process-local in-memory store. */
  store?: RateLimitStore
  now?: () => number
}

/** `/api/jobs/123/foo` → `jobs` */
export function routeGroup(path: string): string {
  const segments = path.split("?")[0].split("/").filter(Boolean)
  const offset = segments[0] === "api" ? 1 : 0
  return segments[offset] || "root"
}

/** Process-local fixed-window store with a bounded number of keys. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitHit>()
  private lastSweep = 0

  constructor(private readonly maxKeys = 50_000) {}

  size(): number {
    return this.buckets.size
  }

  /** Drops expired windows; called at most once per `windowMs` by the limiter. */
  sweepIfDue(at: number, windowMs: number) {
    if (at - this.lastSweep > windowMs) this.sweep(at)
  }

  private sweep(at: number) {
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= at) this.buckets.delete(key)
    this.lastSweep = at
  }

  hit(key: string, windowMs: number, at: number): RateLimitHit {
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= at) {
      if (!bucket && this.buckets.size >= this.maxKeys) {
        this.sweep(at)
        // Still full: drop the oldest entries (Map preserves insertion order).
        const overflow = this.buckets.size - this.maxKeys + 1
        if (overflow > 0) {
          let i = 0
          for (const k of this.buckets.keys()) {
            if (i++ >= overflow) break
            this.buckets.delete(k)
          }
        }
      }
      bucket = { count: 0, resetAt: at + windowMs }
      this.buckets.set(key, bucket)
    }
    bucket.count += 1
    return bucket
  }
}

/** Minimal slice of an ioredis client used by the Redis store (mockable in tests). */
export type RateLimitRedisClient = {
  status: string
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>
}

/**
 * Fixed window: INCR, PEXPIRE on the first hit (or when a key somehow lost its TTL), and the
 * remaining PTTL so the limiter can compute Retry-After. Atomic, so concurrent instances agree.
 */
export const RATE_LIMIT_LUA = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`

export type RedisRateLimitStoreOptions = {
  /** Key prefix; full key is `<prefix><bucket>:<ip>`. */
  prefix?: string
  /** Slower Redis answers fall back to the in-memory store for that request. */
  timeoutMs?: number
  /** Used while Redis is not ready or failing. Defaults to a fresh MemoryRateLimitStore. */
  fallback?: RateLimitStore
  logger?: Pick<Logger, "warn">
}

/**
 * Shared fixed-window store in Redis (`hyrr:rl:<bucket>:<ip>`). Fails open: while the client is
 * not ready, errors or is slow, hits are counted in the process-local fallback store instead,
 * so Redis trouble never blocks or fails requests.
 */
export class RedisRateLimitStore implements RateLimitStore {
  readonly prefix: string
  readonly fallback: RateLimitStore
  private readonly timeoutMs: number
  private readonly logger: Pick<Logger, "warn">
  private lastWarnAt = 0

  constructor(
    private readonly client: RateLimitRedisClient,
    options: RedisRateLimitStoreOptions = {}
  ) {
    this.prefix = options.prefix ?? "hyrr:rl:"
    this.timeoutMs = options.timeoutMs ?? 250
    this.fallback = options.fallback ?? new MemoryRateLimitStore()
    this.logger = options.logger ?? new Logger("RateLimit")
  }

  hit(key: string, windowMs: number, at: number): RateLimitHit | Promise<RateLimitHit> {
    if (this.client.status !== "ready") return this.fallback.hit(key, windowMs, at)
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("rate-limit redis timeout")), this.timeoutMs)
    })
    return Promise.race([
      this.client.eval(RATE_LIMIT_LUA, 1, `${this.prefix}${key}`, windowMs),
      timeout,
    ])
      .then((reply) => {
        const [count, ttl] = (reply as [number | string, number | string]).map(Number)
        if (!Number.isFinite(count)) throw new Error("unexpected rate-limit reply")
        return { count, resetAt: at + Math.max(0, Number.isFinite(ttl) ? ttl : windowMs) }
      })
      .catch((err: any) => {
        this.warn(err)
        return this.fallback.hit(key, windowMs, at)
      })
      .finally(() => timer && clearTimeout(timer))
  }

  /** At most one warning per minute while Redis is failing. */
  private warn(err: any) {
    const now = Date.now()
    if (now - this.lastWarnAt < 60_000) return
    this.lastWarnAt = now
    this.logger.warn(
      `Redis rate-limit store unavailable (${err?.message || err}); using in-memory limits`
    )
  }
}

const isPromise = <T>(value: T | Promise<T>): value is Promise<T> =>
  !!value && typeof (value as any).then === "function"

/**
 * Fixed-window limiter. Process-local by default; pass a shared `store` (RedisRateLimitStore)
 * when running several instances so limits apply across them.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const memory = new MemoryRateLimitStore(options.maxKeys ?? 50_000)
  const store = options.store ?? memory
  const fallback =
    store instanceof RedisRateLimitStore && store.fallback instanceof MemoryRateLimitStore
      ? store.fallback
      : memory
  const now = options.now ?? Date.now

  const reject = (res: Response, bucket: RateLimitHit, at: number) => {
    res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - at) / 1000)))
    return res.status(429).json({
      success: false,
      statusCode: 429,
      errorCode: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again shortly.",
    })
  }

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS" || options.skip?.(req)) return next()
    const at = now()
    fallback.sweepIfDue(at, options.windowMs)

    const ip = req.ip || req.socket?.remoteAddress || "unknown"
    const checks: { key: string; limit: number; windowMs: number }[] = options.rules
      .filter((rule) => rule.matches(req))
      .map((rule) => ({ key: `${rule.name}:${ip}`, limit: rule.limit, windowMs: rule.windowMs }))
    checks.push({
      key: `group:${routeGroup(req.originalUrl || req.path)}:${ip}`,
      limit: options.defaultLimit,
      windowMs: options.windowMs,
    })

    // Checks run in order and stop at the first exceeded bucket (same as before). Sync stores
    // stay synchronous; async stores continue in the promise chain.
    const run = (index: number): unknown => {
      for (let i = index; i < checks.length; i++) {
        const check = checks[i]
        const result = store.hit(check.key, check.windowMs, at)
        if (isPromise(result)) {
          result.then(
            (bucket) => (bucket.count > check.limit ? reject(res, bucket, at) : run(i + 1)),
            // Stores are expected to fail open themselves; never block on an unexpected error.
            () => run(i + 1)
          )
          return
        }
        if (result.count > check.limit) return reject(res, result, at)
      }
      next()
    }
    return run(0)
  }

  return Object.assign(middleware, { size: () => memory.size() })
}

/** POST endpoints sharing the strict per-IP "auth" bucket. */
export const STRICT_AUTH_PATH =
  /^\/api\/auth\/(login|register|forgot-password|reset-password|resend-verification|2fa\/verify)\/?$/
