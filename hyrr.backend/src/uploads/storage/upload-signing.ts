import { createHmac, timingSafeEqual } from "crypto"
import { jwtSecret } from "../../auth/jwt.config"

/** HMAC-signed, expiring tokens for `/api/uploads/<file>?token=` links (local driver + API route). */

function signature(value: string) {
  return createHmac("sha256", process.env.UPLOAD_URL_SECRET || jwtSecret())
    .update(value)
    .digest("base64url")
}

export function createUploadToken(filename: string, expiresInMs = 15 * 60 * 1000): string {
  const payload = `${filename}:${Date.now() + expiresInMs}`
  return `${Buffer.from(payload).toString("base64url")}.${signature(payload)}`
}

export function verifyUploadToken(filename: string, token?: string): boolean {
  if (!token) return false
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return false
  const payload = Buffer.from(encoded, "base64url").toString()
  const separator = payload.lastIndexOf(":")
  if (separator < 0) return false
  const tokenFilename = payload.slice(0, separator)
  const expiry = payload.slice(separator + 1)
  const expected = signature(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return false
  return tokenFilename === filename && Number(expiry) > Date.now()
}

/** `${PUBLIC_API_URL}` without trailing slash (defaults to http://localhost:<PORT>). */
export function publicApiBaseUrl(): string {
  return (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(
    /\/+$/,
    ""
  )
}

/** Permanent API URL of an upload, without token. */
export function uploadApiUrl(filename: string): string {
  return `${publicApiBaseUrl()}/api/uploads/${encodeURIComponent(filename)}`
}
