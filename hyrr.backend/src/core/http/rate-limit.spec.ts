import { createRateLimiter, RATE_LIMIT_LUA, RedisRateLimitStore, routeGroup } from "./rate-limit"

const run = (limiter: any, req: any) => {
  let status = 200
  const res: any = {
    setHeader: jest.fn(),
    status: (code: number) => {
      status = code
      return { json: () => undefined }
    },
  }
  let passed = false
  limiter(req, res, () => (passed = true))
  return passed ? 200 : status
}

describe("rate limiter", () => {
  it("groups routes by first segment after /api", () => {
    expect(routeGroup("/api/jobs/1/foo")).toBe("jobs")
    expect(routeGroup("/api/auth/login?x=1")).toBe("auth")
  })

  it("applies the strict bucket and prunes expired entries", () => {
    let now = 0
    const limiter = createRateLimiter({
      windowMs: 1000,
      defaultLimit: 100,
      now: () => now,
      rules: [
        {
          name: "auth",
          limit: 2,
          windowMs: 1000,
          matches: (r: any) => r.path === "/api/auth/login",
        },
      ],
    })
    const req = {
      method: "POST",
      ip: "1.1.1.1",
      path: "/api/auth/login",
      originalUrl: "/api/auth/login",
    }
    expect(run(limiter, req)).toBe(200)
    expect(run(limiter, req)).toBe(200)
    expect(run(limiter, req)).toBe(429)
    now = 5000
    expect(run(limiter, { ...req, ip: "2.2.2.2" })).toBe(200)
    expect(limiter.size()).toBe(2)
  })

  it("stays bounded under many distinct IPs", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, defaultLimit: 5, maxKeys: 10, rules: [] })
    for (let i = 0; i < 100; i++)
      run(limiter, {
        method: "GET",
        ip: `10.0.0.${i}`,
        path: "/api/jobs",
        originalUrl: "/api/jobs",
      })
    expect(limiter.size()).toBeLessThanOrEqual(10)
  })
})

/** Fake ioredis client that evaluates the fixed-window script against an in-memory map. */
const fakeRedis = (opts: { status?: string; fail?: boolean; hang?: boolean } = {}) => {
  const data = new Map<string, { count: number; expiresAt: number }>()
  const client = {
    status: opts.status ?? "ready",
    now: 0,
    eval: jest.fn(async (_script: string, _n: number, key: string, windowMs: number) => {
      if (opts.fail) throw new Error("ECONNREFUSED")
      if (opts.hang) return new Promise(() => undefined)
      let entry = data.get(key)
      if (!entry || entry.expiresAt <= client.now) {
        entry = { count: 0, expiresAt: client.now + Number(windowMs) }
        data.set(key, entry)
      }
      entry.count += 1
      return [entry.count, entry.expiresAt - client.now]
    }),
  }
  return client
}

/** Runs the middleware and resolves once it either called next() or answered. */
const runAsync = (limiter: any, req: any) =>
  new Promise<{ status: number; headers: Record<string, any>; body?: any }>((resolve) => {
    const headers: Record<string, any> = {}
    const res: any = {
      setHeader: (k: string, v: any) => (headers[k] = v),
      status: (code: number) => ({ json: (body: any) => resolve({ status: code, headers, body }) }),
    }
    limiter(req, res, () => resolve({ status: 200, headers }))
  })

describe("rate limiter with RedisRateLimitStore", () => {
  const rules = [
    { name: "auth", limit: 2, windowMs: 60_000, matches: (r: any) => r.path === "/api/auth/login" },
  ]
  const req = {
    method: "POST",
    ip: "1.1.1.1",
    path: "/api/auth/login",
    originalUrl: "/api/auth/login",
  }
  const quiet = { warn: jest.fn() }

  it("counts in Redis under hyrr:rl:<bucket>:<ip> and shares the window across instances", async () => {
    const redis = fakeRedis()
    const opts = { windowMs: 60_000, defaultLimit: 100, rules, now: () => 0 }
    const a = createRateLimiter({ ...opts, store: new RedisRateLimitStore(redis, { logger: quiet }) })
    const b = createRateLimiter({ ...opts, store: new RedisRateLimitStore(redis, { logger: quiet }) })

    expect((await runAsync(a, req)).status).toBe(200)
    expect((await runAsync(b, req)).status).toBe(200)
    const blocked = await runAsync(a, req)
    expect(blocked.status).toBe(429)
    expect(blocked.headers["Retry-After"]).toBe(60)
    expect(blocked.body).toEqual({
      success: false,
      statusCode: 429,
      errorCode: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again shortly.",
    })
    const keys = redis.eval.mock.calls.map((c: any[]) => c[2])
    expect(keys).toContain("hyrr:rl:auth:1.1.1.1")
    expect(keys).toContain("hyrr:rl:group:auth:1.1.1.1")
    expect(redis.eval.mock.calls[0][3]).toBe(60_000)
  })

  it("stops at the first exceeded bucket and skips OPTIONS / skipped paths", async () => {
    const redis = fakeRedis()
    const limiter = createRateLimiter({
      windowMs: 60_000,
      defaultLimit: 100,
      rules,
      skip: (r: any) => r.path === "/api/health",
      store: new RedisRateLimitStore(redis, { logger: quiet }),
    })
    await runAsync(limiter, { ...req, method: "OPTIONS" })
    await runAsync(limiter, { ...req, path: "/api/health", originalUrl: "/api/health" })
    expect(redis.eval).not.toHaveBeenCalled()
    await runAsync(limiter, req)
    await runAsync(limiter, req)
    redis.eval.mockClear()
    expect((await runAsync(limiter, req)).status).toBe(429)
    expect(redis.eval).toHaveBeenCalledTimes(1) // group bucket not counted once auth is exceeded
  })

  it("fails open to the in-memory store while Redis is not ready", async () => {
    const redis = fakeRedis({ status: "reconnecting" })
    const limiter = createRateLimiter({
      windowMs: 60_000,
      defaultLimit: 100,
      rules,
      store: new RedisRateLimitStore(redis, { logger: quiet }),
    })
    expect((await runAsync(limiter, req)).status).toBe(200)
    expect((await runAsync(limiter, req)).status).toBe(200)
    // Limits still apply per process.
    expect((await runAsync(limiter, req)).status).toBe(429)
    expect(redis.eval).not.toHaveBeenCalled()
  })

  it("fails open when Redis errors, and warns at most once a minute", async () => {
    const logger = { warn: jest.fn() }
    const redis = fakeRedis({ fail: true })
    const limiter = createRateLimiter({
      windowMs: 60_000,
      defaultLimit: 100,
      rules,
      store: new RedisRateLimitStore(redis, { logger }),
    })
    expect((await runAsync(limiter, req)).status).toBe(200)
    expect((await runAsync(limiter, req)).status).toBe(200)
    expect((await runAsync(limiter, req)).status).toBe(429)
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn.mock.calls[0][0]).toMatch(/ECONNREFUSED/)
  })

  it("fails open when Redis does not answer in time", async () => {
    const redis = fakeRedis({ hang: true })
    const store = new RedisRateLimitStore(redis, { logger: quiet, timeoutMs: 10 })
    const limiter = createRateLimiter({ windowMs: 60_000, defaultLimit: 100, rules, store })
    expect((await runAsync(limiter, req)).status).toBe(200)
  })

  it("the Lua script sets the expiry only on the first hit", () => {
    expect(RATE_LIMIT_LUA).toMatch(/INCR/)
    expect(RATE_LIMIT_LUA).toMatch(/if count == 1 then redis.call\("PEXPIRE"/)
  })
})
