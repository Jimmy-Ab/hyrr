import { NextFunction, Request, Response } from "express"

type Bucket = { count: number; resetAt: number }

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
  /** Hard cap on tracked keys so memory stays bounded even under spoofed-IP floods. */
  maxKeys?: number
  now?: () => number
}

/** `/api/jobs/123/foo` → `jobs` */
export function routeGroup(path: string): string {
  const segments = path.split("?")[0].split("/").filter(Boolean)
  const offset = segments[0] === "api" ? 1 : 0
  return segments[offset] || "root"
}

/** Process-local fixed-window limiter. Use a shared (Redis) store when scaling horizontally. */
export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>()
  const maxKeys = options.maxKeys ?? 50_000
  const now = options.now ?? Date.now
  let lastSweep = now()

  const sweep = (at: number) => {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= at) buckets.delete(key)
    lastSweep = at
  }

  const hit = (key: string, limit: number, windowMs: number, at: number) => {
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= at) {
      if (!bucket && buckets.size >= maxKeys) {
        sweep(at)
        // Still full: drop the oldest entries (Map preserves insertion order).
        const overflow = buckets.size - maxKeys + 1
        if (overflow > 0) {
          let i = 0
          for (const k of buckets.keys()) {
            if (i++ >= overflow) break
            buckets.delete(k)
          }
        }
      }
      bucket = { count: 0, resetAt: at + windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1
    return bucket
  }

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS") return next()
    const at = now()
    if (at - lastSweep > options.windowMs) sweep(at)

    const ip = req.ip || req.socket?.remoteAddress || "unknown"
    const checks: { key: string; limit: number; windowMs: number }[] = options.rules
      .filter((rule) => rule.matches(req))
      .map((rule) => ({ key: `${ip}|${rule.name}`, limit: rule.limit, windowMs: rule.windowMs }))
    checks.push({
      key: `${ip}|group:${routeGroup(req.originalUrl || req.path)}`,
      limit: options.defaultLimit,
      windowMs: options.windowMs,
    })

    for (const check of checks) {
      const bucket = hit(check.key, check.limit, check.windowMs, at)
      if (bucket.count > check.limit) {
        res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - at) / 1000)))
        return res.status(429).json({
          success: false,
          statusCode: 429,
          errorCode: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again shortly.",
        })
      }
    }
    next()
  }

  return Object.assign(middleware, { size: () => buckets.size })
}
