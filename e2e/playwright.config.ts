import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests: real backend (built dist) + both Vite apps against a throwaway Postgres.
 * E2E_DATABASE_URL must point at a migrated, disposable database (never your dev DB).
 * Ports are offset from the dev ports so a running dev stack is never touched.
 */
export const API_PORT = 3201
export const RECRUITER_PORT = 5273
export const SEEKER_PORT = 5274
const API = `http://localhost:${API_PORT}/api`
const DB = process.env.E2E_DATABASE_URL || "postgresql://u@localhost:5499/smoke?schema=public"

const appEnv = { VITE_API_URL: API, VITE_TURNSTILE_SITE_KEY: "", VITE_SENTRY_DSN: "" }

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    // Full Chromium in new headless mode (no separate headless-shell download needed).
    channel: "chromium",
  },
  webServer: [
    {
      command: "node dist/main.js",
      cwd: "../hyrr.backend",
      url: `${API}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: DB,
        PORT: String(API_PORT),
        NODE_ENV: "development",
        JWT_SECRET: "e2e-only-jwt-secret-at-least-32-characters-long",
        CORS_ORIGINS: `http://localhost:${RECRUITER_PORT},http://localhost:${SEEKER_PORT}`,
        RECRUITER_APP_URL: `http://localhost:${RECRUITER_PORT}`,
        FRONTEND_URL: `http://localhost:${SEEKER_PORT}`,
        RATE_LIMIT_STRICT_PER_MINUTE: "1000",
        RATE_LIMIT_PER_MINUTE: "5000",
        // Everything optional stays off: no Redis, SMTP, AI, payments, captcha, search.
        REDIS_HOST: "",
        SMTP_HOST: "",
        EMAIL_WEBHOOK_URL: "",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GOOGLE_AI_API_KEY: "",
        STRIPE_SECRET_KEY: "",
        CHAPA_SECRET_KEY: "",
        TURNSTILE_SECRET_KEY: "",
        MEILI_HOST: "",
        SENTRY_DSN: "",
        UPLOAD_DIR: "/tmp/hyrr-e2e-uploads",
      },
    },
    {
      command: `npx vite --port ${RECRUITER_PORT} --strictPort`,
      cwd: "../hyrr.recruiter",
      url: `http://localhost:${RECRUITER_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: appEnv,
    },
    {
      command: `npx vite --port ${SEEKER_PORT} --strictPort`,
      cwd: "../hyrr.jobseeker",
      url: `http://localhost:${SEEKER_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: appEnv,
    },
  ],
})
