import { EventEmitter } from "events"
import { guardPublish, waitForReady } from "./redis-io.adapter"

describe("RedisIoAdapter helpers", () => {
  it("guardPublish drops publishes while Redis is not ready", async () => {
    const publish = jest.fn().mockResolvedValue(1)
    const client: any = { status: "reconnecting", publish }
    guardPublish(client, jest.fn())
    expect(await client.publish("ch", "msg")).toBe(0)
    expect(publish).not.toHaveBeenCalled()
    client.status = "ready"
    expect(await client.publish("ch", "msg")).toBe(1)
    expect(publish).toHaveBeenCalledWith("ch", "msg")
  })

  it("guardPublish never rejects (the adapter does not handle publish promises)", async () => {
    const onError = jest.fn()
    const client: any = { status: "ready", publish: jest.fn().mockRejectedValue(new Error("down")) }
    guardPublish(client, onError)
    await expect(client.publish("ch", "msg")).resolves.toBe(0)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "down" }))
  })

  it("waitForReady resolves true on ready and false after the timeout", async () => {
    const ready: any = Object.assign(new EventEmitter(), { status: "ready" })
    expect(await waitForReady(ready, 10)).toBe(true)

    const later: any = Object.assign(new EventEmitter(), { status: "connecting" })
    const pending = waitForReady(later, 1_000)
    later.emit("ready")
    expect(await pending).toBe(true)

    const never: any = Object.assign(new EventEmitter(), { status: "connecting" })
    expect(await waitForReady(never, 10)).toBe(false)
    expect(never.listenerCount("ready")).toBe(0)
  })
})
