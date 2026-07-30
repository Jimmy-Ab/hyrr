export interface AIMatchResult {
  score: number // 0-100
  summary: string // Bullet point analysis
}

export interface LLMAdapter {
  generateMatch(
    systemPrompt: string,
    temperature: number,
    candidateData: Record<string, any>,
    jobData: Record<string, any>
  ): Promise<AIMatchResult>
}
