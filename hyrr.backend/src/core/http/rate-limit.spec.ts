import { createRateLimiter, routeGroup } from "./rate-limit"

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
