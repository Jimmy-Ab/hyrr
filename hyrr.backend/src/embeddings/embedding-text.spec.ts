import {
  contentHash,
  cosineSimilarity,
  jobEmbeddingText,
  MAX_EMBEDDING_CHARS,
  profileEmbeddingText,
} from "./embedding-text"

describe("embedding text", () => {
  it("builds job text from title, skills, requirements and stripped description", () => {
    const text = jobEmbeddingText({
      title: " React  Developer ",
      skills: ["React", " ", "TypeScript"],
      requirements: ["3+ years"],
      description: "<p>Build <b>great</b> UIs</p><script>x()</script>",
    })
    expect(text).toBe(
      "Title: React Developer\nSkills: React, TypeScript\nRequirements: 3+ years\nDescription: Build great UIs"
    )
  })

  it("builds profile text and omits empty sections", () => {
    const text = profileEmbeddingText({
      title: "Designer",
      bio: null,
      skills: ["Figma"],
      experiences: [{ role: "UI Designer", company: "Acme", desc: null }],
      educations: [{ degree: "BA", school: "UdK" }],
    })
    expect(text).toBe(
      "Title: Designer\nSkills: Figma\nExperience: UI Designer at Acme\nEducation: BA, UdK"
    )
    expect(profileEmbeddingText({})).toBe("")
  })

  it("truncates long text", () => {
    const text = jobEmbeddingText({ title: "x", description: "word ".repeat(5000) })
    expect(text.length).toBe(MAX_EMBEDDING_CHARS)
  })

  it("hashes deterministically", () => {
    expect(contentHash("a")).toBe(contentHash("a"))
    expect(contentHash("a")).not.toBe(contentHash("b"))
    expect(contentHash("a")).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("cosineSimilarity", () => {
  it("is 1 for parallel vectors and clamps negatives to 0", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(0)
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2)
  })

  it("returns null for mismatched or zero vectors", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBeNull()
    expect(cosineSimilarity([], [])).toBeNull()
    expect(cosineSimilarity([0, 0], [1, 1])).toBeNull()
  })
})
