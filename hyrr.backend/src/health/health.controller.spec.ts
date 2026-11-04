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

  it("ready: db ok, redis disabled when REDIS_HOST is unset", async () => {
    delete process.env.REDIS_HOST
    expect(await controller.ready(res)).toEqual({ status: "ok", db: "ok", redis: "disabled" })
    expect(res.status).not.toHaveBeenCalled()
  })

  it("ready: pings redis when configured", async () => {
    process.env.REDIS_HOST = "redis"
    expect(await controller.ready(res)).toEqual({ status: "ok", db: "ok", redis: "ok" })
    expect(cache.client.ping).toHaveBeenCalled()
  })

  it("ready: 503 with the failing part", async () => {
    process.env.REDIS_HOST = "redis"
    prisma.$queryRaw.mockRejectedValue(new Error("down"))
    expect(await controller.ready(res)).toEqual({ status: "error", db: "error", redis: "ok" })
    expect(res.status).toHaveBeenCalledWith(503)
    cache.client.ping.mockRejectedValue(new Error("down"))
    prisma.$queryRaw.mockResolvedValue([])
    expect(await controller.ready(res)).toMatchObject({ db: "ok", redis: "error" })
  })
})
