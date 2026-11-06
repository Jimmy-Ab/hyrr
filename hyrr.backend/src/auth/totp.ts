import { createHmac, randomBytes, timingSafeEqual } from "crypto"

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s) with RFC 4648 base32 secrets — the parameters every
 * authenticator app supports. Implemented on node:crypto because otplib v13 pulls in ESM-only
 * dependencies that the CommonJS/Jest toolchain cannot load.
 */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const STEP_SECONDS = 30
const DIGITS = 6

export function base32Encode(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = BASE32.indexOf(char)
    if (index < 0) throw new Error("Invalid base32 character")
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** 160-bit secret, base32 encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

function hotp(key: Buffer, counter: number): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac("sha1", key).update(message).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = digest.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0")
}

export function generateTotp(secret: string, at = Date.now()): string {
  return hotp(base32Decode(secret), Math.floor(at / 1000 / STEP_SECONDS))
}

/** Accepts the current code and the neighbouring steps (±`window` × 30 s) for clock drift. */
export function verifyTotp(secret: string, token: string, at = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false
  let key: Buffer
  try {
    key = base32Decode(secret)
  } catch {
    return false
  }
  if (!key.length) return false
  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  let ok = false
  for (let i = -window; i <= window; i++) {
    const expected = hotp(key, counter + i)
    // Check every step (no early exit) and compare in constant time.
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(token))) ok = true
  }
  return ok
}

export function totpUri(input: { issuer: string; label: string; secret: string }): string {
  const issuer = encodeURIComponent(input.issuer)
  const label = `${issuer}:${encodeURIComponent(input.label)}`
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
