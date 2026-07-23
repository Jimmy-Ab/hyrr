import * as React from "react"
import { Header } from "./components/layout/header"
import { Sidebar } from "./components/layout/sidebar"
import { ToastProvider, AuthPage, OAuthCallback, RoleMismatch, apiFetch, AiChatWidget } from "hyrr.shared"
import { useJobStore } from "hyrr.shared"

// Pages
import { CandidateDashboard } from "./pages/Dashboard"
import { DiscoverJobs } from "./pages/DiscoverJobs"
import { ApplicationsBoard } from "./pages/Applications"
import { CandidateMessages } from "./pages/Messages"
import { NotificationsPage } from "./pages/Notifications"
import { CandidateCalendar } from "./pages/CalendarPage"
import { Documents } from "./pages/Documents"
import { ProfilePage } from "./pages/ProfilePage"
import { SettingsPage } from "./pages/Settings"

function AppContent() {
  const {
    candidateActiveView, theme, fetchInitialData,
    isAuthenticated, user, setAccessToken, logout
  } = useJobStore()

  const [loading, setLoading] = React.useState(true)

  // Silent refresh on startup
  React.useEffect(() => {
    async function silentRefresh() {
      try {
        const res = await apiFetch('/auth/refresh', { method: 'POST', skipAuth: true })
        if (res.accessToken) {
          setAccessToken(res.accessToken)
        }
      } catch {
        logout()
      } finally {
        setLoading(false)
      }
    }
    silentRefresh()
  }, [setAccessToken, logout])

  React.useEffect(() => {
    if (isAuthenticated && user?.role === "SEEKER") {
      fetchInitialData()
    }
  }, [isAuthenticated, user?.role, fetchInitialData])

  React.useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [theme])

  // Simple client-side landing path routing
  if (window.location.pathname === "/auth/callback") {
    return <OAuthCallback />
  }

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-bg-primary gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
    switch (candidateActiveView) {
      case "Dashboard": return <CandidateDashboard />
      case "Discover": return <DiscoverJobs />
      case "Applications": return <ApplicationsBoard />
      case "Messages": return <CandidateMessages />
      case "Notifications": return <NotificationsPage />
      case "Calendar": return <CandidateCalendar />
      case "Documents": return <Documents />
      case "Profile": return <ProfilePage />
      case "Settings": return <SettingsPage />
      default: return <CandidateDashboard />
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary text-txt-body">
      {/* Top Header */}
      <Header />

      {/* Main Container */}
      <div className="flex flex-1 h-[calc(100vh-68px)] overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Right Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-bg-primary">
          <div className="max-w-[1440px] mx-auto w-full h-full">
            {renderView()}
          </div>
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
    </ToastProvider>
  )
}

export default App
