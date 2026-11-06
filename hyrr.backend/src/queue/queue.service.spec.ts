import { QueueService } from "./queue.service"
import { queueDriverName, resolveOpts } from "./queue.types"

const flush = async (ms = 0) => {
  await jest.advanceTimersByTimeAsync(ms)
}

describe("QueueService (inline driver)", () => {
  const env = { ...process.env }
  let service: QueueService

  beforeEach(() => {
    jest.useFakeTimers()
    delete process.env.REDIS_HOST
    service = new QueueService()
  })
  afterEach(async () => {
    await service.onModuleDestroy()
    jest.useRealTimers()
    process.env = { ...env }
  })

  it("uses the inline driver without Redis and bullmq with it", () => {
    expect(queueDriverName()).toBe("inline")
    process.env.REDIS_HOST = "localhost"
    expect(queueDriverName()).toBe("bullmq")
    process.env.QUEUE_DRIVER = "inline"
    expect(queueDriverName()).toBe("inline")
  })

  it("runs a job in the background", async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    service.process("email", "send", handler)
    await service.add("email", "send", { to: "a@b.c" })
    expect(handler).not.toHaveBeenCalled() // never in the caller's tick
    await flush()
    expect(handler).toHaveBeenCalledWith({ to: "a@b.c" })
  })

  it("retries with backoff, then gives up and counts the failure", async () => {
    const handler = jest.fn().mockRejectedValue(new Error("smtp down"))
    service.process("email", "send", handler)
    await service.add("email", "send", {}, { attempts: 3, backoffMs: 1000 })
    await flush(60_000)
    expect(handler).toHaveBeenCalledTimes(3)
    const status = await service.status()
    expect(status.queues.email.failed).toBe(1)
  })

  it("succeeds on a later attempt", async () => {
    const handler = jest.fn().mockRejectedValueOnce(new Error("blip")).mockResolvedValue("ok")
    service.process("ai-scoring", "score-application", handler)
    await service.add(
      "ai-scoring",
      "score-application",
      { applicationId: "a1" },
      { attempts: 2, backoffMs: 10 }
    )
    await flush(1000)
    expect(handler).toHaveBeenCalledTimes(2)
    expect((await service.status()).queues["ai-scoring"].failed).toBe(0)
  })

  it("buffers jobs added before their handler registers", async () => {
    await service.add("alerts", "instant", { jobId: "j1" })
    await flush()
    const handler = jest.fn().mockResolvedValue(undefined)
    service.process("alerts", "instant", handler)
    await flush()
    expect(handler).toHaveBeenCalledWith({ jobId: "j1" })
  })

  it("dedupes pending jobs with the same jobId", async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    service.process("search", "index-job", handler)
    await service.add("search", "index-job", { jobId: "j1" }, { jobId: "index:j1", delayMs: 500 })
    await service.add("search", "index-job", { jobId: "j1" }, { jobId: "index:j1", delayMs: 500 })
    await flush(1000)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("defaults to 3 attempts", () => {
    expect(resolveOpts().attempts).toBe(3)
  })
})
