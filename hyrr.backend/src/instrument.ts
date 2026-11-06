/**
 * Sentry bootstrap. Imported first in main.ts so instrumentation hooks in before other modules
 * load. No-op unless SENTRY_DSN is set.
 */
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env") })

export const sentryEnabled = !!process.env.SENTRY_DSN?.trim()

if (sentryEnabled) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require("@sentry/nestjs")
  Sentry.init({
    dsn: process.env.SENTRY_DSN!.trim(),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
  })
}
