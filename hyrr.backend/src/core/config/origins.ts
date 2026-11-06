const DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:5174,http://localhost:5175"

/** Normalise an origin (scheme://host[:port]) so comparisons ignore trailing slashes/paths. */
export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.origin
  } catch {
    return null
  }
}

/** Single source of truth for allowed browser origins (CORS, sockets, OAuth redirects). */
export function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS || DEFAULT_ORIGINS
  const origins = raw
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter((o): o is string => !!o)
  return Array.from(new Set(origins))
}

/** True when `origin` is one of the allowed origins. */
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false
  const normalized = normalizeOrigin(origin)
  return !!normalized && getAllowedOrigins().includes(normalized)
}
