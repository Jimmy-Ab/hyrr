import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { getAllowedOrigins, isAllowedOrigin, normalizeOrigin } from "../../core/config/origins"
import { SignupRole } from "../auth.service"
import { jwtSecret } from "../jwt.config"

export type OAuthState = { role: SignupRole; redirect: string }

const STATE_TTL_MS = 10 * 60 * 1000

/** Frontend to fall back to when no (valid) redirect origin was supplied. */
export function defaultRedirect(): string {
  const fallback = normalizeOrigin(process.env.FRONTEND_URL || "")
  return fallback || getAllowedOrigins()[0] || "http://localhost:5174"
}

/** Only allow-listed origins may receive tokens. */
export function resolveRedirect(candidate: unknown): string {
  if (typeof candidate === "string" && isAllowedOrigin(candidate)) {
    return normalizeOrigin(candidate) as string
  }
  return defaultRedirect()
}

export function resolveRole(candidate: unknown): SignupRole {
  return candidate === "RECRUITER" ? "RECRUITER" : "SEEKER"
}

function sign(value: string) {
  return createHmac("sha256", `oauth-state:${jwtSecret()}`).update(value).digest("base64url")
}

/** HMAC-signed, short-lived `state` value that carries role + redirect through the provider. */
export function encodeOAuthState(state: OAuthState): string {
  const body = Buffer.from(
    JSON.stringify({
      r: state.role,
      d: state.redirect,
      n: randomBytes(8).toString("base64url"),
      e: Date.now() + STATE_TTL_MS,
    })
  ).toString("base64url")
  return `${body}.${sign(body)}`
}

/** Returns the decoded state, or null if it is missing, tampered with, expired or not allow-listed. */
export function decodeOAuthState(raw: unknown): OAuthState | null {
  if (typeof raw !== "string") return null
  const [body, signature] = raw.split(".")
  if (!body || !signature) return null
  const expected = sign(body)
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString())
    if (typeof parsed.e !== "number" || parsed.e < Date.now()) return null
    if (!isAllowedOrigin(parsed.d)) return null
    return { role: resolveRole(parsed.r), redirect: normalizeOrigin(parsed.d) as string }
  } catch {
    return null
  }
}
