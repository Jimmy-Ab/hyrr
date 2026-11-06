import * as fs from "fs"
import * as path from "path"
import {
  assertSafeKey,
  DEFAULT_DOWNLOAD_TTL_SECONDS,
  DownloadUrlOptions,
  StorageDriver,
} from "./storage.driver"
import { createUploadToken, uploadApiUrl } from "./upload-signing"

export function resolveUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"))
}

/** Files on the local disk (UPLOAD_DIR), served by GET /api/uploads/:filename with HMAC tokens. */
export class LocalStorageDriver implements StorageDriver {
  readonly kind = "local" as const

  constructor(readonly dir: string = resolveUploadDir()) {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true })
  }

  pathOf(key: string): string {
    return path.join(this.dir, assertSafeKey(key))
  }

  /** Synchronous existence check (cheap on local disk; used by UploadsService.parseUploadUrl). */
  existsSync(key: string): boolean {
    try {
      return fs.existsSync(this.pathOf(key))
    } catch {
      return false
    }
  }

  async put(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    await fs.promises.writeFile(this.pathOf(key), buffer, { flag: "wx" })
  }

  async getBuffer(key: string): Promise<Buffer> {
    return fs.promises.readFile(this.pathOf(key))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.pathOf(key))
      return true
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.pathOf(key))
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err
    }
  }

  async getDownloadUrl(key: string, opts: DownloadUrlOptions = {}): Promise<string> {
    const ttl = (opts.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS) * 1000
    const safe = assertSafeKey(key)
    return `${uploadApiUrl(safe)}?token=${createUploadToken(safe, ttl)}`
  }
}
