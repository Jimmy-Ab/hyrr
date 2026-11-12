import { plainToInstance } from "class-transformer"
import { validateSync } from "class-validator"
import { CreateJobDto } from "../../jobs/dtos/create-job.dto"
import { EducationDto, ExperienceDto, UpdateProfileDto } from "../../profile/dtos/profile.dto"
import {
  approxYearlyUsd,
  formatMonthRange,
  formatSalaryRange,
  formatYearRange,
  parseMonth,
} from "./structured"

const errors = (cls: any, body: object) =>
  validateSync(plainToInstance(cls, body)).flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...(e.children ?? []).flatMap((c) => Object.values(c.constraints ?? {})),
  ])

const job = {
  title: "Backend Engineer",
  location: "Berlin",
  type: "FULL_TIME",
  description: "Build and run APIs in Node.js for our platform.",
  requirements: ["Node"],
  skills: ["Node"],
  categoryId: "c1",
}

describe("structured formatting", () => {
  it("formats salary ranges, months and years", () => {
    expect(formatSalaryRange(120000, 150000, "USD", "YEAR")).toBe("USD 120,000 – 150,000 / year")
    expect(formatSalaryRange(5000, 5000, "ETB", "MONTH")).toBe("ETB 5,000 / month")
    expect(formatSalaryRange(null, 1, "USD", "YEAR")).toBeNull()
    expect(formatMonthRange(parseMonth("2021-03"), null, true)).toBe("Mar 2021 – Present")
    expect(formatMonthRange(parseMonth("2019-01"), parseMonth("2020-12"), false)).toBe(
      "Jan 2019 – Dec 2020"
    )
    expect(formatYearRange(2015, 2019)).toBe("2015 – 2019")
    expect(parseMonth("2021-13")).toBeNull()
  })

  it("converts to approximate yearly USD", () => {
    expect(approxYearlyUsd(10000, "USD", "MONTH")).toBe(120000)
    expect(approxYearlyUsd(100, "XXX", "YEAR")).toBeNull()
  })
})

describe("job salary validation", () => {
  it("accepts no salary or a full range", () => {
    expect(errors(CreateJobDto, job)).toEqual([])
    expect(
      errors(CreateJobDto, {
        ...job,
        salaryMin: 100,
        salaryMax: 200,
        salaryCurrency: "ETB",
        salaryPeriod: "MONTH",
      })
    ).toEqual([])
  })
  it("requires all four fields together", () => {
    expect(errors(CreateJobDto, { ...job, salaryMin: 100 })).toEqual(
      expect.arrayContaining([
        "Enter the maximum salary",
        "Choose a currency",
        "Choose per year, month or hour",
      ])
    )
  })
  it("rejects max < min, unknown currency, negative and fractional values", () => {
    const e = errors(CreateJobDto, {
      ...job,
      salaryMin: 200,
      salaryMax: 100,
      salaryCurrency: "XYZ",
      salaryPeriod: "YEAR",
    })
    expect(e).toEqual(
      expect.arrayContaining([
        "Maximum salary must be at least the minimum",
        "Choose a supported currency",
      ])
    )
    expect(
      errors(CreateJobDto, {
        ...job,
        salaryMin: -1,
        salaryMax: 1.5,
        salaryCurrency: "USD",
        salaryPeriod: "YEAR",
      })
    ).toEqual(
      expect.arrayContaining([
        "Minimum salary can't be negative",
        "Maximum salary must be a whole number",
      ])
    )
  })
  it("enforces title, description, requirements and skills", () => {
    expect(
      errors(CreateJobDto, {
        ...job,
        title: "ab",
        description: "short",
        requirements: [],
        skills: [],
      })
    ).toEqual(
      expect.arrayContaining([
        "Job title must be at least 3 characters",
        "Description must be at least 20 characters",
        "Add at least one requirement",
        "Add at least one skill",
      ])
    )
  })
})

describe("profile validation", () => {
  const exp = { role: "Engineer", company: "Acme", startDate: "2020-01", endDate: "2021-06" }
  it("accepts a valid experience and a current one", () => {
    expect(errors(ExperienceDto, exp)).toEqual([])
    expect(errors(ExperienceDto, { ...exp, endDate: null, current: true })).toEqual([])
  })
  it("rejects missing fields, end before start, future start and missing end", () => {
    expect(errors(ExperienceDto, { ...exp, role: " ", endDate: "2019-01" })).toEqual(
      expect.arrayContaining(["Job title is required", "End month can't be before the start month"])
    )
    expect(errors(ExperienceDto, { ...exp, startDate: "2999-01", endDate: "2999-02" })).toContain(
      "Start month can't be in the future"
    )
    expect(errors(ExperienceDto, { ...exp, endDate: null })).toContain(
      'Choose an end month or tick "I currently work here"'
    )
    expect(errors(ExperienceDto, { ...exp, startDate: "2020-13" })).toContain(
      "Choose a start month"
    )
  })
  it("validates education years", () => {
    expect(
      errors(EducationDto, { school: "MIT", degree: "BSc", startYear: 2015, endYear: 2019 })
    ).toEqual([])
    expect(
      errors(EducationDto, { school: "", degree: "BSc", startYear: 2015, endYear: 2010 })
    ).toEqual(
      expect.arrayContaining(["School is required", "End year can't be before the start year"])
    )
  })
  it("profile headline and location: empty clears, one character is too short", () => {
    expect(errors(UpdateProfileDto, { title: "", location: "" })).toEqual([])
    expect(errors(UpdateProfileDto, { title: "Accountant", location: "Addis Ababa" })).toEqual([])
    expect(errors(UpdateProfileDto, { title: "A", location: "B" })).toEqual(
      expect.arrayContaining(["Add a headline, e.g. Frontend Developer", "Add your city or region"])
    )
  })
  it("profile links explain an invalid URL", () => {
    expect(errors(UpdateProfileDto, { website: "not a link" })).toContain(
      "Enter a valid link, e.g. https://example.com"
    )
    expect(errors(UpdateProfileDto, { github: "https://github.com/hyrr" })).toEqual([])
  })
  it("validates the expected salary range like the job one", () => {
    expect(
      errors(UpdateProfileDto, {
        expectedSalaryMin: 5000,
        expectedSalaryMax: 4000,
        expectedSalaryCurrency: "ETB",
        expectedSalaryPeriod: "MONTH",
      })
    ).toContain("Maximum must be at least the minimum")
    expect(
      errors(UpdateProfileDto, {
        expectedSalaryMin: null,
        expectedSalaryMax: null,
        expectedSalaryCurrency: null,
        expectedSalaryPeriod: null,
      })
    ).toEqual([])
  })
  it("bounds preferred categories (interests) like the zod schema", () => {
    expect(errors(UpdateProfileDto, { interests: ["c1", "c2"] })).toEqual([])
    expect(
      errors(UpdateProfileDto, { interests: Array.from({ length: 11 }, (_, i) => `c${i}`) })
    ).toContain("Pick at most 10 preferred categories")
    expect(errors(UpdateProfileDto, { interests: [42] })).toContain(
      "Each preferred category must be a category id"
    )
  })
})
