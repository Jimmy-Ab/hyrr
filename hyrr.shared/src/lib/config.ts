/** Runtime endpoints, configured at build time through Vite env variables. */
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>

export const API_URL: string = (env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, "")

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return "http://localhost:3000"
  }
}

export const API_ORIGIN: string = originOf(API_URL)

export const SOCKET_URL: string = (env.VITE_SOCKET_URL || API_ORIGIN).replace(/\/+$/, "")

/** Cloudflare Turnstile site key; the captcha widget is rendered only when set. */
export const TURNSTILE_SITE_KEY: string = env.VITE_TURNSTILE_SITE_KEY || ""

export const CAPTCHA_ENABLED: boolean = !!TURNSTILE_SITE_KEY

/** Sentry DSN; error reporting is a no-op when unset. */
export const SENTRY_DSN: string = env.VITE_SENTRY_DSN || ""

export type OAuthProvider = "google" | "github" | "linkedin"

export function getOAuthUrl(provider: OAuthProvider, role: "SEEKER" | "RECRUITER"): string {
  const params = new URLSearchParams({ role, redirect: window.location.origin })
  return `${API_ORIGIN}/api/auth/${provider}?${params.toString()}`
}
