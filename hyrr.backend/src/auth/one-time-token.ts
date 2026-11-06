import { createHash, randomBytes, timingSafeEqual } from "crypto"

/** URL-safe random token (256 bits) handed to the user; only its hash is stored. */
export function newRawToken(): string {
  return randomBytes(32).toString("base64url")
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/** Constant-time comparison of two hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex")
  const right = Buffer.from(b, "hex")
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right)
}
