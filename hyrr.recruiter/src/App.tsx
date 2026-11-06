import {
  AiChatWidget,
  AuthPage,
  Button,
  CookieNotice,
  EmailVerificationBanner,
  OAuthCallback,
  PageTransition,
  RoleMismatch,
  Skeleton,
  ToastProvider,
  apiFetch,
  isPublicRoute,
  resolvePublicRoute,
  useSmoothScroll,
} from "hyrr.shared"
import { AlertTriangle, RefreshCw } from "lucide-react"
import * as React from "react"
import { AddCandidateDialog } from "./components/layout/add-candidate-dialog"
import { AddJobDialog } from "./components/layout/add-job-dialog"
import { CandidateDetailDialog } from "./components/layout/candidate-detail-dialog"
import { Header } from "./components/layout/header"
import { Sidebar } from "./components/layout/sidebar"
import { pathToView, viewToPath } from "./lib/recruiter"
import { Analytics } from "./pages/Analytics"
import { Applications } from "./pages/Applications"
import { CalendarPage } from "./pages/CalendarPage"
import { Candidates } from "./pages/Candidates"
import { Dashboard } from "./pages/Dashboard"
import { Jobs } from "./pages/Jobs"
import { Messages } from "./pages/Messages"
import { Momentum } from "./pages/Momentum"
import { Settings } from "./pages/Settings"
import { useJobStore } from "./store/useJobStore"

const AUTH_CALLBACK_PATH = "/auth/callback"

// Initial view comes from the URL so reloads and deep links land on the right page.
const initialView = pathToView(window.location.pathname)
if (initialView) useJobStore.getState().setActiveView(initialView)

/** Keeps the store's activeView and the URL path in sync (pushState + popstate). */
function useViewRouting(enabled: boolean) {
  const activeView = useJobStore((s) => s.activeView)
  const setActiveView = useJobStore((s) => s.setActiveView)

  React.useEffect(() => {
    if (!enabled) return
    const syncFromPath = () => {
      const view = pathToView(window.location.pathname)
      if (view && view !== useJobStore.getState().activeView) setActiveView(view)
    }
    // The URL may have changed while routing was disabled (e.g. OAuth callback redirect).
    syncFromPath()
    window.addEventListener("popstate", syncFromPath)
    return () => window.removeEventListener("popstate", syncFromPath)
  }, [enabled, setActiveView])

  React.useEffect(() => {
    if (!enabled) return
    // Public pages (/terms, /privacy, token links) own their URL; never rewrite them.
    if (isPublicRoute(window.location.pathname)) return
    // Read the live value: the effect above may have just updated it synchronously.
    const path = viewToPath(useJobStore.getState().activeView)
    if (window.location.pathname === path) return
    // Unknown / root paths are replaced so Back doesn't land on a blank route.
    if (pathToView(window.location.pathname)) {
      window.history.pushState(null, "", path)
    } else {
      window.history.replaceState(null, "", path)
    }
  }, [enabled, activeView])
}

function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading workspace">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-card" />
    </div>
  )
}

function AppContent() {
  const {
    activeView,
    isAuthenticated,
    user,
    setAccessToken,
    logout,
    isInitialLoading,
    initialLoadError,
    fetchInitialData,
  } = useJobStore()

  const [loading, setLoading] = React.useState(true)
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [mainEl, setMainEl] = React.useState<HTMLElement | null>(null)
  useSmoothScroll(mainEl, activeView)
  const isCallback = window.location.pathname === AUTH_CALLBACK_PATH
  // Legal pages and e-mail token links (verify / reset password) render without a session.
  const publicRoute = isCallback ? null : resolvePublicRoute(window.location.pathname)
  const isPublic = publicRoute != null

  // Silent refresh on startup (session restore). The store loads the role's data
  // once the access token (and therefore the role) is known.
  React.useEffect(() => {
    if (isCallback || isPublic) {
      setLoading(false)
      return
    }
    async function silentRefresh() {
      try {
        const res = await apiFetch("/auth/refresh", { method: "POST", skipAuth: true })
        if (res.accessToken) {
          setAccessToken(res.accessToken)
          // Session restore: load data once, now that the role is known. (Login/register
          // trigger their own load inside the store; silent token refreshes do not.)
          if (useJobStore.getState().user?.role === "RECRUITER") {
            void fetchInitialData()
          }
        }
      } catch {
        logout()
      } finally {
        setLoading(false)
      }
    }
    silentRefresh()
  }, [isCallback, isPublic, setAccessToken, logout, fetchInitialData])

  const isRecruiter = isAuthenticated && user?.role === "RECRUITER"
  useViewRouting(isRecruiter && !isCallback && !isPublic)

  // Close the mobile drawer whenever the view changes.
  React.useEffect(() => {
    setSidebarOpen(false)
  }, [activeView])

  if (isCallback) {
    return <OAuthCallback />
  }

  if (publicRoute) return <>{publicRoute}</>

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary gap-4">
        <div
          role="status"
          aria-label="Loading"
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"
        />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage forcedRole="RECRUITER" />
  }

  if (user?.role !== "RECRUITER") {
    return <RoleMismatch requiredRole="RECRUITER" currentRole={user?.role || ""} />
  }

  const renderView = () => {
    if (isInitialLoading) return <ContentSkeleton />
    if (initialLoadError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 py-24 text-center"
        >
          <AlertTriangle className="w-10 h-10 text-sec-red" />
          <div>
            <h2 className="text-[18px] font-semibold text-txt-heading">
              We couldn't load your workspace
            </h2>
            <p className="text-body text-txt-body mt-1">{initialLoadError}</p>
          </div>
          <Button onClick={() => fetchInitialData({ force: true })} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      )
    }
    switch (activeView) {
      case "Dashboard":
        return <Dashboard />
      case "Jobs":
        return <Jobs />
      case "Candidates":
        return <Candidates />
      case "Applications":
        return <Applications />
      case "Calendar":
        return <CalendarPage />
      case "Messages":
        return <Messages />
      case "Analytics":
        return <Analytics />
      case "Momentum":
        return <Momentum />
      case "Settings":
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex flex-col h-dvh w-full overflow-hidden bg-bg-primary text-txt-body">
      {/* Top Header */}
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <EmailVerificationBanner />

      {/* Main Container */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar (static on lg+, off-canvas drawer below) */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Right Scrollable Content Area */}
        <main
          ref={setMainEl}
          className="app-canvas flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-8"
        >
          <div className="max-w-[1440px] mx-auto w-full h-full">
            <PageTransition viewKey={activeView}>{renderView()}</PageTransition>
          </div>
        </main>
      </div>

      {/* Global Dialogs & Widgets */}
      <AddCandidateDialog />
      <AddJobDialog />
      <CandidateDetailDialog />
      <AiChatWidget role="RECRUITER" />
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
