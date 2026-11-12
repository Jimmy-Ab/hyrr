/** Supply/demand per market bucket (category or location). Pure; unit-tested. */

export const UNDERSUPPLIED_BELOW = 3
export const OVERSUPPLIED_ABOVE = 30

export type LiquidityRow = {
  key: string
  label: string
  openJobs: number
  activeSeekers: number
  applications30d: number
  /** Applications per open job in the last 30 days (null without open jobs). */
  ratio: number | null
  signal: "undersupplied" | "balanced" | "oversupplied" | "no_jobs"
}

/** "Berlin, Germany" → "Germany"; remote postings get their own bucket. */
export function locationBucket(location: string | null | undefined, remote: boolean) {
  if (remote) return "Remote"
  const parts = (location ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : "Unspecified"
}

export function liquidityRows(
  buckets: Map<
    string,
    { label: string; openJobs: number; seekers: Set<string>; applications: number }
  >
): LiquidityRow[] {
  return [...buckets.entries()]
    .map(([key, b]) => {
      const ratio = b.openJobs ? Math.round((b.applications / b.openJobs) * 10) / 10 : null
      const signal: LiquidityRow["signal"] =
        ratio === null
          ? "no_jobs"
          : ratio < UNDERSUPPLIED_BELOW
            ? "undersupplied"
            : ratio > OVERSUPPLIED_ABOVE
              ? "oversupplied"
              : "balanced"
      return {
        key,
        label: b.label,
        openJobs: b.openJobs,
        activeSeekers: b.seekers.size,
        applications30d: b.applications,
        ratio,
        signal,
      }
    })
    .sort((a, b) => b.openJobs - a.openJobs || b.applications30d - a.applications30d)
}
