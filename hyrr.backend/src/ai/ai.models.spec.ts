import { configuredProviders, isPlaceholderKey, resolveActiveModel } from "./ai.models"

const KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_AI_API_KEY",
  "AI_PROVIDER",
  "AI_MODEL_OPENAI",
  "AI_MODEL_CLAUDE",
  "AI_MODEL_GEMINI",
]

describe("resolveActiveModel", () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it("treats empty values and .env.example placeholders as not configured", () => {
    for (const v of ["", "  ", "sk-...", "sk-ant-...", "AIza...", "your_openai_key"]) {
      expect(isPlaceholderKey(v)).toBe(true)
    }
    expect(isPlaceholderKey("sk-proj-abc123")).toBe(false)
  })

  it("is disabled when no key is configured (placeholders ignored)", () => {
    process.env.OPENAI_API_KEY = "sk-..."
    process.env.ANTHROPIC_API_KEY = "sk-ant-..."
    process.env.GOOGLE_AI_API_KEY = "AIza..."
    expect(configuredProviders()).toEqual([])
    expect(resolveActiveModel("gemini-2.5-flash")).toBeNull()
  })

  it("picks OpenAI when only its key is set, even if a Gemini model is stored", () => {
    process.env.OPENAI_API_KEY = "sk-real-key"
    process.env.GOOGLE_AI_API_KEY = "AIza..."
    expect(resolveActiveModel("gemini-2.5-flash")).toEqual({
      model: "gpt-4o-mini",
      provider: "openai",
    })
  })

  it("honours AI_MODEL_OPENAI", () => {
    process.env.OPENAI_API_KEY = "sk-real-key"
    process.env.AI_MODEL_OPENAI = "gpt-5-mini"
    expect(resolveActiveModel()).toEqual({ model: "gpt-5-mini", provider: "openai" })
  })

  it("honours the stored model when its provider is keyed", () => {
    process.env.OPENAI_API_KEY = "sk-real-key"
    process.env.ANTHROPIC_API_KEY = "sk-ant-real"
    expect(resolveActiveModel("claude-sonnet-5-5")).toEqual({
      model: "claude-sonnet-5-5",
      provider: "claude",
    })
  })

  it("uses AI_PROVIDER when the stored model's provider has no key", () => {
    process.env.OPENAI_API_KEY = "sk-real-key"
    process.env.GOOGLE_AI_API_KEY = "AIza-real"
    process.env.AI_PROVIDER = "google"
    expect(resolveActiveModel("claude-sonnet-5-5")).toEqual({
      model: "gemini-2.5-flash",
      provider: "gemini",
    })
  })

  it("falls back to priority order openai → anthropic → google", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-real"
    process.env.GOOGLE_AI_API_KEY = "AIza-real"
    process.env.AI_PROVIDER = "openai" // not keyed → ignored
    expect(resolveActiveModel()).toEqual({ model: "claude-sonnet-5-5", provider: "claude" })
  })
})
