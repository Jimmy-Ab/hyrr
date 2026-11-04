/** Reports an exception to Sentry when SENTRY_DSN is configured (see src/instrument.ts). Never throws. */
export function captureException(error: unknown, context: Record<string, unknown> = {}) {
  if (!process.env.SENTRY_DSN?.trim()) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nestjs")
    Sentry.captureException(error, { extra: context })
  } catch {
    /* reporting must never break request handling */
  }
}
