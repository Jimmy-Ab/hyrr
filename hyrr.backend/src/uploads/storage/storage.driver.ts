export const STORAGE_DRIVER = Symbol("STORAGE_DRIVER")

export type DownloadUrlOptions = {
  /** Lifetime of the link (default 15 min). */
  expiresInSeconds?: number
  /** Suggested download filename (Content-Disposition). */
  filename?: string
  contentType?: string
}

/** Where uploaded files live. Keys are flat, server-generated filenames (`<userId>_<uuid>.<ext>`). */
export interface StorageDriver {
  readonly kind: "local" | "s3"
  put(key: string, buffer: Buffer, contentType: string): Promise<void>
  getBuffer(key: string): Promise<Buffer>
  exists(key: string): Promise<boolean>
  /** Removes the object; a missing object is not an error. */
  delete(key: string): Promise<void>
  /** Short-lived URL the browser can open directly. */
  getDownloadUrl(key: string, opts?: DownloadUrlOptions): Promise<string>
}

export const DEFAULT_DOWNLOAD_TTL_SECONDS = 15 * 60

/** Rejects anything that is not a flat, non-hidden filename (path traversal guard). */
export function assertSafeKey(key: string): string {
  if (!key || key.startsWith(".") || /[/\\\0]/.test(key) || key.length > 200) {
    throw new Error(`Invalid storage key: ${JSON.stringify(key)}`)
  }
  return key
}
