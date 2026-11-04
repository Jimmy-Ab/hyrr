import {
  AIMatchResult,
  AiRecommendation,
  CandidateAnalysisResult,
  ChatTurn,
  LLMAdapter,
} from "./llm-adapter.interface"

export interface AIFeaturedResult {
  jobId: string
  score: number
  summary: string
}

export { AIMatchResult, AiRecommendation, CandidateAnalysisResult, ChatTurn, LLMAdapter }
