import type { RedisOptions } from "ioredis"

/**
 * Redis is optional. It counts as configured only when REDIS_HOST is set; without it,
 * queues run in-process, the rate limiter and socket.io stay single-instance.
 */
export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_HOST?.trim()
}

/** Connection options shared by every Redis user (cache, queues, socket adapter, rate limiter). */
export function redisOptions(overrides: Partial<RedisOptions> = {}): RedisOptions {
  return {
    host: process.env.REDIS_HOST?.trim() || "localhost",
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || "0", 10),
    ...overrides,
  }
}
