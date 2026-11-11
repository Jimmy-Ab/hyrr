import { useJobStore } from "hyrr.shared"

/** False only when the server says AI is switched off (unknown while pricing loads = allowed). */
export function useAiAvailable(): boolean {
  return useJobStore((s) => s.pricing?.features.ai !== false)
}

export const AI_UNAVAILABLE_MESSAGE =
  "AI tools are switched off on Hyrr right now. No credits are used; try again later."
