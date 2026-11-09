import { parseSalaryMax, PricingService } from "./pricing.service"
import { fakeBillingDb } from "./testing/fake-billing-db"

describe("parseSalaryMax", () => {
  it.each([
    ["$120,000 – $150,000", 150000],
    ["From $130k", 130000],
    ["90K-110K", 110000],
    ["€80.000", 80000],
    ["1.2m", 1200000],
    ["ETB 45,000 / month", 45000],
    ["Competitive", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(parseSalaryMax(input as any)).toBe(expected)
  })
})

describe("PricingService", () => {
  const env = { ...process.env }
  let db: any
  let pricing: PricingService

  beforeEach(() => {
    for (const k of Object.keys(process.env)) if (k.startsWith("MOMENTUM_")) delete process.env[k]
    db = fakeBillingDb()
    pricing = new PricingService(db)
  })
  afterAll(() => {
    process.env = env
  })

  it("returns the default config", async () => {
    expect(await pricing.getConfig()).toEqual({
      publishBase: 10,
      multipliers: { remote: 0.9, highSalary: 1.5, featuredCategory: 1.2 },
      highSalaryThresholdUsd: 120000,
      featureCost: 25,
      featureDays: 14,
      aiRerunCost: 2,
      signupBonus: 20,
      applyCost: 1,
      outreachCost: 5,
      seekerSignupBonus: 10,
    })
  })

  it("applies env overrides, then SystemSetting.momentumConfig", async () => {
    process.env.MOMENTUM_PUBLISH_BASE = "20"
    process.env.MOMENTUM_FEATURE_COST = "40"
    db.systemSetting.rows.push({
      id: "global-settings",
      momentumConfig: { featureCost: 30, multipliers: { remote: 0.5 } },
    })
    const c = await pricing.getConfig()
    expect(c.publishBase).toBe(20)
    expect(c.featureCost).toBe(30)
    expect(c.multipliers).toEqual({ remote: 0.5, highSalary: 1.5, featuredCategory: 1.2 })
  })

  it("caches the config for 60 s", async () => {
    await pricing.getConfig()
    await pricing.getConfig()
    expect(db.systemSetting.findFirst).toHaveBeenCalledTimes(1)
  })

  it("publishCost: base, remote, high salary and premium category multipliers", async () => {
    expect(await pricing.publishCost({ remote: false })).toBe(10)
    expect(await pricing.publishCost({ remote: true })).toBe(9)
    expect(await pricing.publishCost({ remote: false, salary: "$120,000 – $150,000" })).toBe(15)
    expect(await pricing.publishCost({ remote: false, salary: "$90,000 – $119,999" })).toBe(10)
    expect(await pricing.publishCost({ remote: true, salary: "From $130k" })).toBe(14) // 10 × 0.9 × 1.5 = 13.5

    process.env.MOMENTUM_PREMIUM_CATEGORIES = "engineering, Design"
    pricing.invalidate()
    db.jobCategory.rows.push({ id: "cat-1", slug: "engineering", name: "Engineering" })
    db.jobCategory.rows.push({ id: "cat-2", slug: "sales", name: "Sales" })
    const b = await pricing.publishCostBreakdown({
      remote: false,
      salary: "150k",
      categoryId: "cat-1",
    })
    expect(b).toEqual({
      cost: 18,
      base: 10,
      multipliers: [
        { name: "highSalary", factor: 1.5 },
        { name: "featuredCategory", factor: 1.2 },
      ],
    })
    expect(await pricing.publishCost({ remote: false, categoryId: "cat-2" })).toBe(10)
  })

  it("never charges less than 1 credit", async () => {
    db.systemSetting.rows.push({ momentumConfig: { publishBase: 0 } })
    expect(await pricing.publishCost({ remote: true })).toBe(1)
  })
})
