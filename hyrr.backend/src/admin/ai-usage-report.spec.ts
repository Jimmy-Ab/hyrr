import { estimateCost, estimateTokens, featureOf } from "../ai/ai-usage"
import { usageReport } from "./ai-usage-report"

const row = (over: Record<string, any> = {}) => ({
  provider: "openai",
  model: "gpt-4o-mini",
  feature: "candidate_analysis",
  ok: true,
  latencyMs: 1000,
  inputTokens: 1000,
  outputTokens: 200,
  costUsd: 0.00027,
  createdAt: new Date("2026-11-10T10:00:00Z"),
  ...over,
})

describe("AI usage", () => {
  it("estimates tokens and cost (only for priced models)", () => {
    expect(estimateTokens("x".repeat(40))).toBe(10)
    expect(estimateCost("gpt-4o-mini", 1_000_000, 1_000_000)).toBe(0.75)
    expect(estimateCost("unknown-model", 100, 100)).toBeNull()
    expect(
      estimateCost("gemini-2.5-flash", 1_000_000, 0, {
        AI_PRICES_JSON: '{"gemini-2.5-flash":[0.3,2.5]}',
      } as any)
    ).toBe(0.3)
    expect(featureOf("structured", ["", "", "", {}, "cv_tailoring"])).toBe("cv_tailoring")
  })

  it("aggregates failures, latency percentiles, cost and the weekly helpful rate", () => {
    const report = usageReport(
      [
        row(),
        row({ ok: false, latencyMs: 5000, outputTokens: 0, costUsd: 0.00015 }),
        row({ model: "claude-x", provider: "claude", costUsd: null }),
      ],
      [
        { helpful: true, createdAt: new Date("2026-11-10T10:00:00Z") },
        { helpful: false, createdAt: new Date("2026-11-11T10:00:00Z") },
      ]
    )
    expect(report.totals).toMatchObject({ calls: 3, failures: 1, p95LatencyMs: 5000 })
    const openai = report.byModel.find((m) => m.key === "openai:gpt-4o-mini")!
    expect(openai.costUsd).toBe(0.0004)
    expect(report.byModel.find((m) => m.key === "claude:claude-x")!.costUsd).toBeNull()
    expect(report.feedback).toMatchObject({
      total: 2,
      helpfulRate: 0.5,
      weekly: [{ week: "2026-11-09", helpful: 1, total: 2 }],
    })
  })
})
