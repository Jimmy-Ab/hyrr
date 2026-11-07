import {
  AuthPage,
  Button,
  PageTransition,
  RoleMismatch,
  ToastProvider,
  TwoFactorSettings,
  apiFetch,
  isPublicRoute,
  resolvePublicRoute,
  useJobStore,
  useSmoothScroll,
} from "hyrr.shared"
import { ArrowRight, LogOut, ShieldCheck } from "lucide-react"
import * as React from "react"
import { Header } from "./components/layout/header"
import { Sidebar } from "./components/layout/sidebar"
import { queryClient, useGate } from "./lib/api"
import { pathToView, useNav, viewToPath } from "./lib/nav"
import { Analytics } from "./pages/Analytics"
import { AuditLog } from "./pages/AuditLog"
import { Companies } from "./pages/Companies"
import { Dashboard } from "./pages/Dashboard"
import { Moderation } from "./pages/Moderation"
import { Money } from "./pages/Money"
import { Settings } from "./pages/Settings"
import { Users } from "./pages/Users"

/** Keeps the active view and the URL path in sync (pushState + popstate). */
function useViewRouting(enabled: boolean) {
  const view = useNav((s) => s.view)

  React.useEffect(() => {
    if (!enabled) return
    const syncFromPath = () => {
      const next = pathToView(window.location.pathname)
      if (next && next !== useNav.getState().view) useNav.getState().go(next)
    }
    syncFromPath()
    window.addEventListener("popstate", syncFromPath)
    return () => window.removeEventListener("popstate", syncFromPath)
  }, [enabled])

  React.useEffect(() => {
    if (!enabled) return
    if (isPublicRoute(window.location.pathname)) return
    const path = viewToPath(useNav.getState().view)
    if (window.location.pathname === path) return
    if (pathToView(window.location.pathname)) window.history.pushState(null, "", path)
    else window.history.replaceState(null, "", path)
  }, [enabled, view])
}

/** Full-page "Set up two-factor" shown when the API answers 403 TWO_FACTOR_REQUIRED. */
function TwoFactorGate() {
  const enabled = useJobStore((s) => !!s.user?.twoFactorEnabled)
  const logout = useJobStore((s) => s.logout)
  const setGate = useGate((s) => s.set)

  const proceed = () => {
    setGate(false)
    void queryClient.invalidateQueries()
  }

  return (
    <div className="app-canvas flex min-h-dvh w-full items-start justify-center overflow-y-auto bg-bg-primary px-4 py-12 md:py-20">
      <div className="w-full max-w-[560px]">
        <div className="tone-violet mb-6 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--tone-bg)] text-[var(--tone-fg)] ring-1 ring-[var(--tone-ring)]">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.02em] text-txt-title">
              Set up two-factor
            </h1>
            <p className="text-[13.5px] text-txt-body">
              The admin console requires an authenticator app on every admin account.
            </p>
          </div>
        </div>
        <div className="rounded-card border border-bg-border bg-bg-secondary p-6 shadow-card">
          <TwoFactorSettings />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
          <Button size="sm" disabled={!enabled} onClick={proceed}>
            Continue to admin <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {enabled && (
          <p className="mt-3 text-right text-[12px] text-txt-caption">
            Save your recovery codes before you continue.
          </p>
        )}
      </div>
    </div>
  )
}

function renderView(view: string) {
  switch (view) {
    case "analytics":
      return <Analytics />
    case "moderation":
      return <Moderation />
    case "users":
      return <Users />
    case "companies":
      return <Companies />
    case "money":
      return <Money />
    case "settings":
      return <Settings />
    case "audit":
      return <AuditLog />
    default:
      return <Dashboard />
  }
}

function AppContent() {
  const isAuthenticated = useJobStore((s) => s.isAuthenticated)
  const user = useJobStore((s) => s.user)
  const setAccessToken = useJobStore((s) => s.setAccessToken)
  const fetchInitialData = useJobStore((s) => s.fetchInitialData)
  const logout = useJobStore((s) => s.logout)
  const view = useNav((s) => s.view)
  const twoFactorRequired = useGate((s) => s.twoFactorRequired)

  const [loading, setLoading] = React.useState(true)
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [mainEl, setMainEl] = React.useState<HTMLElement | null>(null)
  useSmoothScroll(mainEl, view)

  const publicRoute = resolvePublicRoute(window.location.pathname)
  const isPublic = publicRoute != null

  React.useEffect(() => {
    if (isPublic) {
      setLoading(false)
      return
    }
    async function silentRefresh() {
      try {
        const res = await apiFetch("/auth/refresh", { method: "POST", skipAuth: true })
        if (res.accessToken) {
          setAccessToken(res.accessToken)
          if (useJobStore.getState().user?.role === "ADMIN") void fetchInitialData()
        }
      } catch {
        void logout()
      } finally {
        setLoading(false)
      }
    }
    void silentRefresh()
  }, [isPublic, setAccessToken, fetchInitialData, logout])

  // A different (or no) account starts with a clean cache and gate.
  const userId = user?.id ?? null
  React.useEffect(() => {
    queryClient.clear()
    useGate.getState().set(false)
  }, [userId])

  const isAdmin = isAuthenticated && user?.role === "ADMIN"
  useViewRouting(isAdmin && !isPublic)

  React.useEffect(() => {
    setSidebarOpen(false)
  }, [view])

  if (publicRoute) return <>{publicRoute}</>

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary">
        <div
          role="status"
          aria-label="Loading"
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"
        />
      </div>
    )
  }

  if (!isAuthenticated) return <AuthPage forcedRole="ADMIN" />

  if (user?.role !== "ADMIN") {
    return <RoleMismatch requiredRole="ADMIN" currentRole={user?.role || ""} />
  }

  if (twoFactorRequired) return <TwoFactorGate />

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-bg-primary text-txt-body">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          ref={setMainEl}
          className="app-canvas min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8"
        >
          <div className="mx-auto h-full w-full max-w-[1440px]">
            <PageTransition viewKey={view}>{renderView(view)}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
