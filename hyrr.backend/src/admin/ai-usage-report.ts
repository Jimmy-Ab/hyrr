/** Aggregates AiUsage / AiFeedback rows for the admin AI observatory. Pure; unit-tested. */

type UsageRow = {
  provider: string
  model: string
  feature: string
  ok: boolean
  latencyMs: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  createdAt: Date
}

const pct = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null

function group(rows: UsageRow[], key: (r: UsageRow) => string) {
  const map = new Map<string, UsageRow[]>()
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r])
  return [...map.entries()]
    .map(([k, list]) => {
      const lat = list.map((r) => r.latencyMs).sort((a, b) => a - b)
      const priced = list.filter((r) => r.costUsd !== null)
      return {
        key: k,
        calls: list.length,
        failures: list.filter((r) => !r.ok).length,
        failureRate: Math.round((list.filter((r) => !r.ok).length / list.length) * 1000) / 1000,
        p50LatencyMs: pct(lat, 0.5),
        p95LatencyMs: pct(lat, 0.95),
        inputTokens: list.reduce((s, r) => s + r.inputTokens, 0),
        outputTokens: list.reduce((s, r) => s + r.outputTokens, 0),
        /** null when no price is known for these models */
        costUsd: priced.length
          ? Math.round(priced.reduce((s, r) => s + (r.costUsd ?? 0), 0) * 10000) / 10000
          : null,
      }
    })
    .sort((a, b) => b.calls - a.calls)
}

export function usageReport(rows: UsageRow[], feedback: { helpful: boolean; createdAt: Date }[]) {
  const day = (d: Date) => d.toISOString().slice(0, 10)
  const week = (d: Date) => {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7))
    return day(m)
  }
  const daily = new Map<string, { day: string; calls: number; costUsd: number }>()
  for (const r of rows) {
    const k = day(r.createdAt)
    const d = daily.get(k) ?? { day: k, calls: 0, costUsd: 0 }
    d.calls++
    d.costUsd += r.costUsd ?? 0
    daily.set(k, d)
  }
  const weeks = new Map<string, { week: string; helpful: number; total: number }>()
  for (const f of feedback) {
    const k = week(f.createdAt)
    const w = weeks.get(k) ?? { week: k, helpful: 0, total: 0 }
    w.total++
    if (f.helpful) w.helpful++
    weeks.set(k, w)
  }
  return {
    totals: group(rows, () => "all")[0] ?? null,
    byModel: group(rows, (r) => `${r.provider}:${r.model}`),
    byFeature: group(rows, (r) => r.feature),
    daily: [...daily.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({ ...d, costUsd: Math.round(d.costUsd * 10000) / 10000 })),
    feedback: {
      total: feedback.length,
      helpfulRate: feedback.length
        ? Math.round((feedback.filter((f) => f.helpful).length / feedback.length) * 1000) / 1000
        : null,
      weekly: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
    },
  }
}
