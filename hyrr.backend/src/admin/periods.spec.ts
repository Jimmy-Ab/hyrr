import {
  bucketStarts,
  dashboardRanges,
  lastMonths,
  pickInterval,
  previousRangeOf,
  truncate,
} from "./periods"

const d = (s: string) => new Date(s)
const iso = (r: { from: Date; to: Date }) => [r.from.toISOString(), r.to.toISOString()]

describe("admin periods (UTC, calendar based)", () => {
  const now = d("2026-11-06T14:00:00.000Z") // a Friday

  it("today compares with yesterday until the same time", () => {
    const { range, previousRange } = dashboardRanges("today", now)
    expect(iso(range)).toEqual(["2026-11-06T00:00:00.000Z", "2026-11-06T14:00:00.000Z"])
    expect(iso(previousRange)).toEqual(["2026-11-05T00:00:00.000Z", "2026-11-05T14:00:00.000Z"])
  })

  it("week starts on Monday", () => {
    const { range, previousRange } = dashboardRanges("week", now)
    expect(range.from.toISOString()).toBe("2026-11-02T00:00:00.000Z")
    expect(iso(previousRange)).toEqual(["2026-10-26T00:00:00.000Z", "2026-10-30T14:00:00.000Z"])
    // Sunday belongs to the week that started six days earlier.
    expect(dashboardRanges("week", d("2026-11-08T09:00:00Z")).range.from.toISOString()).toBe(
      "2026-11-02T00:00:00.000Z"
    )
  })

  it("month and year use the same elapsed length", () => {
    const month = dashboardRanges("month", now)
    expect(iso(month.range)).toEqual(["2026-11-01T00:00:00.000Z", "2026-11-06T14:00:00.000Z"])
    expect(iso(month.previousRange)).toEqual([
      "2026-10-01T00:00:00.000Z",
      "2026-10-06T14:00:00.000Z",
    ])
    const year = dashboardRanges("year", now)
    expect(year.range.from.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(year.previousRange.from.toISOString()).toBe("2025-01-01T00:00:00.000Z")
  })

  it("a long month never compares into the current one (Mar 31 vs all of February)", () => {
    const { previousRange } = dashboardRanges("month", d("2026-03-31T12:00:00Z"))
    expect(iso(previousRange)).toEqual(["2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z"])
  })

  it("picks the analytics interval from the range length", () => {
    const r = (days: number) => ({ from: now, to: new Date(now.getTime() + days * 86400000) })
    expect(pickInterval(r(30))).toBe("day")
    expect(pickInterval(r(45))).toBe("day")
    expect(pickInterval(r(90))).toBe("week")
    expect(pickInterval(r(365))).toBe("month")
  })

  it("previous range has the same length and ends where the range starts", () => {
    const prev = previousRangeOf({ from: d("2026-11-01T00:00:00Z"), to: d("2026-11-08T00:00:00Z") })
    expect(iso(prev)).toEqual(["2026-10-25T00:00:00.000Z", "2026-11-01T00:00:00.000Z"])
  })

  it("buckets follow date_trunc (weeks start Monday, months on the 1st)", () => {
    expect(truncate(now, "week").toISOString()).toBe("2026-11-02T00:00:00.000Z")
    const days = bucketStarts(
      { from: d("2026-11-01T12:00:00Z"), to: d("2026-11-04T00:00:00Z") },
      "day"
    )
    expect(days.map((t) => t.toISOString().slice(0, 10))).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ])
    const months = bucketStarts(
      { from: d("2026-01-15T00:00:00Z"), to: d("2026-03-02T00:00:00Z") },
      "month"
    )
    expect(months.map((t) => t.toISOString().slice(0, 7))).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ])
  })

  it("lists the last six months oldest first", () => {
    expect(lastMonths(d("2026-02-10T00:00:00Z"), 6).map((m) => m.month)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ])
  })
})
