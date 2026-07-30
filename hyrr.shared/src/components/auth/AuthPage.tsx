import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import * as React from "react"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

/* ─── Brand icons ─────────────────────────────────────────────────────────── */
function HyrrLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="10" fill="url(#logo-grad)" />
      <path d="M10 10h4v7h8v-7h4v16h-4v-6h-8v6h-4V10z" fill="white" />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6C63FF" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
        fill="#0A66C2"
      />
    </svg>
  )
}

/* ─── Hero panel feature bullets ─────────────────────────────────────────── */
const features = [
  "AI-powered job matching tailored to your skills",
  "One-click apply to thousands of companies",
  "Real-time application tracking & insights",
  "Resume builder with ATS optimisation",
]

/* ─── Props ───────────────────────────────────────────────────────────────── */
interface AuthPageProps {
  forcedRole: "SEEKER" | "RECRUITER"
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export function AuthPage({ forcedRole }: AuthPageProps) {
  const { loginUser, registerUser, authLoading, authError } = useJobStore()

  const [mode, setMode] = React.useState<"login" | "register">("login")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [name, setName] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "login") {
      await loginUser(email, password)
    } else {
      await registerUser(name, email, password, forcedRole)
    }
  }

  const handleOAuth = (provider: string) => {
    window.location.href = `http://localhost:3000/api/auth/${provider}`
  }

  const isSeeker = forcedRole === "SEEKER"

  return (
    <div className="auth-root">
      {/* ── Animated mesh background ── */}
      <div className="auth-bg">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3" />
        <div className="auth-grid" />
      </div>

      {/* ── Main layout ── */}
      <div className="auth-layout">
        {/* ── Left: Hero panel ── */}
        <div className="auth-hero">
          <div className="auth-hero-inner">
            {/* Brand */}
            <div className="auth-brand">
              <HyrrLogo />
              <span className="auth-brand-name">hyrr</span>
            </div>

            <div className="auth-hero-content">
              <div className="auth-hero-pill">
                {isSeeker ? "🚀 For Job Seekers" : "🏢 For Recruiters"}
              </div>
              <h1 className="auth-hero-title">
                {isSeeker ? "Your dream job is one click away" : "Hire the best talent, fast"}
              </h1>
              <p className="auth-hero-sub">
                {isSeeker
                  ? "Join 200,000+ professionals who found their perfect role with Hyrr's AI-powered platform."
                  : "Access a curated pipeline of top candidates and streamline your entire hiring workflow."}
              </p>

              {/* Feature list */}
              <ul className="auth-features">
                {features.map((f) => (
                  <li key={f} className="auth-feature-item">
                    <CheckCircle2 className="auth-feature-icon" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Floating stat cards */}
            <div className="auth-stats">
              <div className="auth-stat-card">
                <span className="auth-stat-num">98%</span>
                <span className="auth-stat-label">Match accuracy</span>
              </div>
              <div className="auth-stat-card">
                <span className="auth-stat-num">14 days</span>
                <span className="auth-stat-label">Avg. time to hire</span>
              </div>
              <div className="auth-stat-card">
                <span className="auth-stat-num">50k+</span>
                <span className="auth-stat-label">Open roles today</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Form panel ── */}
        <div className="auth-form-panel">
          <div className="auth-card">
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
            {authError && (
              <div className="auth-error">
                <span>⚠️</span> {authError}
              </div>
            )}

            {/* OAuth */}
            <div className="auth-oauth-grid">
              <button
                id="oauth-google"
                className="auth-oauth-btn"
                onClick={() => handleOAuth("google")}
              >
                <GoogleIcon /> <span>Google</span>
              </button>
              <button
                id="oauth-github"
                className="auth-oauth-btn"
                onClick={() => handleOAuth("github")}
              >
                <GithubIcon /> <span>GitHub</span>
              </button>
              <button
                id="oauth-linkedin"
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
                    <button type="button" className="auth-forgot">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <Input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="auth-input auth-input-password"
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                id="auth-submit"
                type="submit"
                disabled={authLoading}
                className="auth-submit-btn"
              >
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
                className="auth-switch-btn"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>

            <p className="auth-terms">
              By continuing you agree to our{" "}
              <a href="#" className="auth-terms-link">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="auth-terms-link">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Root & Layout ──────────────────────────────────────────────── */
        .auth-root {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: stretch;
          position: relative;
          overflow: hidden;
          font-family: "Inter", "SF Pro Text", -apple-system, sans-serif;
        }

        /* ── Animated background ─────────────────────────────────────────── */
        .auth-bg {
          position: fixed;
          inset: 0;
          background: #0D0E14;
          z-index: 0;
        }
        .auth-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.35;
          animation: blobFloat 12s ease-in-out infinite;
        }
        .auth-blob-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #6C63FF, transparent);
          top: -15%; left: -10%;
          animation-delay: 0s;
        }
        .auth-blob-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #A855F7, transparent);
          bottom: -10%; right: 30%;
          animation-delay: -4s;
        }
        .auth-blob-3 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #3B7FF5, transparent);
          top: 30%; right: -5%;
          animation-delay: -8s;
        }
        .auth-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(108,99,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(108,99,255,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        @keyframes blobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.97); }
        }

        /* ── Two-column layout ───────────────────────────────────────────── */
        .auth-layout {
          position: relative;
          z-index: 1;
          display: flex;
          width: 100%;
          min-height: 100vh;
        }

        /* ── Hero (left) ─────────────────────────────────────────────────── */
        .auth-hero {
          flex: 1;
          display: none;
          padding: 48px;
          align-items: center;
        }
        @media (min-width: 1024px) {
          .auth-hero { display: flex; }
        }
        .auth-hero-inner {
          max-width: 480px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .auth-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .auth-brand-name {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
        }
        .auth-hero-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .auth-hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(108,99,255,0.18);
          border: 1px solid rgba(108,99,255,0.35);
          color: #A89DFF;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
          width: fit-content;
        }
        .auth-hero-title {
          font-size: clamp(28px, 3.5vw, 40px);
          font-weight: 800;
          color: #fff;
          line-height: 1.2;
          letter-spacing: -0.8px;
          margin: 0;
        }
        .auth-hero-sub {
          font-size: 15px;
          color: rgba(255,255,255,0.55);
          line-height: 1.65;
          margin: 0;
        }
        .auth-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .auth-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          line-height: 1.5;
        }
        .auth-feature-icon {
          width: 16px;
          height: 16px;
          color: #6C63FF;
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* ── Stat cards ──────────────────────────────────────────────────── */
        .auth-stats {
          display: flex;
          gap: 12px;
        }
        .auth-stat-card {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          backdrop-filter: blur(8px);
        }
        .auth-stat-num {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
        }
        .auth-stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          font-weight: 500;
        }

        /* ── Right form panel ────────────────────────────────────────────── */
        .auth-form-panel {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
        }
        @media (min-width: 1024px) {
          .auth-form-panel {
            width: 480px;
            flex-shrink: 0;
            background: rgba(255,255,255,0.03);
            border-left: 1px solid rgba(255,255,255,0.06);
            backdrop-filter: blur(24px);
          }
        }

        /* ── Card ────────────────────────────────────────────────────────── */
        .auth-card {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Header ──────────────────────────────────────────────────────── */
        .auth-card-header { display: flex; flex-direction: column; gap: 6px; }
        .auth-card-title {
          font-size: 24px;
          font-weight: 800;
          color: #F5F6F8;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .auth-card-sub {
          font-size: 13.5px;
          color: rgba(255,255,255,0.45);
          margin: 0;
          line-height: 1.5;
        }

        /* ── Error ───────────────────────────────────────────────────────── */
        .auth-error {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(217,48,48,0.12);
          border: 1px solid rgba(217,48,48,0.25);
          color: #FF6B6B;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── OAuth ───────────────────────────────────────────────────────── */
        .auth-oauth-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .auth-oauth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .auth-oauth-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          color: #fff;
          transform: translateY(-1px);
        }

        /* ── Divider ─────────────────────────────────────────────────────── */
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .auth-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }
        .auth-divider-text {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.5px;
          white-space: nowrap;
          text-transform: uppercase;
        }

        /* ── Form fields ─────────────────────────────────────────────────── */
        .auth-form { display: flex; flex-direction: column; gap: 14px; }
        .auth-field { display: flex; flex-direction: column; gap: 6px; }
        .auth-label {
          font-size: 11.5px;
          font-weight: 700;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }
        .auth-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .auth-forgot {
          font-size: 12px;
          font-weight: 600;
          color: #7C6BF0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: color 0.2s;
        }
        .auth-forgot:hover { color: #A89DFF; }
        .auth-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .auth-input-icon {
          position: absolute;
          left: 13px;
          width: 15px;
          height: 15px;
          color: rgba(255,255,255,0.3);
          pointer-events: none;
          z-index: 1;
        }
        .auth-input {
          padding-left: 40px !important;
          height: 44px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #F5F6F8 !important;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .auth-input::placeholder { color: rgba(255,255,255,0.2) !important; }
        .auth-input:focus {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(108,99,255,0.6) !important;
          box-shadow: 0 0 0 3px rgba(108,99,255,0.15) !important;
          outline: none !important;
        }
        .auth-input-password { padding-right: 44px !important; }
        .auth-eye-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.2s;
        }
        .auth-eye-btn:hover { color: rgba(255,255,255,0.6); }

        /* ── Submit button ───────────────────────────────────────────────── */
        .auth-submit-btn {
          height: 46px;
          border-radius: 12px;
          font-size: 14.5px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #6C63FF, #A855F7) !important;
          border: none !important;
          color: #fff !important;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 8px 32px rgba(108,99,255,0.35);
          letter-spacing: 0.2px;
        }
        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(108,99,255,0.5);
        }
        .auth-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .auth-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Spinner ─────────────────────────────────────────────────────── */
        .auth-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Switch / Terms ──────────────────────────────────────────────── */
        .auth-switch {
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          margin: 0;
        }
        .auth-switch-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          color: #7C6BF0;
          padding: 0;
          transition: color 0.2s;
        }
        .auth-switch-btn:hover { color: #A89DFF; text-decoration: underline; }

        .auth-terms {
          text-align: center;
          font-size: 11.5px;
          color: rgba(255,255,255,0.2);
          margin: 0;
          line-height: 1.6;
        }
        .auth-terms-link {
          color: rgba(255,255,255,0.35);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.2s;
        }
        .auth-terms-link:hover { color: rgba(255,255,255,0.6); }
      `}</style>
    </div>
  )
}
