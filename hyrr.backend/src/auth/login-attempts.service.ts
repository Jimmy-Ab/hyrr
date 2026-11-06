import { Injectable } from "@nestjs/common"
import { CacheService } from "../cache/cache.service"
import { sha256 } from "./one-time-token"

type Counter = { count: number; resetAt: number }

export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000

/**
 * Fixed-window failure counters (login per e-mail / IP, 2FA per user). Stored through CacheService:
 * Redis when connected, otherwise its bounded in-process map (entries expire with the window).
 */
@Injectable()
export class LoginAttemptsService {
  constructor(private readonly cache: CacheService) {}

  loginKeys(email: string, ip?: string): string[] {
    const keys = [`auth:fail:email:${sha256(email.trim().toLowerCase())}`]
    if (ip) keys.push(`auth:fail:ip:${ip}`)
    return keys
  }

  /** Highest failure count among the keys within the current window. */
  async count(keys: string[], now = Date.now()): Promise<number> {
    const counters = await Promise.all(keys.map((k) => this.cache.get<Counter>(k)))
    return counters.reduce((max, c) => (c && c.resetAt > now ? Math.max(max, c.count) : max), 0)
  }

  async fail(keys: string[], windowMs = LOGIN_FAILURE_WINDOW_MS, now = Date.now()): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        const current = await this.cache.get<Counter>(key)
        const next: Counter =
          current && current.resetAt > now
            ? { count: current.count + 1, resetAt: current.resetAt }
            : { count: 1, resetAt: now + windowMs }
        const ttl = Math.max(1, Math.ceil((next.resetAt - now) / 1000))
        await this.cache.set(key, next, ttl)
      })
    )
  }

  async reset(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.cache.del(k)))
  }
}
