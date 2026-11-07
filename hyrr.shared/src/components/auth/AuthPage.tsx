import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Mail,
  User,
  Users,
} from "lucide-react"
import * as React from "react"
import { errorMessage } from "../../lib/api"
import { CAPTCHA_ENABLED, getOAuthUrl } from "../../lib/config"
import { clearInviteToken, pendingInviteToken } from "../../lib/invite-token"
import { companySetupSchema, validate, type FieldErrors } from "../../lib/validation"
import type { CompanyMatch, InvitePreview } from "../../store/types"
import { useJobStore } from "../../store/useJobStore"
import { FieldError } from "../forms/structured-fields"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { AuthShell, GithubIcon, GoogleIcon, LinkedInIcon } from "./auth-shell"
import { ForgotPasswordForm } from "./password-reset"
import { TurnstileWidget } from "./turnstile-widget"

/* ─── Props ───────────────────────────────────────────────────────────────── */
interface AuthPageProps {
  /** "ADMIN": sign-in only (no sign-up, no OAuth); the two-factor step still applies. */
  forcedRole: "SEEKER" | "RECRUITER" | "ADMIN"
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

  const isAdmin = forcedRole === "ADMIN"
  const isRecruiter = forcedRole === "RECRUITER"
  // Team invite link (recruiter app): sign up or sign in to join that company.
  const [inviteToken] = React.useState(() => (isRecruiter ? pendingInviteToken() : null))
  const [invite, setInvite] = React.useState<InvitePreview | null>(null)
  const [inviteError, setInviteError] = React.useState<string | null>(null)
  const previewInvite = useJobStore((s) => s.previewInvite)
  const findCompanyByEmail = useJobStore((s) => s.findCompanyByEmail)
  const [mode, setMode] = React.useState<"login" | "register" | "forgot">(
    isAdmin && initialMode === "register" ? "login" : inviteToken ? "register" : initialMode
  )
  // Recruiter sign-up: the company to create, or a verified company on the same domain to join.
  const [companyName, setCompanyName] = React.useState("")
  const [companyWebsite, setCompanyWebsite] = React.useState("")
  const [companyErrors, setCompanyErrors] = React.useState<FieldErrors>({})
  const [match, setMatch] = React.useState<CompanyMatch | null>(null)
  const [joinMatch, setJoinMatch] = React.useState(true)

  React.useEffect(() => {
    if (!inviteToken) return
    let alive = true
    previewInvite(inviteToken)
      .then((preview) => alive && setInvite(preview))
      .catch((err) => {
        if (!alive) return
        clearInviteToken()
        setInviteError(errorMessage(err, "This invite link is no longer valid."))
      })
    return () => {
      alive = false
    }
  }, [inviteToken, previewInvite])

  const checkDomain = async () => {
    if (!isRecruiter || mode !== "register" || invite || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return
    const found = await findCompanyByEmail(email.trim())
    setMatch(found)
    setJoinMatch(true)
  }
  const joining = !!invite || (!!match && joinMatch)
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
    } else if (forcedRole !== "ADMIN") {
      if (isRecruiter && !joining) {
        const errors = validate(companySetupSchema, { name: companyName, website: companyWebsite })
        setCompanyErrors(errors)
        if (Object.keys(errors).length) return
      }
      // The app switches to the workspace as soon as the session exists, so the invite must be
      // consumed by this request, not by the accept dialog (this page keeps its own copy).
      if (invite) clearInviteToken()
      await registerUser(
        name,
        email,
        password,
        forcedRole,
        token,
        isRecruiter
          ? invite && inviteToken
            ? { inviteToken }
            : match && joinMatch
              ? { joinCompanyId: match.id }
              : { companyName: companyName.trim(), companyWebsite: companyWebsite.trim() }
          : undefined
      )
    }
    // Turnstile tokens are single-use.
    if (token) resetCaptcha()
  }

  const handleOAuth = (provider: "google" | "github" | "linkedin") => {
    if (forcedRole === "ADMIN") return
    window.location.assign(getOAuthUrl(provider, forcedRole))
  }

  const isSeeker = forcedRole === "SEEKER"
  // Admins get the plain centred card (no marketing hero).
  const shellRole = isAdmin ? undefined : forcedRole
  const signedOutReason = useJobStore((s) => s.signedOutReason)
  const error = localError || authError || signedOutReason || inviteError

  if (mfaPending) {
    return (
      <AuthShell forcedRole={shellRole}>
        <MfaStep />
      </AuthShell>
    )
  }

  if (mode === "forgot") {
    return (
      <AuthShell forcedRole={shellRole}>
        <ForgotPasswordForm initialEmail={email} onBack={() => switchMode("login")} />
      </AuthShell>
    )
  }

  return (
    <AuthShell forcedRole={shellRole}>
      {/* Header */}
      <div className="auth-card-header">
        <h2 className="auth-card-title">
          {isAdmin ? "Hyrr admin" : mode === "login" ? "Welcome back 👋" : "Create your account"}
        </h2>
        <p className="auth-card-sub">
          {isAdmin
            ? "Sign in with your admin account. Two-factor authentication is required."
            : mode === "login"
              ? "Sign in to continue to your dashboard."
              : `Start your journey as a ${isSeeker ? "job seeker" : "recruiter"}.`}
        </p>
      </div>

      {invite && (
        <div className="auth-invite" role="status">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {invite.invitedBy ? `${invite.invitedBy} invited you` : "You're invited"} to join{" "}
            <strong>{invite.company.name}</strong> as {invite.roleLabel}. Use{" "}
            <strong>{invite.emailHint}</strong> to {mode === "login" ? "sign in" : "sign up"}.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="auth-error" role="alert">
          <span aria-hidden="true">⚠️</span> {error}
        </div>
      )}

      {/* OAuth (not for admins) */}
      {!isAdmin && (
        <>
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
        </>
      )}

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
              onChange={(e) => {
                setEmail(e.target.value)
                if (match) setMatch(null)
              }}
              onBlur={() => void checkDomain()}
              required
              className="auth-input"
            />
          </div>
        </div>

        {mode === "register" && isRecruiter && !invite && match && (
          <fieldset className="auth-choice">
            <legend className="auth-label">{match.name} is already on Hyrr</legend>
            <label className="auth-choice-option">
              <input type="radio" checked={joinMatch} onChange={() => setJoinMatch(true)} />
              <span>Ask to join {match.name} (an owner approves you)</span>
            </label>
            <label className="auth-choice-option">
              <input type="radio" checked={!joinMatch} onChange={() => setJoinMatch(false)} />
              <span>Create a new company</span>
            </label>
          </fieldset>
        )}

        {mode === "register" && isRecruiter && !joining && (
          <>
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-company">
                Company name
              </label>
              <div className="auth-input-wrap">
                <Building2 className="auth-input-icon" />
                <Input
                  id="auth-company"
                  placeholder="Acme Inc."
                  autoComplete="organization"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value)
                    setCompanyErrors((c) => ({ ...c, name: "" }))
                  }}
                  aria-invalid={!!companyErrors.name || undefined}
                  aria-describedby={companyErrors.name ? "auth-company-error" : undefined}
                  className="auth-input"
                />
              </div>
              <FieldError id="auth-company-error" message={companyErrors.name || undefined} />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-website">
                Company website <span className="auth-optional">(optional)</span>
              </label>
              <div className="auth-input-wrap">
                <Globe className="auth-input-icon" />
                <Input
                  id="auth-website"
                  placeholder="https://acme.com"
                  autoComplete="url"
                  inputMode="url"
                  value={companyWebsite}
                  onChange={(e) => {
                    setCompanyWebsite(e.target.value)
                    setCompanyErrors((c) => ({ ...c, website: "" }))
                  }}
                  aria-invalid={!!companyErrors.website || undefined}
                  aria-describedby={
                    companyErrors.website ? "auth-website-error" : "auth-website-hint"
                  }
                  className="auth-input"
                />
              </div>
              <FieldError id="auth-website-error" message={companyErrors.website || undefined} />
              {!companyErrors.website && (
                <p id="auth-website-hint" className="auth-hint">
                  Your company gets a verified badge when your work e-mail matches this website.
                </p>
              )}
            </div>
          </>
        )}

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
      {!isAdmin && (
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
      )}

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
