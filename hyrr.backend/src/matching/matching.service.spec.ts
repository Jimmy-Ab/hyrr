import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { MatchingService } from "./matching.service"

const baseJob = {
  description: "",
  requirements: [],
  location: "Berlin",
  remote: false,
  type: "FULL_TIME",
  categoryId: "cat-1",
  company: { id: "co-1", name: "Acme" },
  category: { id: "cat-1", name: "Software" },
}

describe("MatchingService", () => {
  let prisma: any
  let cache: any
  let service: MatchingService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), delByPattern: jest.fn() }
    service = new MatchingService(prisma, cache)
    prisma.seekerProfile.findUnique.mockResolvedValue({
      title: "React Developer",
      location: "Berlin",
      skills: ["React", "TypeScript"],
      interests: [],
      experiences: [],
      educations: [],
    })
    prisma.job.findMany.mockResolvedValue([
      {
        ...baseJob,
        id: "applied",
        title: "React Developer",
        skills: ["React"],
        createdAt: new Date("2026-11-03"),
      },
      {
        ...baseJob,
        id: "saved",
        title: "React Developer",
        skills: ["React"],
        createdAt: new Date("2026-11-02"),
      },
      {
        ...baseJob,
        id: "good",
        title: "React Developer",
        skills: ["React", "TypeScript"],
        createdAt: new Date("2026-11-01"),
      },
      {
        ...baseJob,
        id: "weak",
        title: "Accountant",
        skills: ["Excel"],
        location: "Paris",
        createdAt: new Date("2026-11-04"),
      },
    ])
    prisma.application.findMany.mockResolvedValue([{ jobId: "applied" }, { jobId: "saved" }])
  })

  it("for-you: excludes applied/saved jobs and low scores, sorts by score, caches 5 min", async () => {
    const result = await service.getMatchedJobs("u1", "for-you", 50)
    expect(result.jobs.map((j: any) => j.id)).toEqual(["good"])
    expect(result.jobs[0].match.score).toBeGreaterThanOrEqual(40)
    expect(result.jobs[0].company).not.toHaveProperty("plan")
    expect(result.thinProfile).toBe(false)
    expect(typeof result.profileStrength).toBe("number")
    expect(prisma.job.findMany.mock.calls[0][0].where).toEqual({ status: "ACTIVE" })
    expect(prisma.application.findMany.mock.calls[0][0].where.userId).toBe("u1")
    expect(cache.set).toHaveBeenCalledWith("matching:u1:for-you:50", result, 300)
  })

  it("all: keeps every ACTIVE job in recency order, each with a match", async () => {
    const result = await service.getMatchedJobs("u1", "all", 50)
    expect(result.jobs.map((j: any) => j.id)).toEqual(["applied", "saved", "good", "weak"])
    expect(result.jobs.every((j: any) => typeof j.match.score === "number")).toBe(true)
    expect(prisma.application.findMany).not.toHaveBeenCalled()
  })

  it("flags thin profiles and serves cached results", async () => {
    prisma.seekerProfile.findUnique.mockResolvedValue(null)
    const result = await service.getMatchedJobs("u2", "for-you", 10)
    expect(result.thinProfile).toBe(true)
    expect(result.profileStrength).toBe(0)

    cache.get.mockResolvedValue({ cached: true })
    expect(await service.getMatchedJobs("u2", "for-you", 10)).toEqual({ cached: true })
  })

  it("invalidate drops every cached list of the user", async () => {
    await service.invalidate("u1")
    expect(cache.delByPattern).toHaveBeenCalledWith("matching:u1:*")
  })

  describe("with embeddings", () => {
    it("blends the similarity into the score and adds the reason", async () => {
      const embeddings = {
        similarities: jest.fn().mockResolvedValue(
          new Map([
            ["good", 0.9],
            ["weak", 0.95],
          ])
        ),
      }
      service = new MatchingService(prisma, cache, embeddings as any)
      const rule = await new MatchingService(prisma, cache).getMatchedJobs("u1", "all", 50)
      const ruleGood = rule.jobs.find((j: any) => j.id === "good")!.match.score

      const result = await service.getMatchedJobs("u1", "for-you", 50)
      expect(embeddings.similarities).toHaveBeenCalledWith("u1", ["good", "weak"])
      const good = result.jobs.find((j: any) => j.id === "good")!
      expect(good.match.score).toBe(Math.round(0.7 * ruleGood + 27))
      expect(good.match.reasons).toContain("Similar to your background")
      expect(good.match.reasons.length).toBeLessThanOrEqual(4)
      // A weak rule match lifted only by similarity still has to reach the 40 threshold.
      expect(result.jobs.map((j: any) => j.id)).toEqual(["good"])
    })

    it("falls back to rule scores when similarities fail", async () => {
      const embeddings = { similarities: jest.fn().mockRejectedValue(new Error("db down")) }
      service = new MatchingService(prisma, cache, embeddings as any)
      const blended = await service.getMatchedJobs("u1", "for-you", 50)
      const rule = await new MatchingService(prisma, cache).getMatchedJobs("u1", "for-you", 50)
      expect(blended.jobs.map((j: any) => j.match)).toEqual(rule.jobs.map((j: any) => j.match))
    })
  })
})
