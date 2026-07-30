import { AIMatchResult, LLMAdapter } from "./llm-adapter.interface"

export interface AIFeaturedResult {
  jobId: string
  score: number
  summary: string
}

export { AIMatchResult, LLMAdapter }
