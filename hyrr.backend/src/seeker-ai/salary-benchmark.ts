/** Salary benchmark from real postings (Hyrr jobs + jobs from the web) in one currency. */

export const MIN_SAMPLES = 10
const YEARLY: Record<string, number> = { YEAR: 1, MONTH: 12, HOUR: 2080 }
const STOP = new Set([
  "senior",
  "junior",
  "lead",
  "mid",
  "level",
  "the",
  "and",
  "of",
  "for",
  "i",
  "ii",
  "iii",
  "sr",
  "jr",
])

/** Words that identify the role ("Senior Backend Engineer" → ["backend", "engineer"]). */
export function roleTerms(title: string): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        .split(/[^a-z0-9+#]+/)
        .filter((w) => w.length >= 2 && !STOP.has(w))
    ),
  ].slice(0, 3)
}

/** Yearly midpoint of a posted range, or null when unusable. */
export function yearlyMid(p: {
  salaryMin?: number | null
  salaryMax?: number | null
  salaryPeriod?: string | null
}) {
  const lo = p.salaryMin ?? p.salaryMax
  const hi = p.salaryMax ?? p.salaryMin
  if (!lo || !hi) return null
  return ((lo + hi) / 2) * (YEARLY[p.salaryPeriod ?? "YEAR"] ?? 1)
}

export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo))
}

export function summarise(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    samples: sorted.length,
    enoughData: sorted.length >= MIN_SAMPLES,
    p25: sorted.length >= MIN_SAMPLES ? percentile(sorted, 0.25) : null,
    p50: sorted.length >= MIN_SAMPLES ? percentile(sorted, 0.5) : null,
    p75: sorted.length >= MIN_SAMPLES ? percentile(sorted, 0.75) : null,
  }
}
