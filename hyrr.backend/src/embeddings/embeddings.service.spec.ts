import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { contentHash, jobEmbeddingText, profileEmbeddingText } from "./embedding-text"
import { EmbeddingsService, embeddingsEnabled } from "./embeddings.service"

const embedQuery = jest.fn()
const ctorArgs: any[] = []
jest.mock("@langchain/openai", () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation((fields: any) => {
    ctorArgs.push(fields)
    return { embedQuery }
  }),
}))

const ENV_KEYS = ["OPENAI_API_KEY", "EMBEDDINGS_ENABLED", "EMBEDDINGS_MODEL", "OPENAI_BASE_URL"]
const job = {
  title: "React Developer",
  skills: ["React"],
  requirements: [],
  description: "<p>UI work</p>",
  status: "ACTIVE",
}

describe("EmbeddingsService", () => {
  let prisma: any
  let queue: any
  let cache: any
  let service: EmbeddingsService
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k]
    process.env.OPENAI_API_KEY = "sk-test-real-looking-key"
    delete process.env.EMBEDDINGS_ENABLED
    delete process.env.EMBEDDINGS_MODEL
    delete process.env.OPENAI_BASE_URL
    prisma = mockDeep<PrismaClient>()
    queue = { add: jest.fn().mockResolvedValue(undefined), process: jest.fn() }
    cache = { delByPattern: jest.fn() }
    service = new EmbeddingsService(prisma, queue, cache)
    embedQuery.mockReset().mockResolvedValue([0.1, 0.2, 0.3])
    ctorArgs.length = 0
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  describe("isEnabled", () => {
    it("needs a real OpenAI key and EMBEDDINGS_ENABLED not false", () => {
      expect(embeddingsEnabled()).toBe(true)
      process.env.EMBEDDINGS_ENABLED = "false"
      expect(service.isEnabled()).toBe(false)
      process.env.EMBEDDINGS_ENABLED = "true"
      process.env.OPENAI_API_KEY = "sk-..."
      expect(service.isEnabled()).toBe(false)
      process.env.OPENAI_API_KEY = ""
      expect(service.isEnabled()).toBe(false)
    })
  })

  it("registers both processors on the ai-scoring queue", () => {
    service.onModuleInit()
    expect(queue.process.mock.calls.map((c: any[]) => [c[0], c[1]])).toEqual([
      ["ai-scoring", "embed-job"],
      ["ai-scoring", "embed-profile"],
    ])
  })

  it("enqueues with dedupe ids, 2 s delay and 3 attempts; nothing when disabled", async () => {
    await service.embedJobSoon("j1")
    await service.embedProfileSoon("u1")
    expect(queue.add).toHaveBeenCalledWith(
      "ai-scoring",
      "embed-job",
      { jobId: "j1" },
      { jobId: "embed-job-j1", delayMs: 2000, attempts: 3 }
    )
    expect(queue.add).toHaveBeenCalledWith(
      "ai-scoring",
      "embed-profile",
      { userId: "u1" },
      { jobId: "embed-profile-u1", delayMs: 2000, attempts: 3 }
    )
    queue.add.mockClear()
    process.env.EMBEDDINGS_ENABLED = "false"
    await service.embedJobSoon("j1")
    await service.embedProfileSoon("u1")
    expect(queue.add).not.toHaveBeenCalled()
  })

  describe("embedJob", () => {
    it("embeds and upserts with model and content hash", async () => {
      prisma.job.findUnique.mockResolvedValue(job)
      prisma.embedding.findUnique.mockResolvedValue(null)
      expect(await service.embedJob("j1")).toBe("embedded")
      const text = jobEmbeddingText(job)
      expect(embedQuery).toHaveBeenCalledWith(text)
      expect(ctorArgs[0]).toMatchObject({ model: "text-embedding-3-small" })
      expect(ctorArgs[0].configuration).toBeUndefined()
      expect(prisma.embedding.upsert).toHaveBeenCalledWith({
        where: { kind_refId: { kind: "JOB", refId: "j1" } },
        create: {
          kind: "JOB",
          refId: "j1",
          model: "text-embedding-3-small",
          contentHash: contentHash(text),
          vector: [0.1, 0.2, 0.3],
        },
        update: {
          model: "text-embedding-3-small",
          contentHash: contentHash(text),
          vector: [0.1, 0.2, 0.3],
        },
      })
    })

    it("skips unchanged content, but re-embeds when the model changes", async () => {
      prisma.job.findUnique.mockResolvedValue(job)
      const hash = contentHash(jobEmbeddingText(job))
      prisma.embedding.findUnique.mockResolvedValue({
        model: "text-embedding-3-small",
        contentHash: hash,
      })
      expect(await service.embedJob("j1")).toBe("unchanged")
      expect(embedQuery).not.toHaveBeenCalled()
      expect(prisma.embedding.upsert).not.toHaveBeenCalled()

      process.env.EMBEDDINGS_MODEL = "text-embedding-3-large"
      expect(await service.embedJob("j1")).toBe("embedded")
      expect(ctorArgs.at(-1)).toMatchObject({ model: "text-embedding-3-large" })
    })

    it("uses OPENAI_BASE_URL when set (test hook)", async () => {
      process.env.OPENAI_BASE_URL = "http://localhost:9999/v1"
      prisma.job.findUnique.mockResolvedValue(job)
      prisma.embedding.findUnique.mockResolvedValue(null)
      await service.embedJob("j1")
      expect(ctorArgs[0].configuration).toEqual({ baseURL: "http://localhost:9999/v1" })
    })

    it("skips non-ACTIVE jobs and removes embeddings of deleted jobs", async () => {
      prisma.job.findUnique.mockResolvedValueOnce({ ...job, status: "DRAFT" })
      expect(await service.embedJob("j1")).toBe("skipped")
      prisma.job.findUnique.mockResolvedValueOnce(null)
      prisma.embedding.deleteMany.mockResolvedValue({ count: 1 })
      expect(await service.embedJob("j2")).toBe("removed")
      expect(prisma.embedding.deleteMany).toHaveBeenCalledWith({
        where: { kind: "JOB", refId: "j2" },
      })
      expect(embedQuery).not.toHaveBeenCalled()
    })

    it("rethrows provider errors so the queue retries", async () => {
      prisma.job.findUnique.mockResolvedValue(job)
      prisma.embedding.findUnique.mockResolvedValue(null)
      embedQuery.mockRejectedValue(new Error("429 quota"))
      await expect(service.embedJob("j1")).rejects.toThrow("429 quota")
      expect(prisma.embedding.upsert).not.toHaveBeenCalled()
    })

    it("does nothing when disabled", async () => {
      process.env.EMBEDDINGS_ENABLED = "false"
      expect(await service.embedJob("j1")).toBe("skipped")
      expect(prisma.job.findUnique).not.toHaveBeenCalled()
    })
  })

  describe("embedProfile", () => {
    const profile = {
      title: "Frontend Dev",
      bio: "I like UIs",
      skills: ["React"],
      experiences: [],
      educations: [],
    }

    it("embeds and invalidates the seeker's match cache", async () => {
      prisma.seekerProfile.findUnique.mockResolvedValue(profile)
      prisma.embedding.findUnique.mockResolvedValue(null)
      expect(await service.embedProfile("u1")).toBe("embedded")
      expect(prisma.embedding.upsert.mock.calls[0][0].create.kind).toBe("PROFILE")
      expect(cache.delByPattern).toHaveBeenCalledWith("matching:u1:*")
    })

    it("keeps the cache when nothing changed", async () => {
      prisma.seekerProfile.findUnique.mockResolvedValue(profile)
      prisma.embedding.findUnique.mockResolvedValue({
        model: "text-embedding-3-small",
        contentHash: contentHash(profileEmbeddingText(profile)),
      })
      expect(await service.embedProfile("u1")).toBe("unchanged")
      expect(cache.delByPattern).not.toHaveBeenCalled()
    })

    it("removes the embedding of an emptied profile", async () => {
      prisma.seekerProfile.findUnique.mockResolvedValue({
        title: "",
        bio: null,
        skills: [],
        experiences: [],
        educations: [],
      })
      prisma.embedding.deleteMany.mockResolvedValue({ count: 1 })
      expect(await service.embedProfile("u1")).toBe("removed")
      expect(embedQuery).not.toHaveBeenCalled()
      expect(cache.delByPattern).toHaveBeenCalledWith("matching:u1:*")
    })
  })

  describe("similarities", () => {
    it("is empty when disabled", async () => {
      process.env.OPENAI_API_KEY = ""
      expect((await service.similarities("u1", ["j1"])).size).toBe(0)
      expect(prisma.embedding.findUnique).not.toHaveBeenCalled()
    })

    it("is empty and queues a profile embed when the profile has none", async () => {
      prisma.embedding.findUnique.mockResolvedValue(null)
      expect((await service.similarities("u1", ["j1"])).size).toBe(0)
      expect(queue.add).toHaveBeenCalledWith(
        "ai-scoring",
        "embed-profile",
        { userId: "u1" },
        expect.objectContaining({ jobId: "embed-profile-u1" })
      )
    })

    it("computes cosine per job with a current-model embedding and caches job vectors", async () => {
      prisma.embedding.findUnique.mockResolvedValue({
        model: "text-embedding-3-small",
        vector: [1, 0],
      })
      prisma.embedding.findMany
        .mockResolvedValueOnce([
          { refId: "j1", contentHash: "h1" },
          { refId: "j2", contentHash: "h2" },
        ])
        .mockResolvedValueOnce([
          { refId: "j1", contentHash: "h1", vector: [1, 0] },
          { refId: "j2", contentHash: "h2", vector: [1, 1] },
        ])
      const sims = await service.similarities("u1", ["j1", "j2", "j3"])
      expect(sims.get("j1")).toBeCloseTo(1)
      expect(sims.get("j2")).toBeCloseTo(Math.SQRT1_2)
      expect(sims.has("j3")).toBe(false)
      expect(prisma.embedding.findMany.mock.calls[0][0].where).toEqual({
        kind: "JOB",
        model: "text-embedding-3-small",
        refId: { in: ["j1", "j2", "j3"] },
      })

      // Second call: hashes unchanged → vectors come from memory.
      prisma.embedding.findMany.mockResolvedValueOnce([
        { refId: "j1", contentHash: "h1" },
        { refId: "j2", contentHash: "h2" },
      ])
      const again = await service.similarities("u1", ["j1", "j2"])
      expect(again.get("j2")).toBeCloseTo(Math.SQRT1_2)
      expect(prisma.embedding.findMany).toHaveBeenCalledTimes(3)
    })

    it("ignores a profile vector from another model", async () => {
      prisma.embedding.findUnique.mockResolvedValue({ model: "old-model", vector: [1, 0] })
      expect((await service.similarities("u1", ["j1"])).size).toBe(0)
      expect(prisma.embedding.findMany).not.toHaveBeenCalled()
    })
  })

  describe("backfillSoon", () => {
    it("queues ACTIVE jobs missing a current-model embedding", async () => {
      prisma.job.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }])
      prisma.embedding.findMany.mockResolvedValue([{ refId: "b" }])
      expect(await service.backfillSoon()).toBe(2)
      expect(prisma.job.findMany.mock.calls[0][0].where).toEqual({ status: "ACTIVE" })
      expect(queue.add.mock.calls.map((c: any[]) => c[2])).toEqual([{ jobId: "a" }, { jobId: "c" }])
    })

    it("does nothing when disabled", async () => {
      process.env.EMBEDDINGS_ENABLED = "false"
      expect(await service.backfillSoon()).toBe(0)
      expect(prisma.job.findMany).not.toHaveBeenCalled()
    })
  })
})
