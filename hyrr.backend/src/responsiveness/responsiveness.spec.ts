import { businessDaysBetween, computeStats } from "./responsiveness"

const now = new Date("2026-11-30T12:00:00Z")
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000)

describe("responsiveness maths", () => {
  it("median first response, review rate and the Fast Responder rule", () => {
    const apps = Array.from({ length: 10 }, (_, i) => ({
      appliedAt: ago(100 + i),
      status: "IN_PROCESS",
      firstResponseAt: ago(100 + i - 20), // answered 20 h later
    }))
    expect(computeStats(apps, now)).toMatchObject({
      applications30d: 10,
      medianFirstResponseHours: 20,
      reviewRate30d: 1,
      fastResponder: true,
    })
  })

  it("needs 10+ applications; ghosting counts untouched APPLIED ones older than 21 days", () => {
    const old = { appliedAt: ago(24 * 25), status: "APPLIED", firstResponseAt: null }
    const answered = {
      appliedAt: ago(24 * 25),
      status: "IN_PROCESS",
      firstResponseAt: ago(24 * 24),
    }
    const stats = computeStats([old, old, old, answered], now)
    expect(stats.fastResponder).toBe(false)
    expect(stats.ghostRate30d).toBe(0.75)
    expect(stats.reviewRate30d).toBe(0.25)
  })

  it("brand-new applications (< 48 h) don't count against the review rate", () => {
    expect(
      computeStats([{ appliedAt: ago(5), status: "APPLIED", firstResponseAt: null }], now)
        .reviewRate30d
    ).toBeNull()
  })

  it("business days skip weekends", () => {
    // Fri 2026-11-20 → Mon 2026-11-30: Mon–Fri of the week between + Mon = 6
    expect(
      businessDaysBetween(new Date("2026-11-20T10:00:00Z"), new Date("2026-11-30T10:00:00Z"))
    ).toBe(6)
    expect(
      businessDaysBetween(new Date("2026-11-27T10:00:00Z"), new Date("2026-11-30T10:00:00Z"))
    ).toBe(1)
  })
})
