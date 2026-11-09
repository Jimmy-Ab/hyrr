import { assessJobRisk } from "./job-risk"

const ctx = {
  marketMedianYearly: 60000,
  companyAgeDays: 400,
  companyVerified: true,
  companyJobsLast24h: 1,
}
const longText =
  "<p>" +
  "We build reliable payment infrastructure for small businesses across Africa. ".repeat(4) +
  "</p>"

describe("assessJobRisk", () => {
  it("an ordinary posting passes", () => {
    const r = assessJobRisk(
      {
        title: "Backend Engineer",
        description: longText,
        salaryMin: 50000,
        salaryMax: 70000,
        salaryPeriod: "YEAR",
      },
      ctx
    )
    expect(r).toEqual({ score: 0, reasons: [], flagged: false })
  })

  it("adds up grey-area signals and flags at the threshold (3)", () => {
    const r = assessJobRisk(
      {
        title: "Data entry",
        description:
          "Earn $300 per day from home! Apply at bit.ly/job123 or mail hr.jobs@gmail.com",
        salaryMin: 250000,
        salaryMax: 300000,
        salaryPeriod: "YEAR",
      },
      ctx
    )
    expect(r.flagged).toBe(true)
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/3× the market median/),
        expect.stringMatching(/link shortener/),
        expect.stringMatching(/personal e-mail/),
        expect.stringMatching(/get-rich-quick/),
        expect.stringMatching(/Very short description/),
      ])
    )
  })

  it("a burst of jobs from a brand-new unverified company counts; no market data means no salary signal", () => {
    const r = assessJobRisk(
      {
        title: "Agent",
        description: longText,
        salaryMin: 900000,
        salaryMax: 900000,
        salaryPeriod: "YEAR",
      },
      { marketMedianYearly: null, companyAgeDays: 1, companyVerified: false, companyJobsLast24h: 6 }
    )
    expect(r.reasons).toEqual(["New, unverified company posting many jobs at once"])
    expect(r.flagged).toBe(false)
  })
})
