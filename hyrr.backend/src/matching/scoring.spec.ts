import {
  blendMatch,
  blendScore,
  computeProfileStrength,
  isThinProfile,
  scoreJobForProfile,
  SIMILARITY_REASON,
} from "./scoring"

const job = {
  title: "Senior Frontend Developer",
  description: "Build our web app",
  requirements: ["3+ years React"],
  skills: ["React", "TypeScript", "Node.js", "GraphQL"],
  location: "Berlin, Germany",
  remote: false,
  type: "FULL_TIME" as const,
  categoryId: "cat-sw",
}

describe("scoreJobForProfile", () => {
  it("rewards skills overlap (case/punctuation-insensitive) and explains it", () => {
    const none = scoreJobForProfile(job, { skills: ["Excel"] })
    const some = scoreJobForProfile(job, { skills: ["react", "NodeJS"] })
    const all = scoreJobForProfile(job, { skills: ["React", "TypeScript", "node.js", "GraphQL"] })
    expect(none.score).toBe(0)
    expect(some.score).toBeGreaterThan(0)
    expect(all.score).toBeGreaterThan(some.score)
    expect(all.score).toBe(40)
    expect(some.reasons[0]).toMatch(/2 of 4 skills match: React, Node.js/)
  })

  it("uses the job text when the job has no structured skills", () => {
    const result = scoreJobForProfile(
      { ...job, skills: [], description: "We use React and Kubernetes" },
      { skills: ["React", "Kubernetes", "Go"] }
    )
    expect(result.score).toBeGreaterThan(20)
    expect(result.reasons[0]).toMatch(/React, Kubernetes/)
  })

  it("scores title, location, remote preference, type, category and experience", () => {
    const profile = {
      title: "Frontend Developer",
      location: "Berlin",
      skills: ["React", "TypeScript", "Node.js", "GraphQL"],
      preferredType: "Full Time",
      yearsOfExperience: "6",
      interests: [{ id: "cat-sw" }],
    }
    const result = scoreJobForProfile(job, profile)
    expect(result.score).toBe(100)
    expect(result.reasons.length).toBeLessThanOrEqual(4)
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringMatching(/title/i), expect.stringMatching(/Berlin/)])
    )
  })

  it("prefers remote jobs for seekers who want remote, and never matches another city", () => {
    const remoteSeeker = { skills: [], preferredType: "Remote", location: "Addis Ababa" }
    const onSite = scoreJobForProfile(job, remoteSeeker)
    const remote = scoreJobForProfile({ ...job, remote: true }, remoteSeeker)
    expect(onSite.score).toBe(0)
    expect(remote.score).toBe(25) // location 15 + type ("Remote" preference) 10
    expect(remote.reasons).toContain("Remote, as you prefer")
  })

  it("returns a low score for a thin profile", () => {
    expect(scoreJobForProfile(job, {}).score).toBe(0)
    expect(scoreJobForProfile(job, {}).reasons).toEqual([])
    expect(isThinProfile({ title: " ", skills: [] })).toBe(true)
    expect(isThinProfile({ title: "Dev" })).toBe(false)
    expect(isThinProfile(null)).toBe(true)
  })
})

describe("computeProfileStrength", () => {
  it("is 0 with everything missing (most important first)", () => {
    const result = computeProfileStrength(null)
    expect(result.profileStrength).toBe(0)
    expect(result.missing[0]).toBe("At least 3 skills")
    expect(result.missing).toHaveLength(10)
  })

  it("adds up to 100 for a complete profile", () => {
    const result = computeProfileStrength({
      title: "Dev",
      location: "Berlin",
      bio: "Hi",
      skills: ["a", "b", "c"],
      experiences: [{ role: "Dev" }],
      educations: [{}],
      languages: ["English"],
      interests: [{ id: "c" }],
      preferredType: "Full Time",
      yearsOfExperience: "3",
    })
    expect(result).toEqual({ profileStrength: 100, missing: [] })
  })

  it("counts partial progress", () => {
    const result = computeProfileStrength({ title: "Dev", skills: ["a", "b"] })
    expect(result.profileStrength).toBe(15)
    expect(result.missing).toContain("At least 3 skills")
  })
})

describe("blendScore / blendMatch", () => {
  it("returns the rule score unchanged without a similarity", () => {
    expect(blendScore(55)).toBe(55)
    expect(blendScore(55, null)).toBe(55)
    expect(blendScore(55, Number.NaN)).toBe(55)
  })

  it("blends 70% rule + 30% similarity and rounds", () => {
    expect(blendScore(50, 0.8)).toBe(59) // 35 + 24
    expect(blendScore(100, 1)).toBe(100)
    expect(blendScore(0, 0)).toBe(0)
    expect(blendScore(33, 0.41)).toBe(Math.round(0.7 * 33 + 0.3 * 41))
  })

  it("clamps the similarity to 0..1", () => {
    expect(blendScore(40, 1.5)).toBe(blendScore(40, 1))
    expect(blendScore(40, -0.2)).toBe(28)
  })

  it("adds the similarity reason from 0.5, keeping at most 4 reasons", () => {
    const rule = { score: 60, reasons: ["a", "b"] }
    expect(blendMatch(rule).reasons).toEqual(["a", "b"])
    expect(blendMatch(rule, 0.49)).toEqual({ score: 57, reasons: ["a", "b"] })
    expect(blendMatch(rule, 0.5)).toEqual({ score: 57, reasons: ["a", "b", SIMILARITY_REASON] })
    const full = blendMatch({ score: 80, reasons: ["a", "b", "c", "d"] }, 0.9)
    expect(full.reasons).toEqual(["a", "b", "c", SIMILARITY_REASON])
    expect(full.score).toBe(83)
  })
})
