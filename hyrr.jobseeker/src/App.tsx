import {
  AiChatWidget,
  AuthPage,
  Button,
  CookieNotice,
  EmailVerificationBanner,
  OAuthCallback,
  RoleMismatch,
  type SeekerView,
  Skeleton,
  ToastProvider,
  apiFetch,
  isPublicRoute,
  resolvePublicRoute,
  useJobStore,
} from "hyrr.shared"
import { AlertTriangle } from "lucide-react"
import * as React from "react"
import { Header } from "./components/layout/header"
import { Sidebar } from "./components/layout/sidebar"

// Pages
import { AlertsPage } from "./pages/Alerts"
import { ApplicationsBoard } from "./pages/Applications"
import { CandidateCalendar } from "./pages/CalendarPage"
import { CandidateDashboard } from "./pages/Dashboard"
import { DiscoverJobs } from "./pages/DiscoverJobs"
import { Documents } from "./pages/Documents"
import { CandidateMessages } from "./pages/Messages"
import { NotificationsPage } from "./pages/Notifications"
import { ProfilePage } from "./pages/ProfilePage"
import { SettingsPage } from "./pages/Settings"

const VIEW_PATHS: Record<SeekerView, string> = {
  Dashboard: "/dashboard",
  Discover: "/discover",
  Alerts: "/alerts",
  Applications: "/applications",
  Messages: "/messages",
  Notifications: "/notifications",
  Calendar: "/calendar",
  Documents: "/documents",
  Profile: "/profile",
  Settings: "/settings",
}

const OAUTH_CALLBACK_PATH = "/auth/callback"

function viewFromPath(pathname: string): SeekerView | null {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  const match = (Object.entries(VIEW_PATHS) as [SeekerView, string][]).find(
    ([, path]) => path === normalized
  )
  return match ? match[0] : null
}

// Initial view from the path, applied before the first render so it never flashes /dashboard.
const initialView = viewFromPath(window.location.pathname)
if (initialView) useJobStore.setState({ candidateActiveView: initialView })

/** Keeps candidateActiveView and the URL path in sync (pushState + popstate). */
function useViewRouting() {
  const candidateActiveView = useJobStore((s) => s.candidateActiveView)
  const setCandidateActiveView = useJobStore((s) => s.setCandidateActiveView)
  const [pathname, setPathname] = React.useState(() => window.location.pathname)

  // Back/forward (and in-app replaceState + synthetic popstate from OAuthCallback)
  React.useEffect(() => {
    const onPop = () => {
      setPathname(window.location.pathname)
      const view = viewFromPath(window.location.pathname)
      if (view && view !== useJobStore.getState().candidateActiveView) {
        setCandidateActiveView(view)
      }
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [setCandidateActiveView])

  // View change -> URL
  React.useEffect(() => {
    if (window.location.pathname === OAUTH_CALLBACK_PATH) return
    // Public pages (/terms, /verify-email, …) keep their URL.
    if (isPublicRoute(window.location.pathname)) return
    const target = VIEW_PATHS[candidateActiveView]
    if (!target || window.location.pathname === target) return
    if (viewFromPath(window.location.pathname)) {
      window.history.pushState(null, "", target)
    } else {
      // Unknown path or "/" — canonicalise without adding a history entry.
      window.history.replaceState(null, "", target)
    }
    setPathname(target)
  }, [candidateActiveView])

  return pathname
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your workspace">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-card border border-bg-border bg-bg-card p-6 text-center"
    >
      <AlertTriangle className="h-8 w-8 text-sec-orange" aria-hidden="true" />
      <p className="text-[15px] font-semibold text-txt-heading">We couldn't load your workspace</p>
      <p className="text-[13px] text-txt-body">{message}</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  )
}

function AppContent() {
  const candidateActiveView = useJobStore((s) => s.candidateActiveView)
  const fetchInitialData = useJobStore((s) => s.fetchInitialData)
  const isAuthenticated = useJobStore((s) => s.isAuthenticated)
  const user = useJobStore((s) => s.user)
  const setAccessToken = useJobStore((s) => s.setAccessToken)
  const isInitialLoading = useJobStore((s) => s.isInitialLoading)
  const initialLoadError = useJobStore((s) => s.initialLoadError)

  const pathname = useViewRouting()
  const [restoring, setRestoring] = React.useState(
    () => window.location.pathname !== OAUTH_CALLBACK_PATH
  )
  const [navOpen, setNavOpen] = React.useState(false)

  // Session restore on startup (skipped on the OAuth callback, which brings its own token).
  React.useEffect(() => {
    if (window.location.pathname === OAUTH_CALLBACK_PATH) return
    let cancelled = false
    apiFetch("/auth/refresh", { method: "POST", skipAuth: true })
      .then((res) => {
        if (!cancelled && res?.accessToken) setAccessToken(res.accessToken)
      })
      .catch(() => {
        // No session: show the sign-in page.
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })
    return () => {
      cancelled = true
    }
  }, [setAccessToken])

  // Load workspace data once per login/restore, after the role is known.
  React.useEffect(() => {
    if (isAuthenticated && user?.role === "SEEKER") void fetchInitialData()
  }, [isAuthenticated, user?.id, user?.role, fetchInitialData])

  // Close the mobile drawer on navigation
  React.useEffect(() => setNavOpen(false), [candidateActiveView])

  if (pathname === OAUTH_CALLBACK_PATH) {
    return <OAuthCallback redirectTo={VIEW_PATHS.Dashboard} />
  }

  // Legal pages and e-mail links render without (and regardless of) a session.
  const publicPage = resolvePublicRoute(pathname)
  if (publicPage) return publicPage

  if (restoring) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary gap-4">
        <div
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage forcedRole="SEEKER" />
  }

  if (user?.role !== "SEEKER") {
    return <RoleMismatch requiredRole="SEEKER" currentRole={user?.role || ""} />
  }

  const renderView = () => {
    if (initialLoadError) {
      return (
        <LoadError
          message={initialLoadError}
          onRetry={() => void fetchInitialData({ force: true })}
        />
      )
    }
    if (isInitialLoading) return <LoadingSkeleton />
    switch (candidateActiveView) {
      case "Dashboard":
        return <CandidateDashboard />
      case "Discover":
        return <DiscoverJobs />
      case "Alerts":
        return <AlertsPage />
      case "Applications":
        return <ApplicationsBoard />
      case "Messages":
        return <CandidateMessages />
      case "Notifications":
        return <NotificationsPage />
      case "Calendar":
        return <CandidateCalendar />
      case "Documents":
        return <Documents />
      case "Profile":
        return <ProfilePage />
      case "Settings":
        return <SettingsPage />
      default:
        return <CandidateDashboard />
    }
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg-primary text-txt-body">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <EmailVerificationBanner />
        <Header onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-bg-primary p-4 lg:p-5">
          <div className="mx-auto w-full min-w-0 max-w-[1480px]">{renderView()}</div>
        </main>
      </div>

      {/* Floating AI Assistant bubble */}
      <AiChatWidget role="SEEKER" />
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
      <CookieNotice />
    </ToastProvider>
  )
}

export default App
