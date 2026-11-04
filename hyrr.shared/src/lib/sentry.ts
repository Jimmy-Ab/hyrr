import { SENTRY_DSN } from "./config"

let started = false

/** Starts Sentry error reporting for an app. No-op without VITE_SENTRY_DSN (the SDK is not even loaded). */
export function initSentry(appName: "recruiter" | "jobseeker"): void {
  if (!SENTRY_DSN || started || typeof window === "undefined") return
  started = true
  const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>
  import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: env.MODE || "production",
        initialScope: { tags: { app: appName } },
      })
    })
    .catch((err) => console.warn("Sentry failed to start.", err))
}
