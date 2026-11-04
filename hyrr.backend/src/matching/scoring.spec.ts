import { computeProfileStrength, isThinProfile, scoreJobForProfile } from "./scoring"

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
