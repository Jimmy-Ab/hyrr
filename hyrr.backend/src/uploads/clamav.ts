import * as net from "net"

export type ScanResult = { infected: false } | { infected: true; signature: string }

export type ClamAvConfig = { host: string; port: number; timeoutMs?: number }

export function clamAvConfigFromEnv(): ClamAvConfig | null {
  const host = process.env.CLAMAV_HOST?.trim()
  if (!host) return null
  return {
    host,
    port: Number(process.env.CLAMAV_PORT || 3310),
    timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS || 15_000),
  }
}

const CHUNK = 64 * 1024

/**
 * Scans a buffer with clamd's INSTREAM command. Resolves with the verdict; rejects when clamd is
 * unreachable, times out, or answers with an error (caller decides whether to fail open).
 */
export function scanBuffer(buffer: Buffer, config: ClamAvConfig): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.host, port: config.port })
    const chunks: Buffer[] = []
    let settled = false
    const finish = (err: Error | null, result?: ScanResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (err) reject(err)
      else resolve(result!)
    }
    socket.setTimeout(config.timeoutMs ?? 15_000, () => finish(new Error("ClamAV scan timed out")))
    socket.on("error", (err) => finish(err))
    socket.on("data", (data) => chunks.push(data))
    socket.on("end", () => {
      const reply = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim()
      // "stream: OK" | "stream: Eicar-Test-Signature FOUND" | "INSTREAM size limit exceeded. ERROR"
      if (/:\s*OK$/.test(reply)) return finish(null, { infected: false })
      const found = /:\s*(.+)\s+FOUND$/.exec(reply)
      if (found) return finish(null, { infected: true, signature: found[1] })
      finish(new Error(`ClamAV error: ${reply || "empty reply"}`))
    })
    socket.on("connect", () => {
      socket.write("zINSTREAM\0")
      for (let offset = 0; offset < buffer.length; offset += CHUNK) {
        const part = buffer.subarray(offset, offset + CHUNK)
        const size = Buffer.alloc(4)
        size.writeUInt32BE(part.length, 0)
        socket.write(size)
        socket.write(part)
      }
      socket.write(Buffer.alloc(4)) // zero-length chunk terminates the stream
    })
  })
}
