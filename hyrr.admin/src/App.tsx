import { ToastProvider } from "hyrr.shared"
import { AdminHeader } from "./components/layout/header"
import { AdminSidebar } from "./components/layout/sidebar"
import { useAdminStore } from "./store/useAdminStore"

// Pages
import { AIManagementPage } from "./pages/AI"
import { AnalyticsPage } from "./pages/Analytics"
import { ApplicationsPage } from "./pages/Applications"
import { AuditLogsPage } from "./pages/AuditLogs"
import { CompaniesPage } from "./pages/Companies"
import { AdminDashboard } from "./pages/Dashboard"
import { JobsPage } from "./pages/Jobs"
import { MomentumPage } from "./pages/Momentum"
import { NotificationsPage } from "./pages/Notifications"
import { PaymentsPage } from "./pages/Payments"
import { RecruitersPage } from "./pages/Recruiters"
import { ReportsPage } from "./pages/Reports"
import { PlatformSettingsPage } from "./pages/Settings"
import { UsersPage } from "./pages/Users"

function AppContent() {
  const { activeView } = useAdminStore()

  const renderActiveView = () => {
    switch (activeView) {
      case "Dashboard":
        return <AdminDashboard />
      case "Users":
        return <UsersPage />
      case "Recruiters":
        return <RecruitersPage />
      case "Companies":
        return <CompaniesPage />
      case "Jobs":
        return <JobsPage />
      case "Applications":
        return <ApplicationsPage />
      case "Reports":
        return <ReportsPage />
      case "Analytics":
        return <AnalyticsPage />
      case "Momentum":
        return <MomentumPage />
      case "Payments":
        return <PaymentsPage />
      case "Notifications":
        return <NotificationsPage />
      case "AuditLogs":
        return <AuditLogsPage />
      case "AI":
        return <AIManagementPage />
      case "Settings":
        return <PlatformSettingsPage />
      default:
        return <AdminDashboard />
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary text-txt-body">
      <AdminHeader />
      <div className="flex flex-1 h-[calc(100vh-68px)] overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-8 bg-bg-primary">
          <div className="max-w-[1440px] mx-auto w-full h-full">{renderActiveView()}</div>
        </main>
      </div>
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
