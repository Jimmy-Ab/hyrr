export type AiProvider = "claude" | "gemini" | "openai"

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  claude: "claude-sonnet-5-5",
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
}

/** Order used when no stored model / AI_PROVIDER picks a keyed provider. */
export const PROVIDER_PRIORITY: AiProvider[] = ["openai", "claude", "gemini"]

const PROVIDER_KEY_ENV: Record<AiProvider, string> = {
  openai: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  gemini: "GOOGLE_AI_API_KEY",
}

/** Per-call timeout for chat / featured-jobs LLM requests. */
export const LLM_TIMEOUT_MS = 30_000
/** Per-call timeout for candidate analysis (bigger prompt: profile + CV). */
export const ANALYSIS_TIMEOUT_MS = 45_000

/** Model ids, overridable with AI_MODEL_CLAUDE / AI_MODEL_GEMINI / AI_MODEL_OPENAI. */
export function configuredModels(): Record<AiProvider, string> {
  return {
    claude: process.env.AI_MODEL_CLAUDE || DEFAULT_MODELS.claude,
    gemini: process.env.AI_MODEL_GEMINI || DEFAULT_MODELS.gemini,
    openai: process.env.AI_MODEL_OPENAI || DEFAULT_MODELS.openai,
  }
}

/** The only values accepted for SystemSetting.activeModel. */
export function getAllowedModels(): string[] {
  return Array.from(new Set(Object.values(configuredModels())))
}

export function providerFor(model: string): AiProvider {
  const models = configuredModels()
  const exact = (Object.keys(models) as AiProvider[]).find((p) => models[p] === model)
  if (exact) return exact
  if (model.startsWith("claude")) return "claude"
  if (model.startsWith("gpt") || /^o\d/.test(model)) return "openai"
  return "gemini"
}

/** True for empty values and the placeholders shipped in .env.example ("sk-...", "AIza..."). */
export function isPlaceholderKey(value: string | undefined | null): boolean {
  const key = (value || "").trim()
  if (!key) return true
  if (key.includes("...") || key.includes("…")) return true
  if (/^(your[_-]|changeme|replace[_-]?me|xxx+$|<)/i.test(key)) return true
  return false
}

export function apiKeyFor(provider: AiProvider): string | undefined {
  const key = process.env[PROVIDER_KEY_ENV[provider]]
  return isPlaceholderKey(key) ? undefined : key!.trim()
}

/** Providers that have a real (non-placeholder) API key, in priority order. */
export function configuredProviders(): AiProvider[] {
  return PROVIDER_PRIORITY.filter((p) => !!apiKeyFor(p))
}

/** AI_PROVIDER env value → provider (accepts openai | anthropic | claude | google | gemini). */
export function forcedProvider(): AiProvider | null {
  const value = (process.env.AI_PROVIDER || "").trim().toLowerCase()
  if (value === "openai") return "openai"
  if (value === "anthropic" || value === "claude") return "claude"
  if (value === "google" || value === "gemini") return "gemini"
  return null
}

export type ResolvedModel = { model: string; provider: AiProvider }

/**
 * Model actually used for AI calls:
 * 1. the stored SystemSetting.activeModel when its provider has a key,
 * 2. else the AI_PROVIDER provider's configured model when keyed,
 * 3. else the first keyed provider (openai → anthropic → google).
 * Null means AI is disabled (no key configured).
 */
export function resolveActiveModel(stored?: string | null): ResolvedModel | null {
  const keyed = configuredProviders()
  if (keyed.length === 0) return null
  const models = configuredModels()
  if (stored && getAllowedModels().includes(stored)) {
    const provider = providerFor(stored)
    if (keyed.includes(provider)) return { model: stored, provider }
  }
  const forced = forcedProvider()
  if (forced && keyed.includes(forced)) return { model: models[forced], provider: forced }
  return { model: models[keyed[0]], provider: keyed[0] }
}

/** Initial SystemSetting.activeModel: the resolved model, else the OpenAI default. */
export function defaultActiveModel(): string {
  return resolveActiveModel()?.model ?? configuredModels().openai
}
