import { Card, IconTile, Skeleton } from "hyrr.shared"
import { Bot } from "lucide-react"
import { useAdminQuery } from "../lib/api"
import { ErrorBlock } from "./ui/common"

type UsageGroup = {
  key: string
  calls: number
  failures: number
  failureRate: number
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}
type AiUsageData = {
  days: number
  pricedModels: string[]
  totals: UsageGroup | null
  byModel: UsageGroup[]
  byFeature: UsageGroup[]
  daily: { day: string; calls: number; costUsd: number }[]
  feedback: {
    total: number
    helpfulRate: number | null
    weekly: { week: string; helpful: number; total: number }[]
  }
}

const usd = (v: number | null) =>
  v === null ? "—" : v > 0 && v < 0.01 ? "< $0.01" : `$${v.toFixed(2)}`
const secs = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`)

function UsageTable({ title, groups }: { title: string; groups: UsageGroup[] }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-txt-caption">
        {title}
      </p>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-txt-caption">
            <th className="py-1.5 pr-3 font-semibold">
              <span className="sr-only">Name</span>
            </th>
            <th className="py-1.5 pr-3 text-right font-semibold">Calls</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Failed</th>
            <th className="py-1.5 pr-3 text-right font-semibold">p50 / p95</th>
            <th className="py-1.5 text-right font-semibold">Est. cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bg-border/60">
          {groups.map((g) => (
            <tr key={g.key}>
              <td className="py-1.5 pr-3 font-medium text-txt-heading">{g.key}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{g.calls}</td>
              <td
                className={`py-1.5 pr-3 text-right tabular-nums ${g.failureRate > 0.1 ? "text-sec-red" : ""}`}
              >
                {Math.round(g.failureRate * 100)}%
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {secs(g.p50LatencyMs)} / {secs(g.p95LatencyMs)}
              </td>
              <td className="py-1.5 text-right tabular-nums">{usd(g.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** AI observatory: usage, failures, latency, estimated cost and recruiter feedback (30 days). */
export function AiUsageCard() {
  const { data, error, refetch } = useAdminQuery<AiUsageData>("/ai-usage", { days: 30 })
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start gap-3">
        <IconTile icon={Bot} tone="violet" />
        <div>
          <h2 className="text-[16px] font-semibold text-txt-heading">AI usage & cost (30 days)</h2>
          <p className="text-[12.5px] text-txt-caption">
            Every AI call, estimated from text length (about 4 characters per token). Costs show
            only for models with a known price ({data?.pricedModels.join(", ") || "…"}); add others
            with AI_PRICES_JSON. Your provider's dashboard has the exact bill.
          </p>
        </div>
      </div>
      {error && !data ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <Skeleton className="h-40" />
      ) : !data.totals ? (
        <p className="text-[13px] text-txt-caption">No AI calls in the last 30 days.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Calls", String(data.totals.calls)],
              ["Failed", `${Math.round(data.totals.failureRate * 100)}%`],
              ["Est. cost", usd(data.totals.costUsd)],
              [
                "Recruiters found it helpful",
                data.feedback.helpfulRate === null
                  ? "No votes yet"
                  : `${Math.round(data.feedback.helpfulRate * 100)}% of ${data.feedback.total}`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-bg-hover/50 p-3">
                <p className="text-[11.5px] text-txt-caption">{label}</p>
                <p className="text-[16px] font-bold text-txt-heading">{value}</p>
              </div>
            ))}
          </div>
          <UsageTable title="By model" groups={data.byModel} />
          <UsageTable title="By feature" groups={data.byFeature} />
          {data.feedback.weekly.length > 1 && (
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-txt-caption">
                Helpful rate by week (falling = possible drift)
              </p>
              <ul className="flex flex-wrap gap-2 text-[12px]">
                {data.feedback.weekly.map((w) => (
                  <li key={w.week} className="rounded-lg bg-bg-hover/50 px-2 py-1 tabular-nums">
                    {w.week}: {Math.round((w.helpful / w.total) * 100)}% ({w.total})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
