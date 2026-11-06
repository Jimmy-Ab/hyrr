import { HealthController } from "./health.controller"
import { HealthService } from "./health.service"

describe("HealthController", () => {
  const saved = { ...process.env }
  let prisma: any
  let cache: any
  let res: any
  let controller: HealthController

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) }
    cache = { client: { ping: jest.fn().mockResolvedValue("PONG") } }
    res = { setHeader: jest.fn(), status: jest.fn() }
    controller = new HealthController(new HealthService(prisma, cache))
  })
  afterEach(() => (process.env = { ...saved }))

  it("liveness never touches dependencies", () => {
    expect(controller.live()).toEqual({ status: "ok", uptime: expect.any(Number) })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it("ready: db ok, redis/queues/search disabled when not configured", async () => {
    delete process.env.REDIS_HOST
    expect(await controller.ready(res)).toEqual({
      status: "ok",
      db: "ok",
      redis: "disabled",
      queues: "disabled",
      search: "disabled",
    })
    expect(res.status).not.toHaveBeenCalled()
  })

  it("ready: pings redis when configured", async () => {
    process.env.REDIS_HOST = "redis"
    expect(await controller.ready(res)).toMatchObject({ status: "ok", db: "ok", redis: "ok" })
    expect(cache.client.ping).toHaveBeenCalled()
  })

  it("ready: 503 with the failing part", async () => {
    process.env.REDIS_HOST = "redis"
    prisma.$queryRaw.mockRejectedValue(new Error("down"))
    expect(await controller.ready(res)).toMatchObject({ status: "error", db: "error", redis: "ok" })
    expect(res.status).toHaveBeenCalledWith(503)
    cache.client.ping.mockRejectedValue(new Error("down"))
    prisma.$queryRaw.mockResolvedValue([])
    expect(await controller.ready(res)).toMatchObject({ db: "ok", redis: "error" })
  })

  it("ready: reports the queue driver, failed counts and search state", async () => {
    delete process.env.REDIS_HOST
    const queue = {
      status: jest.fn().mockResolvedValue({
        driver: "bullmq",
        queues: { email: { waiting: 2, failed: 1 }, alerts: { waiting: 0, failed: 0 }, search: {} },
      }),
    }
    const search: any = { health: jest.fn().mockResolvedValue("ok") }
    const service = new HealthService(prisma, cache, search, queue as any)
    expect(await service.readiness()).toEqual({
      status: "ok",
      db: "ok",
      redis: "disabled",
      queues: "bullmq",
      failedJobs: { email: 1, alerts: 0 },
      search: "ok",
    })
  })

  it("ready: queue and search failures are informational and never fail readiness", async () => {
    delete process.env.REDIS_HOST
    const queue = { status: jest.fn().mockRejectedValue(new Error("redis down")) }
    const search: any = { health: jest.fn().mockRejectedValue(new Error("boom")) }
    const service = new HealthService(prisma, cache, search, queue as any)
    expect(await service.readiness()).toEqual({
      status: "ok",
      db: "ok",
      redis: "disabled",
      queues: "error",
      search: "error",
    })
  })

  it("ready: accepts a synchronous inline queue status", async () => {
    const queue = { status: () => ({ driver: "inline" as const, queues: {} }) }
    const service = new HealthService(prisma, cache, undefined, queue as any)
    expect(await service.readiness()).toMatchObject({ queues: "inline" })
    expect(await service.readiness()).not.toHaveProperty("failedJobs")
  })
})
