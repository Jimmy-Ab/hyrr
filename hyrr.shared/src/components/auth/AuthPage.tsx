import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, User } from "lucide-react"
import * as React from "react"
import { CAPTCHA_ENABLED, getOAuthUrl } from "../../lib/config"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { AuthShell, GithubIcon, GoogleIcon, LinkedInIcon } from "./auth-shell"
import { ForgotPasswordForm } from "./password-reset"
import { TurnstileWidget } from "./turnstile-widget"

/* ─── Props ───────────────────────────────────────────────────────────────── */
interface AuthPageProps {
  forcedRole: "SEEKER" | "RECRUITER"
  /** Screen to open on (default "login"). */
  initialMode?: "login" | "register" | "forgot"
}

/* ─── Second factor step ─────────────────────────────────────────────────── */
function MfaStep() {
  const verifyTwoFactorLogin = useJobStore((s) => s.verifyTwoFactorLogin)
  const cancelTwoFactorLogin = useJobStore((s) => s.cancelTwoFactorLogin)
  const authLoading = useJobStore((s) => s.authLoading)
  const authError = useJobStore((s) => s.authError)
  const [useRecovery, setUseRecovery] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [localError, setLocalError] = React.useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!useRecovery && !/^\d{6}$/.test(value)) {
      setLocalError("Enter the 6-digit code from your authenticator app.")
      return
    }
    if (useRecovery && value.length < 6) {
      setLocalError("Enter one of your recovery codes.")
      return
    }
    setLocalError(null)
    const ok = await verifyTwoFactorLogin(value)
    if (!ok) setCode("")
  }

  const error = localError || authError
  return (
    <>
      <div className="auth-card-header">
        <h2 className="auth-card-title">Two-factor authentication</h2>
        <p className="auth-card-sub">
          {useRecovery
            ? "Enter one of the recovery codes you saved when you turned on two-factor."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {error && (
        <div className="auth-error" role="alert">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="auth-form">
        <div className="auth-field">
          <label className="auth-label" htmlFor="auth-mfa-code">
            {useRecovery ? "Recovery code" : "Authentication code"}
          </label>
          <div className="auth-input-wrap">
            <Input
              id="auth-mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={useRecovery ? 32 : 6}
              placeholder={useRecovery ? "xxxx-xxxx" : "123456"}
              autoFocus
              className="auth-input auth-code-input"
            />
          </div>
        </div>
        <Button type="submit" disabled={authLoading} className="auth-submit-btn">
          {authLoading ? <span className="auth-spinner" /> : "Verify"}
        </Button>
      </form>

      <button
        type="button"
        className="auth-link-btn"
        onClick={() => {
          setUseRecovery((v) => !v)
          setCode("")
          setLocalError(null)
        }}
      >
        <KeyRound className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        {useRecovery ? "Use authenticator app instead" : "Use a recovery code instead"}
      </button>
      <button type="button" className="auth-link-btn auth-back" onClick={cancelTwoFactorLogin}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
      </button>
    </>
  )
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export function AuthPage({ forcedRole, initialMode = "login" }: AuthPageProps) {
  const loginUser = useJobStore((s) => s.loginUser)
  const registerUser = useJobStore((s) => s.registerUser)
  const authLoading = useJobStore((s) => s.authLoading)
  const authError = useJobStore((s) => s.authError)
  const mfaPending = useJobStore((s) => s.mfaPending)

  const [mode, setMode] = React.useState<"login" | "register" | "forgot">(initialMode)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [name, setName] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)

  // Captcha: always on register; on login only after the server asked for it.
  const [needLoginCaptcha, setNeedLoginCaptcha] = React.useState(false)
  const [captchaToken, setCaptchaToken] = React.useState("")
  const [captchaKey, setCaptchaKey] = React.useState(0)
  const showCaptcha = CAPTCHA_ENABLED && (mode === "register" || needLoginCaptcha)
  const resetCaptcha = () => {
    setCaptchaToken("")
    setCaptchaKey((k) => k + 1)
  }

  const switchMode = (next: "login" | "register" | "forgot") => {
    setMode(next)
    setLocalError(null)
    resetCaptcha()
    useJobStore.setState({ authError: null })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (showCaptcha && !captchaToken) {
      setLocalError("Please complete the security check.")
      return
    }
    setLocalError(null)
    const token = captchaToken || undefined
    if (mode === "login") {
      const result = await loginUser(email, password, token)
      if (result === "CAPTCHA_REQUIRED") setNeedLoginCaptcha(true)
    } else {
      await registerUser(name, email, password, forcedRole, token)
    }
    // Turnstile tokens are single-use.
    if (token) resetCaptcha()
  }

  const handleOAuth = (provider: "google" | "github" | "linkedin") => {
    window.location.assign(getOAuthUrl(provider, forcedRole))
  }

  const isSeeker = forcedRole === "SEEKER"
  const error = localError || authError

  if (mfaPending) {
    return (
      <AuthShell forcedRole={forcedRole}>
        <MfaStep />
      </AuthShell>
    )
  }

  if (mode === "forgot") {
    return (
      <AuthShell forcedRole={forcedRole}>
        <ForgotPasswordForm initialEmail={email} onBack={() => switchMode("login")} />
      </AuthShell>
    )
  }

  return (
    <AuthShell forcedRole={forcedRole}>
      {/* Header */}
      <div className="auth-card-header">
        <h2 className="auth-card-title">
          {mode === "login" ? "Welcome back 👋" : "Create your account"}
        </h2>
        <p className="auth-card-sub">
          {mode === "login"
            ? "Sign in to continue to your dashboard."
            : `Start your journey as a ${isSeeker ? "job seeker" : "recruiter"}.`}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="auth-error" role="alert">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}

      {/* OAuth */}
      <div className="auth-oauth-grid">
        <button
          id="oauth-google"
          type="button"
          className="auth-oauth-btn"
          onClick={() => handleOAuth("google")}
        >
          <GoogleIcon /> <span>Google</span>
        </button>
        <button
          id="oauth-github"
          type="button"
          className="auth-oauth-btn"
          onClick={() => handleOAuth("github")}
        >
          <GithubIcon /> <span>GitHub</span>
        </button>
        <button
          id="oauth-linkedin"
          type="button"
          className="auth-oauth-btn"
          onClick={() => handleOAuth("linkedin")}
        >
          <LinkedInIcon /> <span>LinkedIn</span>
        </button>
      </div>

      {/* Divider */}
      <div className="auth-divider">
        <div className="auth-divider-line" />
        <span className="auth-divider-text">or continue with email</span>
        <div className="auth-divider-line" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "register" && (
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-name">
              Full Name
            </label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" />
              <Input
                id="auth-name"
                placeholder="Emily Carter"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="auth-input"
              />
            </div>
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label" htmlFor="auth-email">
            Email Address
          </label>
          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" />
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="emily@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
            />
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-label-row">
            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            {mode === "login" && (
              <button type="button" className="auth-forgot" onClick={() => switchMode("forgot")}>
                Forgot password?
              </button>
            )}
          </div>
          <div className="auth-input-wrap">
            <Lock className="auth-input-icon" />
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              className="auth-input auth-input-password"
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showCaptcha && (
          <TurnstileWidget
            key={captchaKey}
            theme="dark"
            className="auth-captcha"
            onToken={setCaptchaToken}
            onExpire={() => setCaptchaToken("")}
          />
        )}

        <Button id="auth-submit" type="submit" disabled={authLoading} className="auth-submit-btn">
          {authLoading ? (
            <span className="auth-spinner" />
          ) : (
            <>
              {mode === "login" ? "Sign In" : "Create Account"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Switch mode */}
      <p className="auth-switch">
        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          className="auth-switch-btn"
          onClick={() => switchMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Sign Up" : "Sign In"}
        </button>
      </p>

      <p className="auth-terms">
        By continuing you agree to our{" "}
        <a href="/terms" target="_blank" rel="noopener" className="auth-terms-link">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" target="_blank" rel="noopener" className="auth-terms-link">
          Privacy Policy
        </a>
        .
      </p>
    </AuthShell>
  )
}
