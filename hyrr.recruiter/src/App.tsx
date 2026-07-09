import * as React from "react"
import { Header } from "./components/layout/header"
import { Sidebar } from "./components/layout/sidebar"
import { ToastProvider } from "./components/ui/toast"
import { useJobStore } from "./store/useJobStore"
import { Dashboard } from "./pages/Dashboard"
import { Jobs } from "./pages/Jobs"
import { Candidates } from "./pages/Candidates"
import { Applications } from "./pages/Applications"
import { CalendarPage } from "./pages/CalendarPage"
import { Messages } from "./pages/Messages"
import { Analytics } from "./pages/Analytics"
import { AddCandidateDialog } from "./components/layout/add-candidate-dialog"
import { AddJobDialog } from "./components/layout/add-job-dialog"
import { AuthPage, OAuthCallback, apiFetch } from "hyrr.shared"

function AppContent() {
  const {
    activeView, theme, fetchInitialData,
    isAuthenticated, setAccessToken, logout
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
    if (isAuthenticated) {
      fetchInitialData()
    }
  }, [isAuthenticated, fetchInitialData])

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
    return <AuthPage forcedRole="RECRUITER" />
  }

  const renderView = () => {
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
      default:
        return <Applications />
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

      {/* Global Dialogs */}
      <AddCandidateDialog />
      <AddJobDialog />
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
