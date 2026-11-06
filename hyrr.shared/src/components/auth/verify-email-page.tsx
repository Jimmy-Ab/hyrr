import { CheckCircle2, MailWarning } from "lucide-react"
import * as React from "react"
import { errorMessage, isApiError } from "../../lib/api"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { AuthShell } from "./auth-shell"
import { useCooldown } from "./email-verification-banner"
import { goToSignIn } from "./password-reset"

// One request per token, even when React StrictMode mounts the page twice.
const attempts = new Map<string, Promise<void>>()

type State =
  | { kind: "verifying" }
  | { kind: "success" }
  | { kind: "failed"; expired: boolean; message: string }

/** /verify-email?token=… — confirms the e-mail address from the link we sent. */
export function VerifyEmailPage() {
  const verifyEmail = useJobStore((s) => s.verifyEmail)
  const resendVerification = useJobStore((s) => s.resendVerification)
  const isAuthenticated = useJobStore((s) => s.isAuthenticated)
  const userVerified = useJobStore((s) => !!s.user?.emailVerified)
  const [state, setState] = React.useState<State>({ kind: "verifying" })
  const [resendBusy, setResendBusy] = React.useState(false)
  const [resendNote, setResendNote] = React.useState<string | null>(null)
  const cooldown = useCooldown()

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || ""
    if (!token) {
      setState({ kind: "failed", expired: false, message: "This verification link is incomplete." })
      return
    }
    let promise = attempts.get(token)
    if (!promise) {
      promise = verifyEmail(token)
      attempts.set(token, promise)
    }
    let cancelled = false
    promise
      .then(() => !cancelled && setState({ kind: "success" }))
      .catch((err) => {
        if (cancelled) return
        const expired = isApiError(err) && err.errorCode === "TOKEN_EXPIRED"
        const invalid = isApiError(err) && err.errorCode === "TOKEN_INVALID"
        setState({
          kind: "failed",
          expired,
          message: expired
            ? "This verification link has expired."
            : invalid
              ? "This verification link is invalid or has already been used."
              : errorMessage(err, "We couldn't verify your e-mail address."),
        })
      })
    return () => {
      cancelled = true
    }
  }, [verifyEmail])

  const onResend = async () => {
    setResendBusy(true)
    setResendNote(null)
    try {
      await resendVerification()
      cooldown.start()
      setResendNote("We've sent you a new verification link.")
    } catch (err) {
      if (isApiError(err) && err.errorCode === "TOO_MANY_REQUESTS") cooldown.start()
      setResendNote(errorMessage(err, "Couldn't send a new link."))
    } finally {
      setResendBusy(false)
    }
  }

  let body: React.ReactNode
  if (state.kind === "verifying") {
    body = (
      <div className="auth-card-header" role="status" aria-busy="true">
        <span className="auth-spinner" aria-hidden="true" />
        <h2 className="auth-card-title">Verifying your e-mail…</h2>
      </div>
    )
  } else if (state.kind === "success") {
    body = (
      <>
        <div className="auth-card-header">
          <h2 className="auth-card-title">E-mail verified</h2>
        </div>
        <div className="auth-success" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Thanks! Your e-mail address is confirmed.</span>
        </div>
        <Button className="auth-submit-btn" onClick={goToSignIn}>
          {isAuthenticated ? "Continue to Hyrr" : "Sign in"}
        </Button>
      </>
    )
  } else {
    body = (
      <>
        <div className="auth-card-header">
          <h2 className="auth-card-title">
            {userVerified ? "Already verified" : "Verification failed"}
          </h2>
        </div>
        {userVerified ? (
          <div className="auth-success" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Your e-mail address is already confirmed.</span>
          </div>
        ) : (
          <div className="auth-error" role="alert">
            <MailWarning className="h-4 w-4 shrink-0" aria-hidden="true" /> {state.message}
          </div>
        )}
        {!userVerified &&
          (isAuthenticated ? (
            <>
              <Button
                className="auth-submit-btn"
                onClick={onResend}
                disabled={resendBusy || cooldown.left > 0}
              >
                {resendBusy ? (
                  <span className="auth-spinner" />
                ) : cooldown.left > 0 ? (
                  `Resend in ${cooldown.left}s`
                ) : (
                  "Send a new link"
                )}
              </Button>
              {resendNote && (
                <p className="auth-info" role="status">
                  {resendNote}
                </p>
              )}
            </>
          ) : (
            <p className="auth-info">
              Sign in and use "Resend e-mail" in the banner at the top to get a new link.
            </p>
          ))}
        <button type="button" className="auth-link-btn" onClick={goToSignIn}>
          {isAuthenticated ? "Continue to Hyrr" : "Go to sign in"}
        </button>
      </>
    )
  }

  return <AuthShell>{body}</AuthShell>
}
