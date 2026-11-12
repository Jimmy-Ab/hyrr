import { computeFunnelAnalytics, FunnelApplication, FunnelEvent } from "./funnel-analytics"

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n))

describe("computeFunnelAnalytics (R7)", () => {
  // a1: APPLIED d0 → IN_PROCESS d2 → INTERVIEWING d5 → OFFER d10
  // a2: APPLIED d0 → IN_PROCESS d4 → ARCHIVED d6
  // a3: APPLIED d1 (still applied)
  // a4: recruiter-added straight into INTERVIEWING d3, no other events, then WITHDRAWN d7
  // a5: legacy row in OFFER with no events at all
  const apps: FunnelApplication[] = [
    { id: "a1", jobId: "j1", status: "OFFER", source: "DIRECT", appliedAt: day(0) },
    { id: "a2", jobId: "j1", status: "ARCHIVED", source: "GUEST", appliedAt: day(0) },
    { id: "a3", jobId: "j2", status: "APPLIED", source: "DIRECT", appliedAt: day(1) },
    { id: "a4", jobId: "j2", status: "WITHDRAWN", source: "RECRUITER_ADDED", appliedAt: day(3) },
    { id: "a5", jobId: "j1", status: "OFFER", source: "DIRECT", appliedAt: day(0) },
  ]
  const events: FunnelEvent[] = [
    { applicationId: "a1", toStatus: "APPLIED", createdAt: day(0) },
    { applicationId: "a1", toStatus: "IN_PROCESS", createdAt: day(2) },
    { applicationId: "a1", toStatus: "INTERVIEWING", createdAt: day(5) },
    { applicationId: "a1", toStatus: "OFFER", createdAt: day(10) },
    { applicationId: "a2", toStatus: "APPLIED", createdAt: day(0) },
    { applicationId: "a2", toStatus: "IN_PROCESS", createdAt: day(4) },
    { applicationId: "a2", toStatus: "ARCHIVED", createdAt: day(6) },
    { applicationId: "a3", toStatus: "APPLIED", createdAt: day(1) },
    { applicationId: "a4", toStatus: "INTERVIEWING", createdAt: day(3) },
    { applicationId: "a4", toStatus: "WITHDRAWN", createdAt: day(7) },
  ]
  const jobs = [
    { id: "j1", title: "Backend" },
    { id: "j2", title: "Frontend" },
    { id: "j3", title: "Empty" },
  ]
  const result = computeFunnelAnalytics(apps, events, jobs)

  it("counts applications that reached a stage or a later one", () => {
    expect(result.funnel).toEqual([
      { stage: "APPLIED", reached: 5, conversionFromPrevious: 1 },
      { stage: "IN_PROCESS", reached: 4, conversionFromPrevious: 0.8 },
      { stage: "INTERVIEWING", reached: 3, conversionFromPrevious: 0.75 },
      { stage: "OFFER", reached: 2, conversionFromPrevious: 0.667 },
    ])
  })

  it("time to hire uses the first APPLIED and OFFER events (only apps with an OFFER event)", () => {
    expect(result.timeToHireDays).toEqual({ median: 10, average: 10 })
  })

  it("time in stage averages completed stays", () => {
    expect(result.timeInStageDays).toEqual({
      APPLIED: 3, // a1 2d, a2 4d
      IN_PROCESS: 2.5, // a1 3d, a2 2d
      INTERVIEWING: 4.5, // a1 5d, a4 4d
      OFFER: null, // nobody left OFFER
    })
  })

  it("splits by source and per job (current status)", () => {
    expect(result.bySource).toEqual({ DIRECT: 3, GUEST: 1, RECRUITER_ADDED: 1, OUTREACH: 0 })
    expect(result.perJob).toEqual([
      { jobId: "j1", title: "Backend", applicants: 3, inProcess: 0, interviewing: 0, offers: 2 },
      { jobId: "j2", title: "Frontend", applicants: 2, inProcess: 0, interviewing: 0, offers: 0 },
      { jobId: "j3", title: "Empty", applicants: 0, inProcess: 0, interviewing: 0, offers: 0 },
    ])
  })

  it("empty input yields zeros and nulls", () => {
    const empty = computeFunnelAnalytics([], [], [])
    expect(empty.funnel.every((s) => s.reached === 0 && s.conversionFromPrevious === 0)).toBe(true)
    expect(empty.timeToHireDays).toEqual({ median: null, average: null })
  })
})
