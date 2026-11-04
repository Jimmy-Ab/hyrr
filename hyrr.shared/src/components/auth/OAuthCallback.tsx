import * as React from "react"
import { useJobStore } from "../../store/useJobStore"

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  email_unverified:
    "Your account with this provider does not have a verified email address. Verify your email with the provider, or sign in with email and password.",
  access_denied: "Sign in was cancelled.",
  role_mismatch: "This account belongs to a different Hyrr app. Please use the matching app.",
}

interface OAuthCallbackProps {
  /** Path to land on after a successful sign in (default "/dashboard"). */
  redirectTo?: string
}

/** Navigates in-app without reloading: replaces the URL and lets the app re-sync its route. */
function navigateInApp(path: string) {
  window.history.replaceState(null, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function OAuthCallback({ redirectTo = "/dashboard" }: OAuthCallbackProps) {
  const setAccessToken = useJobStore((s) => s.setAccessToken)
  const fetchInitialData = useJobStore((s) => s.fetchInitialData)
  const [error, setError] = React.useState<string | null>(null)
  const handled = React.useRef(false)

  React.useEffect(() => {
    if (handled.current) return
    handled.current = true

    // Credentials are only ever read from the fragment, which browsers do not send to servers/logs.
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const token = params.get("token")
    const errorCode = params.get("error")

    // Strip the token from the address bar and history before anything else.
    window.history.replaceState(null, "", window.location.pathname)

    if (errorCode || !token) {
      setError(
        (errorCode && OAUTH_ERROR_MESSAGES[errorCode]) ||
          (errorCode
            ? "We couldn't complete sign in with this provider. Please try again."
            : "The sign in link is missing its credentials. Please try again.")
      )
      return
    }

    navigateInApp(redirectTo)
    setAccessToken(token)
    void fetchInitialData()
  }, [setAccessToken, fetchInitialData, redirectTo])

  if (error) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary gap-4 p-6 text-center">
        <p className="text-[15px] font-bold text-txt-heading">Sign in failed</p>
        <p role="alert" className="max-w-md text-[13px] text-txt-body">
          {error}
        </p>
        <button
          type="button"
          onClick={() => navigateInApp("/")}
          className="mt-2 h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-[13px] text-txt-caption font-semibold">
        Completing sign in, please wait...
      </p>
    </div>
  )
}
