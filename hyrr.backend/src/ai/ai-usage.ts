/** Token and cost estimates for AI usage tracking (no provider bills are read). */

/** USD per 1M tokens [input, output]. Only prices we're confident about; others come from env. */
const DEFAULT_PRICES: Record<string, [number, number]> = {
  "gpt-4o-mini": [0.15, 0.6],
}

/** AI_PRICES_JSON='{"claude-sonnet-5-5":[3,15],"gemini-2.5-flash":[0.3,2.5]}' adds or overrides. */
export function priceTable(env = process.env): Record<string, [number, number]> {
  try {
    const extra = env.AI_PRICES_JSON ? JSON.parse(env.AI_PRICES_JSON) : {}
    return { ...DEFAULT_PRICES, ...extra }
  } catch {
    return DEFAULT_PRICES
  }
}

/** ~4 characters per token (English); good enough for trends, not for invoices. */
export const estimateTokens = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "")
  return Math.ceil((text?.length ?? 0) / 4)
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  env = process.env
) {
  const price = priceTable(env)[model]
  if (!price) return null
  return Math.round(((inputTokens * price[0] + outputTokens * price[1]) / 1_000_000) * 1e6) / 1e6
}

/** Feature label per adapter call (structured calls carry their own name). */
export function featureOf(method: string, args: unknown[]) {
  if (method === "structured") return String(args[4] ?? "structured")
  return (
    (
      {
        generateMatch: "match",
        analyzeCandidate: "candidate_analysis",
        extractProfile: "cv_import",
        chat: "assistant_chat",
      } as Record<string, string>
    )[method] ?? method
  )
}
