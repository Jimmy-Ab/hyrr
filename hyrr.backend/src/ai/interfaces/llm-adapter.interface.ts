import type { CvSuggestions } from "../cv-profile"

export interface AIMatchResult {
  score: number // 0-100
  summary: string // Bullet point analysis
}

export type ChatTurn = { role: "user" | "assistant"; content: string }

export type AiRecommendation = "STRONG_FIT" | "POSSIBLE_FIT" | "NOT_A_FIT"

/** Structured candidate report produced by the model (cvUsed/cvNote are added by AiService). */
export interface CandidateAnalysisResult {
  score: number // integer 0-100
  recommendation: AiRecommendation
  summary: string
  matchedSkills: string[]
  missingSkills: string[]
  strengths: string[]
  concerns: string[]
  experienceFit: string
}

export interface LLMAdapter {
  /** Scores a candidate against a job. Throws when the model fails or returns unparseable output. */
  generateMatch(
    model: string,
    systemPrompt: string,
    temperature: number,
    candidateData: Record<string, any>,
    jobData: Record<string, any>
  ): Promise<AIMatchResult>

  /**
   * Structured candidate analysis for a prepared prompt (job + candidate + CV).
   * Uses native structured output when available, otherwise tolerant JSON parsing. Throws on failure.
   */
  analyzeCandidate(
    model: string,
    systemPrompt: string,
    temperature: number,
    prompt: string
  ): Promise<CandidateAnalysisResult>

  /**
   * Profile suggestions extracted from CV text (structured output, tolerant JSON fallback).
   * Throws on failure.
   */
  extractProfile(model: string, cvText: string): Promise<CvSuggestions>

  /**
   * Generic structured output validated by a zod schema (native structured output when available,
   * otherwise tolerant JSON parsing). Throws on failure or when the output doesn't match.
   */
  structured<T>(
    model: string,
    systemPrompt: string,
    prompt: string,
    schema: any,
    name: string
  ): Promise<T>

  /** Free-form assistant reply. Throws on failure. */
  chat(
    model: string,
    systemPrompt: string,
    temperature: number,
    history: ChatTurn[],
    message: string
  ): Promise<string>
}
