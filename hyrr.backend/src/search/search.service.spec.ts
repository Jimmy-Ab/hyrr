import { stripHtml, toJobDocument } from "./job-document"
import { SearchService } from "./search.service"

const jobRow = (over: any = {}) => ({
  id: "j1",
  title: "React Dev",
  description: "<p>Build <b>things</b> &amp; ship</p>",
  skills: ["React"],
  requirements: ["3y"],
  location: "Berlin",
  remote: true,
  type: "FULL_TIME",
  status: "ACTIVE",
  companyId: "co-1",
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  featuredUntil: null,
  company: { name: "Acme" },
  category: { slug: "eng", name: "Engineering" },
  ...over,
})

const fakeClient = () => ({
  health: jest.fn().mockResolvedValue(true),
  addDocuments: jest.fn().mockResolvedValue({ taskUid: 1 }),
  deleteDocument: jest.fn().mockResolvedValue({ taskUid: 2 }),
  search: jest.fn(),
  documentCount: jest.fn().mockResolvedValue(5),
  createIndex: jest.fn().mockResolvedValue({ taskUid: 3 }),
  updateSettings: jest.fn().mockResolvedValue({ taskUid: 4 }),
  waitForTask: jest.fn().mockResolvedValue({ status: "succeeded" }),
})

describe("job documents", () => {
  it("strips HTML, converts dates to epoch seconds and flattens relations", () => {
    expect(stripHtml("<p>a</p><script>x()</script>b&nbsp;c")).toBe("a b c")
    expect(toJobDocument(jobRow() as any)).toEqual({
      id: "j1",
      title: "React Dev",
      description: "Build things & ship",
      skills: ["React"],
      requirements: ["3y"],
      location: "Berlin",
      remote: true,
      type: "FULL_TIME",
      categorySlug: "eng",
      categoryName: "Engineering",
      companyName: "Acme",
      companyId: "co-1",
      publishedAtTs: 1767225600,
      featuredUntilTs: 0,
    })
  })

  it("truncates long descriptions", () => {
    const doc = toJobDocument(jobRow({ description: "x".repeat(9000) }) as any)
    expect(doc.description).toHaveLength(5000)
  })
})

describe("SearchService", () => {
  const env = process.env.MEILI_HOST
  afterEach(() => {
    if (env === undefined) delete process.env.MEILI_HOST
    else process.env.MEILI_HOST = env
    jest.useRealTimers()
  })

  it("is disabled without MEILI_HOST: no queue work, null search, health 'disabled'", async () => {
    delete process.env.MEILI_HOST
    const queue = { add: jest.fn(), process: jest.fn() }
    const service = new SearchService({} as any, queue as any)
    expect(service.isEnabled()).toBe(false)
    service.indexJobSoon("j1")
    expect(queue.add).not.toHaveBeenCalled()
    await expect(service.searchJobs({ q: "x", limit: 10, offset: 0 })).resolves.toBeNull()
    await expect(service.health()).resolves.toBe("disabled")
  })

  it("registers the processor and enqueues debounced, deduped index jobs", () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined), process: jest.fn() }
    const client = fakeClient()
    const service = new SearchService({} as any, queue as any, client as any)
    service.onModuleInit()
    expect(queue.process).toHaveBeenCalledWith("search", "index-job", expect.any(Function))
    service.indexJobSoon("j1")
    service.removeJobSoon("j2")
    expect(queue.add).toHaveBeenNthCalledWith(
      1,
      "search",
      "index-job",
      { jobId: "j1" },
      expect.objectContaining({ jobId: "search-j1", delayMs: 500 })
    )
    expect(queue.add).toHaveBeenNthCalledWith(
      2,
      "search",
      "index-job",
      { jobId: "j2" },
      expect.objectContaining({ jobId: "search-j2" })
    )
  })

  it("processor upserts ACTIVE jobs and deletes everything else", async () => {
    const prisma: any = { job: { findFirst: jest.fn() } }
    const client = fakeClient()
    const service = new SearchService(prisma, undefined, client as any)
    prisma.job.findFirst.mockResolvedValueOnce(jobRow())
    await expect(service.syncJob("j1")).resolves.toBe("indexed")
    expect(client.addDocuments).toHaveBeenCalledWith("jobs", [
      expect.objectContaining({ id: "j1", companyName: "Acme" }),
    ])
    prisma.job.findFirst.mockResolvedValueOnce(null) // CLOSED: excluded by PUBLIC_JOB_WHERE
    await expect(service.syncJob("j1")).resolves.toBe("removed")
    prisma.job.findFirst.mockResolvedValueOnce(null)
    await expect(service.syncJob("gone")).resolves.toBe("removed")
    expect(client.deleteDocument).toHaveBeenLastCalledWith("jobs", "gone")
  })

  it("processor errors propagate so the queue retries", async () => {
    const prisma: any = { job: { findFirst: jest.fn().mockResolvedValue(jobRow()) } }
    const client = fakeClient()
    client.addDocuments.mockRejectedValue(new Error("down"))
    const service = new SearchService(prisma, undefined, client as any)
    await expect(service.syncJob("j1")).rejects.toThrow("down")
  })

  it("searches featured first, then the rest, with escaped filters and a combined total", async () => {
    const client = fakeClient()
    client.search
      .mockResolvedValueOnce({ hits: [{ id: "f1" }], estimatedTotalHits: 1 })
      .mockResolvedValueOnce({ hits: [{ id: "a" }, { id: "b" }], estimatedTotalHits: 7 })
    const service = new SearchService({} as any, undefined, client as any)
    const res = await service.searchJobs({
      q: " react ",
      type: "FULL_TIME" as any,
      categorySlug: 'en"g',
      remote: true,
      limit: 3,
      offset: 0,
    })
    expect(res).toEqual({ ids: ["f1", "a", "b"], total: 8 })
    const [first, second] = client.search.mock.calls.map((c: any) => c[1])
    expect(first).toMatchObject({ q: "react", limit: 3, offset: 0, attributesToRetrieve: ["id"] })
    expect(first.filter).toEqual([
      'type = "FULL_TIME"',
      "remote = true",
      'categorySlug = "en\\"g"',
      expect.stringMatching(/^featuredUntilTs > \d+$/),
    ])
    expect(second).toMatchObject({ limit: 2, offset: 0 })
    expect(second.filter[3]).toMatch(/^featuredUntilTs <= \d+$/)
  })

  it("pages past the featured block", async () => {
    const client = fakeClient()
    client.search
      .mockResolvedValueOnce({ hits: [], estimatedTotalHits: 2 })
      .mockResolvedValueOnce({ hits: [{ id: "c" }], estimatedTotalHits: 10 })
    const service = new SearchService({} as any, undefined, client as any)
    const res = await service.searchJobs({ q: "x", limit: 5, offset: 5 })
    expect(res).toEqual({ ids: ["c"], total: 12 })
    expect(client.search.mock.calls[1][1]).toMatchObject({ limit: 5, offset: 3 })
  })

  it("returns null when Meili fails so the caller falls back", async () => {
    const client = fakeClient()
    client.search.mockRejectedValue(new Error("ECONNREFUSED"))
    const service = new SearchService({} as any, undefined, client as any)
    await expect(service.searchJobs({ q: "x", limit: 5, offset: 0 })).resolves.toBeNull()
    client.health.mockRejectedValue(new Error("down"))
    await expect(service.health()).resolves.toBe("error")
  })

  it("boot creates the index, applies settings and reindexes when empty", async () => {
    const prisma: any = {
      job: { findMany: jest.fn().mockResolvedValueOnce([jobRow(), jobRow({ id: "j2" })]) },
    }
    const client = fakeClient()
    client.documentCount.mockResolvedValue(null)
    const service = new SearchService(prisma, undefined, client as any)
    service.onModuleInit()
    await service.ready()
    expect(client.createIndex).toHaveBeenCalledWith("jobs", "id")
    expect(client.updateSettings).toHaveBeenCalledWith(
      "jobs",
      expect.objectContaining({
        searchableAttributes: [
          "title",
          "skills",
          "companyName",
          "categoryName",
          "location",
          "requirements",
          "description",
        ],
      })
    )
    expect(client.waitForTask).toHaveBeenCalledWith(4)
    // Only publicly visible jobs: ACTIVE and the company not suspended.
    expect(prisma.job.findMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      company: { status: { not: "SUSPENDED" } },
    })
    expect(client.addDocuments.mock.calls[0][1]).toHaveLength(2)
  })

  it("boot skips the reindex when the index has documents and survives Meili being down", async () => {
    const prisma: any = { job: { findMany: jest.fn() } }
    const client = fakeClient()
    const service = new SearchService(prisma, undefined, client as any)
    service.onModuleInit()
    await service.ready()
    expect(prisma.job.findMany).not.toHaveBeenCalled()

    const down = fakeClient()
    down.documentCount.mockRejectedValue(new Error("ECONNREFUSED"))
    const service2 = new SearchService(prisma, undefined, down as any)
    service2.onModuleInit()
    await expect(service2.ready()).resolves.toBeUndefined()
  })

  it("without a queue, indexing runs in-process after the debounce", async () => {
    jest.useFakeTimers()
    const prisma: any = { job: { findFirst: jest.fn().mockResolvedValue(null) } }
    const client = fakeClient()
    const service = new SearchService(prisma, undefined, client as any)
    service.indexJobSoon("j9")
    expect(prisma.job.findFirst).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(500)
    expect(client.deleteDocument).toHaveBeenCalledWith("jobs", "j9")
  })
})
