import type { ReactNode } from "react"
import { LegalPage } from "../legal/legal-page"
import { ForgotPasswordPage, ResetPasswordPage } from "./password-reset"
import { VerifyEmailPage } from "./verify-email-page"

const PUBLIC_PATHS = ["/terms", "/privacy", "/verify-email", "/reset-password", "/forgot-password"]

function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/"
}

/** True for routes that render without a session (legal pages, e-mail links). */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.includes(normalize(pathname))
}

/**
 * Returns the page for a public route, or null. Each App renders it before its auth gate:
 * `const publicPage = resolvePublicRoute(pathname); if (publicPage) return publicPage`
 */
export function resolvePublicRoute(pathname: string): ReactNode | null {
  switch (normalize(pathname)) {
    case "/terms":
      return <LegalPage kind="terms" />
    case "/privacy":
      return <LegalPage kind="privacy" />
    case "/verify-email":
      return <VerifyEmailPage />
    case "/reset-password":
      return <ResetPasswordPage />
    case "/forgot-password":
      return <ForgotPasswordPage />
    default:
      return null
  }
}
