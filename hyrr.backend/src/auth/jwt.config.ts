import { Logger, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { UserStatus } from "@prisma/client"

/** Placeholder value committed in .env.example — never acceptable outside local development. */
export const JWT_SECRET_PLACEHOLDER = "your_super_secret_jwt_key_here_min_32_chars"
const DEV_FALLBACK_SECRET = "hyrr_local_development_secret_change_me"
const MIN_SECRET_LENGTH = 32

let warned = false

/** Returns a description of what is wrong with the secret, or null when it is acceptable. */
export function jwtSecretProblem(secret: string | undefined): string | null {
  if (!secret) return "JWT_SECRET is not set"
  if (secret === JWT_SECRET_PLACEHOLDER) return "JWT_SECRET still uses the .env.example placeholder"
  if (secret.length < MIN_SECRET_LENGTH)
    return `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`
  return null
}

/**
 * Resolves the JWT signing secret.
 * Production refuses to start with a missing, short or placeholder secret; development falls back
 * to a well-known local secret with a loud warning.
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  const problem = jwtSecretProblem(secret)
  if (!problem) return secret as string
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${problem}. Refusing to start in production.`)
  }
  if (!warned) {
    warned = true
    new Logger("JwtConfig").warn(
      `${problem} — using an insecure development secret. Never deploy like this.`
    )
  }
  return secret || DEV_FALLBACK_SECRET
}

export type AccessTokenPayload = {
  sub: string
  role: string
  email: string
  companyId?: string | null
  /** Token version: must equal User.tokenVersion (bumped on password reset/change). */
  tv?: number
  type?: string
}

/** Tokens issued before tokenVersion existed carry no `tv`; they count as version 0. */
export function tokenVersionMatches(payload: { tv?: unknown }, current: number): boolean {
  const tv = payload?.tv === undefined ? 0 : payload.tv
  return typeof tv === "number" && tv === current
}

/**
 * Throws unless the payload is an access token. Every other token kind carries a `type`
 * (`refresh`, `mfa`), so anything typed is refused here.
 */
export function assertAccessPayload<T extends { sub?: string; type?: string }>(payload: T): T {
  if (!payload || !payload.sub || payload.type !== undefined) {
    throw new UnauthorizedException("Invalid access token")
  }
  return payload
}

/**
 * Verifies an ACCESS token (signature + expiry) and rejects refresh tokens.
 * Use this anywhere a bearer token is accepted outside the passport JwtStrategy (e.g. sockets).
 */
export function verifyAccessToken(jwt: JwtService, token: string): AccessTokenPayload {
  let payload: AccessTokenPayload
  try {
    payload = jwt.verify<AccessTokenPayload>(token, { secret: jwtSecret() })
  } catch {
    throw new UnauthorizedException("Invalid access token")
  }
  return assertAccessPayload(payload)
}

type SessionLookup = {
  user: {
    findUnique(args: {
      where: { id: string }
      select: { status: true; tokenVersion: true }
    }): Promise<{ status: UserStatus; tokenVersion: number } | null>
  }
}

/**
 * Like verifyAccessToken, but also checks the account is still active and the token was not
 * revoked (its `tv` must match the user's current tokenVersion). Use for sockets.
 */
export async function verifyAccessTokenForSession(
  jwt: JwtService,
  prisma: SessionLookup,
  token: string
): Promise<AccessTokenPayload> {
  const payload = verifyAccessToken(jwt, token)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { status: true, tokenVersion: true },
  })
  if (
    !user ||
    user.status !== UserStatus.ACTIVE ||
    !tokenVersionMatches(payload, user.tokenVersion)
  ) {
    throw new UnauthorizedException("Session is no longer valid")
  }
  return payload
}
