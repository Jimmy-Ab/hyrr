import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import Redis from "ioredis"
import { redisOptions } from "../core/redis/redis-options"

const MEMORY_MAX_ENTRIES = 1000

/**
 * Redis-backed JSON cache. When Redis is unavailable it degrades to a small, bounded
 * in-process cache so callers (e.g. AI recommendations) still avoid repeated work.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis
  private connected = false
  private readonly memory = new Map<string, { value: string; expiresAt: number }>()

  onModuleInit() {
    try {
      this.client = new Redis({
        ...redisOptions(),
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
      })

      this.client.on("ready", () => {
        this.connected = true
      })
      this.client.on("error", () => {
        this.connected = false
      })
      this.client.on("end", () => {
        this.connected = false
      })

      this.client.connect().catch(() => {
        /* Redis optional – gracefully degraded */
      })
    } catch {
      this.connected = false
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit().catch(() => {})
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = this.connected ? await this.client.get(key) : this.memoryGet(key)
      return val ? (JSON.parse(val) as T) : null
    } catch {
      return null
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (this.connected) await this.client.set(key, serialized, "EX", ttlSeconds)
      else this.memorySet(key, serialized, ttlSeconds)
    } catch {
      /* swallow */
    }
  }

  async del(key: string): Promise<void> {
    this.memory.delete(key)
    if (!this.connected) return
    try {
      await this.client.del(key)
    } catch {
      /* swallow */
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(
      `^${pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".")}$`
    )
    for (const key of this.memory.keys()) if (regex.test(key)) this.memory.delete(key)
    if (!this.connected) return
    try {
      let cursor = "0"
      do {
        const [next, keys] = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 200)
        cursor = next
        if (keys.length) await this.client.del(...keys)
      } while (cursor !== "0")
    } catch {
      /* swallow */
    }
  }

  private memoryGet(key: string): string | null {
    const entry = this.memory.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key)
      return null
    }
    return entry.value
  }

  private memorySet(key: string, value: string, ttlSeconds: number) {
    if (!this.memory.has(key) && this.memory.size >= MEMORY_MAX_ENTRIES) {
      const now = Date.now()
      for (const [k, entry] of this.memory) if (entry.expiresAt <= now) this.memory.delete(k)
      if (this.memory.size >= MEMORY_MAX_ENTRIES) {
        const oldest = this.memory.keys().next().value
        if (oldest !== undefined) this.memory.delete(oldest)
      }
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }
}
