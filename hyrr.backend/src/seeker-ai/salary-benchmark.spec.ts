import { MIN_SAMPLES, percentile, roleTerms, summarise, yearlyMid } from "./salary-benchmark"

describe("salary benchmark maths", () => {
  it("role terms drop seniority words", () => {
    expect(roleTerms("Senior Backend Engineer II")).toEqual(["backend", "engineer"])
  })
  it("yearly midpoint normalises month and hour", () => {
    expect(yearlyMid({ salaryMin: 4000, salaryMax: 6000, salaryPeriod: "MONTH" })).toBe(60000)
    expect(yearlyMid({ salaryMin: 50, salaryMax: null, salaryPeriod: "HOUR" })).toBe(104000)
    expect(yearlyMid({ salaryMin: null, salaryMax: null })).toBeNull()
  })
  it("percentiles interpolate; under 10 samples there are no figures", () => {
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30)
    expect(percentile([10, 20], 0.25)).toBe(13)
    expect(summarise([1, 2, 3])).toEqual({
      samples: 3,
      enoughData: false,
      p25: null,
      p50: null,
      p75: null,
    })
    const ten = Array.from({ length: MIN_SAMPLES }, (_, i) => (i + 1) * 1000)
    expect(summarise(ten)).toMatchObject({ enoughData: true, p50: 5500 })
  })
})
