import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto"
import { jwtSecret } from "../../auth/jwt.config"

const VERSION = "v1"

/** 32-byte AES key derived (HKDF-SHA256) from TWO_FACTOR_ENCRYPTION_KEY, or the JWT secret. */
function key(): Buffer {
  const material = process.env.TWO_FACTOR_ENCRYPTION_KEY?.trim() || jwtSecret()
  return Buffer.from(hkdfSync("sha256", material, "hyrr-secret-box", "totp-secret", 32))
}

/** Encrypts a short secret with AES-256-GCM → `v1:<iv>:<tag>:<ciphertext>` (base64url parts). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv, tag, data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(":")
}

/** Returns the decrypted secret, or null when the value is malformed or was tampered with. */
export function decryptSecret(boxed: string | null | undefined): string | null {
  if (!boxed) return null
  const [version, iv, tag, data] = boxed.split(":")
  if (version !== VERSION || !iv || !tag || !data) return null
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}
