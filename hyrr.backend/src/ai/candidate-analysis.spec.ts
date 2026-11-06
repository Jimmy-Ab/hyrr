import { BaseLLMAdapter } from "./adapters/base.adapter"
import { buildCandidatePrompt, normalizeAnalysis, stripHtml } from "./candidate-analysis"

const good = {
  score: 82,
  recommendation: "STRONG_FIT",
  summary: "Solid TypeScript background.",
  matchedSkills: ["TypeScript", "Node.js"],
  missingSkills: ["Kubernetes"],
  strengths: ["5 years backend"],
  concerns: ["No cloud certs"],
  experienceFit: "Senior level matches the role.",
}

class FakeAdapter extends BaseLLMAdapter {
  constructor(private fake: any) {
    super()
  }
  protected createModel() {
    return this.fake
  }
}

describe("candidate analysis parsing", () => {
  it("normalizes loose model output into the bounded schema", () => {
    const result = normalizeAnalysis({
      score: "104.6",
      recommendation: "possible fit",
      summary: "x".repeat(2000),
      matchedSkills: Array.from({ length: 15 }, (_, i) => `skill ${i}`),
      missingSkills: "Go, Rust",
      strengths: [],
      concerns: null,
      experienceFit: "y".repeat(500),
    })
    expect(result.score).toBe(100)
    expect(result.recommendation).toBe("POSSIBLE_FIT")
    expect(result.summary.length).toBeLessThanOrEqual(1200)
    expect(result.matchedSkills).toHaveLength(10)
    expect(result.missingSkills).toEqual(["Go", "Rust"])
    expect(result.concerns).toEqual([])
    expect(result.experienceFit.length).toBeLessThanOrEqual(300)
  })

  it("derives the recommendation from the score when missing", () => {
    expect(normalizeAnalysis({ ...good, score: 30, recommendation: undefined }).recommendation).toBe(
      "NOT_A_FIT"
    )
  })

  it("rejects output without a numeric score", () => {
    expect(() => normalizeAnalysis({ ...good, score: "n/a" })).toThrow()
  })

  it("uses native structured output when available", async () => {
    const invoke = jest.fn().mockResolvedValue(good)
    const fake = { withStructuredOutput: jest.fn(() => ({ invoke })), invoke: jest.fn() }
    const result = await new FakeAdapter(fake).analyzeCandidate("m", "sys", 0.2, "prompt")
    expect(fake.withStructuredOutput).toHaveBeenCalledWith(expect.anything(), {
      name: "candidate_match",
    })
    expect(fake.invoke).not.toHaveBeenCalled()
    expect(result).toEqual(good)
  })

  it("falls back to plain JSON parsing when structured output fails", async () => {
    const fake = {
      withStructuredOutput: jest.fn(() => ({
        invoke: jest.fn().mockRejectedValue(new Error("tool calling not supported")),
      })),
      invoke: jest
        .fn()
        .mockResolvedValue({ content: "```json\n" + JSON.stringify(good) + "\n```" }),
    }
    const result = await new FakeAdapter(fake).analyzeCandidate("m", "sys", 0.2, "prompt")
    expect(fake.invoke).toHaveBeenCalledTimes(1)
    expect(result.score).toBe(82)
    expect(result.matchedSkills).toEqual(["TypeScript", "Node.js"])
  })

  it("does not fall back on auth errors", async () => {
    const fake = {
      withStructuredOutput: jest.fn(() => ({
        invoke: jest.fn().mockRejectedValue(Object.assign(new Error("bad key"), { status: 401 })),
      })),
      invoke: jest.fn(),
    }
    await expect(
      new FakeAdapter(fake).analyzeCandidate("m", "sys", 0.2, "prompt")
    ).rejects.toThrow("bad key")
    expect(fake.invoke).not.toHaveBeenCalled()
  })
})

describe("buildCandidatePrompt", () => {
  it("strips HTML and includes job, profile, screening and CV sections", () => {
    const prompt = buildCandidatePrompt({
      job: {
        title: "Backend Engineer",
        description: "<p>Build <b>APIs</b></p><ul><li>Node</li></ul><script>x()</script>",
        requirements: ["3+ years"],
        skills: ["TypeScript"],
        type: "FULL_TIME",
        location: "Berlin",
        remote: true,
        category: "Software",
      },
      candidate: {
        applicationTitle: "Engineer",
        profile: {
          title: "Senior Dev",
          skills: ["TypeScript"],
          languages: ["English"],
          experiences: [{ role: "Dev", company: "Acme", duration: "2y", desc: "APIs" }],
          educations: [{ school: "TU", degree: "BSc", duration: "3y" }],
        },
        coverLetter: "Hello",
        screening: [{ question: "Visa?", answer: "Yes" }],
      },
      cvText: "CV BODY",
    })
    expect(prompt).toContain("Build APIs")
    expect(prompt).not.toContain("<p>")
    expect(prompt).not.toContain("x()")
    expect(prompt).toContain("Category: Software")
    expect(prompt).toContain("Dev at Acme")
    expect(prompt).toContain("Q: Visa?\nA: Yes")
    expect(prompt).toContain("=== CV ===\nCV BODY")
  })

  it("stripHtml decodes entities and keeps list structure", () => {
    expect(stripHtml("<ul><li>A &amp; B</li><li>C</li></ul>")).toBe("- A & B\n- C")
  })
})
