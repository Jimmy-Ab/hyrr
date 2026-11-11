import "reflect-metadata"
import { plainToInstance } from "class-transformer"
import { validateSync } from "class-validator"
import { JobFiltersDto, toJobFilters } from "./dtos/job-filters.dto"
import { hyrrJobFilterWhere, webJobFilterWhere } from "./job-filters"

const messages = (body: object) =>
  validateSync(plainToInstance(JobFiltersDto, body)).flatMap((e) =>
    Object.values(e.constraints ?? {})
  )

describe("job filters", () => {
  it("validates the structured salary range and posted-within choices", () => {
    expect(messages({ salaryMin: "1000", salaryCurrency: "USD", salaryPeriod: "YEAR" })).toEqual([])
    expect(messages({ salaryMin: "1000" })).toEqual(
      expect.arrayContaining([
        "Pick a currency for the salary filter",
        "Pick a period for the salary filter",
      ])
    )
    expect(
      messages({
        salaryMin: "5000",
        salaryMax: "4000",
        salaryCurrency: "USD",
        salaryPeriod: "YEAR",
      })
    ).toContain("Maximum must be at least the minimum")
    expect(messages({ postedWithin: "5" })).toContain("Pick how recent the jobs should be")
    expect(messages({ type: "SOMETIMES" })).toContain("Pick an employment type from the list")
  })

  it("builds Hyrr where clauses: every filter ANDed, salary overlaps in currency + period", () => {
    const f = toJobFilters(
      plainToInstance(JobFiltersDto, {
        categoryId: "c1",
        remote: "true",
        type: "FULL_TIME",
        salaryMin: "50000",
        salaryCurrency: "USD",
        salaryPeriod: "YEAR",
        postedWithin: "7",
      })
    )
    const where = hyrrJobFilterWhere(f)
    expect(where).toEqual(
      expect.arrayContaining([
        { categoryId: "c1" },
        { OR: [{ remote: true }, { type: "REMOTE" }] },
        { type: "FULL_TIME" },
        { salaryCurrency: "USD", salaryPeriod: "YEAR" },
        { OR: [{ salaryMax: { gte: 50000 } }, { salaryMax: null, salaryMin: { gte: 50000 } }] },
      ])
    )
    expect(hyrrJobFilterWhere({})).toEqual([])
  })

  it("matches web jobs by provider text and converts the salary filter to yearly", () => {
    const where = webJobFilterWhere(
      {
        categoryId: "c1",
        type: "PART_TIME" as any,
        salary: { min: 1000, currency: "EUR", period: "MONTH" as any },
      },
      "Software"
    )
    expect(where).toEqual(
      expect.arrayContaining([
        { category: { contains: "Software", mode: "insensitive" } },
        { OR: [{ employmentType: { contains: "part", mode: "insensitive" } }] },
        { salaryCurrency: "EUR" },
        { OR: [{ salaryMax: { gte: 12000 } }, { salaryMax: null, salaryMin: { gte: 12000 } }] },
      ])
    )
    // Unknown category: nothing matches.
    expect(webJobFilterWhere({ categoryId: "nope" }, null)).toEqual([{ id: { in: [] } }])
  })
})
