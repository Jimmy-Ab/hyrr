import { INestApplicationContext, Logger } from "@nestjs/common"
import { IoAdapter } from "@nestjs/platform-socket.io"
import { createAdapter } from "@socket.io/redis-adapter"
import Redis from "ioredis"
import type { ServerOptions } from "socket.io"
import { redisOptions } from "../redis/redis-options"

const READY_TIMEOUT_MS = 3_000

/** Resolves true once the client is ready, false after `ms` (the client keeps reconnecting). */
export function waitForReady(client: Pick<Redis, "status" | "once" | "off">, ms = READY_TIMEOUT_MS) {
  if (client.status === "ready") return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const onReady = () => {
      clearTimeout(timer)
      resolve(true)
    }
    const timer = setTimeout(() => {
      client.off("ready", onReady)
      resolve(false)
    }, ms)
    client.once("ready", onReady)
  })
}

/**
 * The redis adapter fires `publish` without handling its promise. While Redis is down, drop the
 * cross-instance publish (local sockets were already served) instead of buffering it or raising
 * an unhandled rejection.
 */
export function guardPublish(client: Redis, onError: (err: any) => void): Redis {
  const publish = client.publish.bind(client) as (...args: any[]) => Promise<number>
  ;(client as any).publish = (...args: any[]) => {
    if (client.status !== "ready") return Promise.resolve(0)
    return publish(...args).catch((err: any) => {
      onError(err)
      return 0
    })
  }
  return client
}

/**
 * Socket.io adapter that fans out room emits across backend instances through Redis pub/sub
 * (`@socket.io/redis-adapter`). Used only when Redis is configured; otherwise the default
 * in-memory adapter serves a single instance.
 *
 * Redis trouble never takes sockets down: local delivery keeps working, cross-instance emits
 * are dropped while Redis is unreachable, and the clients reconnect (and resubscribe) by
 * themselves.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly log = new Logger(RedisIoAdapter.name)
  private adapterConstructor?: ReturnType<typeof createAdapter>
  private pubClient?: Redis
  private subClient?: Redis
  private lastErrorAt = 0

  constructor(app: INestApplicationContext) {
    super(app)
  }

  /** Creates the pub/sub clients; waits briefly for them but never fails boot. */
  async connectToRedis(): Promise<void> {
    const retryStrategy = (times: number) => Math.min(times * 500, 5_000)
    this.pubClient = guardPublish(
      new Redis(redisOptions({ retryStrategy, maxRetriesPerRequest: 2 })),
      (err) => this.logError("publish", err)
    )
    // The subscriber queues (re)subscriptions until connected and must never reject them.
    this.subClient = new Redis(redisOptions({ retryStrategy, maxRetriesPerRequest: null }))
    this.pubClient.on("error", (err) => this.logError("pub", err))
    this.subClient.on("error", (err) => this.logError("sub", err))

    const ready = await Promise.all([waitForReady(this.pubClient), waitForReady(this.subClient)])
    if (ready.every(Boolean)) this.log.log("Socket.io Redis adapter connected")
    else
      this.log.warn(
        "Redis not reachable yet: sockets work on this instance; cross-instance fan-out resumes on reconnect"
      )

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient, {
      key: "hyrr:io",
      // fetchSockets() across instances (e.g. "is the user viewing this thread?") waits at most this long.
      requestsTimeout: 2_000,
    })
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options)
    if (this.adapterConstructor) server.adapter(this.adapterConstructor)
    return server
  }

  async dispose(): Promise<void> {
    await super.dispose?.()
    await Promise.all(
      [this.pubClient, this.subClient].map((c) => c?.quit().catch(() => c?.disconnect()))
    )
  }

  /** At most one log line per client kind every 30 s while Redis is failing. */
  private logError(kind: string, err: any) {
    const now = Date.now()
    if (now - this.lastErrorAt < 30_000) return
    this.lastErrorAt = now
    this.log.warn(`Socket.io Redis ${kind} client error: ${err?.message || err}`)
  }
}
