import { PUBLIC_JOB_OMIT, toPublicJob } from "./public-job"

describe("toPublicJob", () => {
  it("strips every internal column and keeps the rest", () => {
    const job = {
      id: "j1",
      title: "Accountant",
      recruiterId: "u1",
      riskScore: 37,
      riskReasons: ["Asks for payment"],
      momentumCost: 12,
      removedAt: null,
      removedReason: null,
      scorecardCompetencies: ["Ownership"],
    }
    const out = toPublicJob(job)
    expect(out).toEqual({ id: "j1", title: "Accountant" })
    for (const key of Object.keys(PUBLIC_JOB_OMIT)) expect(out).not.toHaveProperty(key)
    expect(job.riskScore).toBe(37) // input is not mutated
  })
})
