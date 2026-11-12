import { liquidityRows, locationBucket } from "./liquidity"

describe("liquidity", () => {
  it("buckets locations by country, remote separately", () => {
    expect(locationBucket("Berlin, Germany", false)).toBe("Germany")
    expect(locationBucket("Addis Ababa", false)).toBe("Addis Ababa")
    expect(locationBucket("Anywhere", true)).toBe("Remote")
    expect(locationBucket("", false)).toBe("Unspecified")
  })

  it("ratio = applications per open job, with supply signals", () => {
    const rows = liquidityRows(
      new Map([
        [
          "eng",
          { label: "Engineering", openJobs: 10, seekers: new Set(["a", "b"]), applications: 12 },
        ],
        ["ops", { label: "Operations", openJobs: 2, seekers: new Set(["c"]), applications: 80 }],
        ["art", { label: "Design", openJobs: 0, seekers: new Set(["d"]), applications: 3 }],
        [
          "mkt",
          { label: "Marketing", openJobs: 4, seekers: new Set(["e", "f"]), applications: 40 },
        ],
      ])
    )
    expect(rows.map((r) => [r.label, r.ratio, r.signal])).toEqual([
      ["Engineering", 1.2, "undersupplied"],
      ["Marketing", 10, "balanced"],
      ["Operations", 40, "oversupplied"],
      ["Design", null, "no_jobs"],
    ])
    expect(rows[0].activeSeekers).toBe(2)
  })
})
