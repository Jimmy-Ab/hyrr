import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { ANALYSIS_TIMEOUT_MS, LLM_TIMEOUT_MS } from "../ai.models"
import {
  ANALYSIS_INSTRUCTION,
  candidateMatchSchema,
  JSON_ANALYSIS_INSTRUCTION,
  normalizeAnalysis,
  parseAnalysisResponse,
} from "../candidate-analysis"
import {
  AIMatchResult,
  CandidateAnalysisResult,
  ChatTurn,
  LLMAdapter,
} from "../interfaces/llm-adapter.interface"

const JSON_INSTRUCTION =
  '\n\nRespond ONLY with a JSON object: {"score": number between 0 and 100, "summary": "string"}'

/** Shared prompt building, timeout handling and strict response parsing for all providers. */
export abstract class BaseLLMAdapter implements LLMAdapter {
  protected abstract createModel(model: string, temperature: number, timeoutMs: number): BaseChatModel

  async generateMatch(
    model: string,
    systemPrompt: string,
    temperature: number,
    candidateData: Record<string, any>,
    jobData: Record<string, any>
  ): Promise<AIMatchResult> {
    const content = await this.invoke(model, temperature, [
      new SystemMessage(systemPrompt + JSON_INSTRUCTION),
      new HumanMessage(buildMatchPrompt(candidateData, jobData)),
    ])
    return parseMatchResponse(content)
  }

  async analyzeCandidate(
    model: string,
    systemPrompt: string,
    temperature: number,
    prompt: string
  ): Promise<CandidateAnalysisResult> {
    // One deadline for the structured attempt and the plain-JSON fallback together.
    const signal = AbortSignal.timeout(ANALYSIS_TIMEOUT_MS)
    const llm = this.createModel(model, temperature, ANALYSIS_TIMEOUT_MS)
    const human = new HumanMessage(prompt)
    if (typeof (llm as any).withStructuredOutput === "function") {
      try {
        const structured = llm.withStructuredOutput(candidateMatchSchema, {
          name: "candidate_match",
        })
        const result = await structured.invoke(
          [new SystemMessage(systemPrompt + ANALYSIS_INSTRUCTION), human],
          { signal }
        )
        return normalizeAnalysis(result)
      } catch (err) {
        if (!isRecoverable(err, signal)) throw err
      }
    }
    const response = await llm.invoke(
      [new SystemMessage(systemPrompt + ANALYSIS_INSTRUCTION + JSON_ANALYSIS_INSTRUCTION), human],
      { signal }
    )
    return parseAnalysisResponse(messageText(response.content))
  }

  async chat(
    model: string,
    systemPrompt: string,
    temperature: number,
    history: ChatTurn[],
    message: string
  ): Promise<string> {
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)]
    for (const turn of history) {
      messages.push(
        turn.role === "assistant" ? new AIMessage(turn.content) : new HumanMessage(turn.content)
      )
    }
    messages.push(new HumanMessage(message))
    const reply = (await this.invoke(model, temperature, messages)).trim()
    if (!reply) throw new Error("Empty AI response")
    return reply
  }

  private async invoke(model: string, temperature: number, messages: BaseMessage[]) {
    const llm = this.createModel(model, temperature, LLM_TIMEOUT_MS)
    const response = await llm.invoke(messages, { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) })
    return messageText(response.content)
  }
}

/** Errors where retrying without structured output cannot help (timeouts, auth, rate limits). */
function isRecoverable(err: any, signal: AbortSignal): boolean {
  if (signal.aborted) return false
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return false
  const status = Number(err?.status ?? err?.response?.status)
  if ([401, 403, 404, 429].includes(status)) return false
  return true
}

export function messageText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part: any) =>
        typeof part === "string" ? part : part?.type === "text" ? part.text : ""
      )
      .join("")
  }
  return ""
}

export function buildMatchPrompt(
  candidateData: Record<string, any>,
  jobData: Record<string, any>
): string {
  return `
Job Title: ${jobData.title}
Job Requirements: ${(jobData.requirements || []).join(", ")}
Required Skills: ${(jobData.skills || []).join(", ")}
Job Description: ${String(jobData.description || "").slice(0, 8000)}

Candidate Title: ${candidateData.title || ""}
Candidate Skills: ${(candidateData.skills || []).join(", ")}
Candidate Bio: ${String(candidateData.bio || "").slice(0, 4000)}
Work Experience: ${JSON.stringify(candidateData.experiences || []).slice(0, 6000)}
Education: ${JSON.stringify(candidateData.educations || []).slice(0, 2000)}
Cover Letter: ${String(candidateData.coverLetter || "").slice(0, 4000)}
  `.trim()
}

/** Strict parse: throws unless the model returned a JSON object with a numeric 0-100 score. */
export function parseMatchResponse(raw: string): AIMatchResult {
  const cleaned = raw.replace(/```json|```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end <= start) throw new Error("AI response did not contain JSON")
  const parsed = JSON.parse(cleaned.slice(start, end + 1))
  const score = typeof parsed.score === "string" ? Number(parsed.score) : parsed.score
  if (typeof score !== "number" || !Number.isFinite(score))
    throw new Error("AI response did not contain a numeric score")
  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    summary: String(parsed.summary || "").slice(0, 4000),
  }
}
