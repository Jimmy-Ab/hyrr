import { AdminStatsService } from "./admin-stats.service"
import { DASHBOARD_SOURCES } from "./sql"

describe("AdminStatsService", () => {
  const prisma: any = { $queryRaw: jest.fn() }
  const cache: any = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
  const service = new AdminStatsService(prisma, cache)
  beforeEach(() => prisma.$queryRaw.mockReset())

  it("splits current buckets (sparkline) from the previous range (bucket -1)", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { b: -1, v: 4n },
      { b: 0, v: 2n },
      { b: 11, v: 3 },
      { b: 5, v: "1" },
    ])
    const range = { from: new Date("2026-11-06T00:00:00Z"), to: new Date("2026-11-06T12:00:00Z") }
    const prev = { from: new Date("2026-11-05T00:00:00Z"), to: new Date("2026-11-05T12:00:00Z") }
    const res = await service.metric(DASHBOARD_SOURCES.applications, range, prev)
    expect(res.current).toBe(6)
    expect(res.previous).toBe(4)
    expect(res.sparkline).toEqual([2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3])
    // Timestamps are bound as zone-less text, never as JS Dates.
    const sql = prisma.$queryRaw.mock.calls[0][0]
    expect(sql.values).toContain("2026-11-06T00:00:00.000")
    expect(sql.values.some((v: unknown) => v instanceof Date)).toBe(false)
  })

  it("validates analytics ranges", () => {
    const from = new Date("2026-01-01T00:00:00Z")
    expect(() => service.resolveAnalyticsRange(from, from)).toThrow(
      expect.objectContaining({ errorCode: "INVALID_RANGE" })
    )
    expect(() => service.resolveAnalyticsRange(from, new Date("2030-01-01T00:00:00Z"))).toThrow(
      expect.objectContaining({ errorCode: "RANGE_TOO_LARGE" })
    )
    expect(() =>
      service.resolveAnalyticsRange(from, new Date("2027-12-01T00:00:00Z"), "day")
    ).toThrow(expect.objectContaining({ errorCode: "RANGE_TOO_LARGE" }))
    expect(service.resolveAnalyticsRange(from, new Date("2026-03-01T00:00:00Z")).interval).toBe(
      "week"
    )
  })

  it("serves analytics from the cache when present", async () => {
    cache.get.mockResolvedValueOnce({ cached: true })
    await expect(
      service.analytics(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-08T00:00:00Z"))
    ).resolves.toEqual({ cached: true })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(cache.get).toHaveBeenCalledWith(
      "admin:analytics:2026-10-01T00:00:00.000Z:2026-10-08T00:00:00.000Z:day"
    )
  })
})
