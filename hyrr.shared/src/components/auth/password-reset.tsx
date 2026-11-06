import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail } from "lucide-react"
import * as React from "react"
import { errorMessage, isApiError } from "../../lib/api"
import { CAPTCHA_ENABLED } from "../../lib/config"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { AuthShell } from "./auth-shell"
import { TurnstileWidget } from "./turnstile-widget"

/** Full page navigation back to the app root (sign-in or workspace). */
// eslint-disable-next-line react-refresh/only-export-components
export function goToSignIn() {
  window.location.assign("/")
}

function tokenFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get("token") || ""
  } catch {
    return ""
  }
}

/** "Forgot password?" form: e-mail (+ captcha) → confirmation. Used inside AuthPage and standalone. */
export function ForgotPasswordForm({
  initialEmail = "",
  onBack,
}: {
  initialEmail?: string
  onBack: () => void
}) {
  const requestPasswordReset = useJobStore((s) => s.requestPasswordReset)
  const [email, setEmail] = React.useState(initialEmail)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = React.useState("")
  const [captchaKey, setCaptchaKey] = React.useState(0)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    if (CAPTCHA_ENABLED && !captchaToken) {
      setError("Please complete the security check.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(value, captchaToken || undefined)
      setSentTo(value)
    } catch (err) {
      setError(
        isApiError(err) && err.errorCode === "CAPTCHA_FAILED"
          ? "The security check failed. Please try again."
          : errorMessage(err, "Couldn't send the reset link.")
      )
    } finally {
      setBusy(false)
      setCaptchaToken("")
      setCaptchaKey((k) => k + 1)
    }
  }

  if (sentTo) {
    return (
      <>
        <div className="auth-card-header">
          <h2 className="auth-card-title">Check your inbox</h2>
        </div>
        <div className="auth-success" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset your
            password. It expires soon, so use it right away.
          </span>
        </div>
        <p className="auth-info">
          Didn't get it? Check your spam folder or{" "}
          <button type="button" className="auth-link-btn" onClick={() => setSentTo(null)}>
            try again
          </button>
          .
        </p>
        <button type="button" className="auth-link-btn auth-back" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
        </button>
      </>
    )
  }

  return (
    <>
      <div className="auth-card-header">
        <h2 className="auth-card-title">Reset your password</h2>
        <p className="auth-card-sub">Enter your e-mail and we'll send you a reset link.</p>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="auth-field">
          <label className="auth-label" htmlFor="forgot-email">
            Email Address
          </label>
          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" />
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="emily@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="auth-input"
            />
          </div>
        </div>
        <TurnstileWidget
          key={captchaKey}
          theme="dark"
          className="auth-captcha"
          onToken={setCaptchaToken}
          onExpire={() => setCaptchaToken("")}
        />
        <Button type="submit" disabled={busy} className="auth-submit-btn">
          {busy ? <span className="auth-spinner" /> : "Send reset link"}
        </Button>
      </form>
      <button type="button" className="auth-link-btn auth-back" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
      </button>
    </>
  )
}

/** Standalone /forgot-password route. */
export function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm onBack={goToSignIn} />
    </AuthShell>
  )
}

/** /reset-password?token=… — choose a new password. */
export function ResetPasswordPage() {
  const resetPassword = useJobStore((s) => s.resetPassword)
  const [token] = React.useState(tokenFromUrl)
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [show, setShow] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [linkBroken, setLinkBroken] = React.useState(!token)
  const [done, setDone] = React.useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("The passwords don't match.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (
        isApiError(err) &&
        (err.errorCode === "TOKEN_EXPIRED" || err.errorCode === "TOKEN_INVALID")
      ) {
        setLinkBroken(true)
      } else {
        setError(errorMessage(err, "Couldn't reset your password."))
      }
    } finally {
      setBusy(false)
    }
  }

  let body: React.ReactNode
  if (done) {
    body = (
      <>
        <div className="auth-card-header">
          <h2 className="auth-card-title">Password updated</h2>
        </div>
        <div className="auth-success" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Your password has been changed and you've been signed out on all devices.</span>
        </div>
        <Button className="auth-submit-btn" onClick={goToSignIn}>
          Sign in
        </Button>
      </>
    )
  } else if (linkBroken) {
    body = (
      <>
        <div className="auth-card-header">
          <h2 className="auth-card-title">Link expired or invalid</h2>
          <p className="auth-card-sub">
            Password reset links work once and expire after a short time. Request a new one.
          </p>
        </div>
        <Button
          className="auth-submit-btn"
          onClick={() => window.location.assign("/forgot-password")}
        >
          Request a new link
        </Button>
        <button type="button" className="auth-link-btn auth-back" onClick={goToSignIn}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
        </button>
      </>
    )
  } else {
    body = (
      <>
        <div className="auth-card-header">
          <h2 className="auth-card-title">Choose a new password</h2>
          <p className="auth-card-sub">Use at least 8 characters.</p>
        </div>
        {error && (
          <div className="auth-error" role="alert">
            <span aria-hidden="true">⚠️</span> {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="reset-password">
              New password
            </label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" />
              <Input
                id="reset-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                className="auth-input auth-input-password"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="reset-confirm">
              Confirm password
            </label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" />
              <Input
                id="reset-confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="auth-input"
              />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="auth-submit-btn">
            {busy ? <span className="auth-spinner" /> : "Update password"}
          </Button>
        </form>
        <button type="button" className="auth-link-btn auth-back" onClick={goToSignIn}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
        </button>
      </>
    )
  }

  return <AuthShell>{body}</AuthShell>
}
