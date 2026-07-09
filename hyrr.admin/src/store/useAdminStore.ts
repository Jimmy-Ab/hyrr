import { create } from "zustand"

export type AdminView =
  | "Dashboard" | "Users" | "Recruiters" | "Companies"
  | "Jobs" | "Applications" | "Reports" | "Analytics"
  | "Momentum" | "Payments" | "Notifications" | "AuditLogs"
  | "AI" | "Settings"

export interface AdminNotification {
  id: string; title: string; time: string; read: boolean; type: string
}

export interface AdminUser {
  id: string; name: string; email: string; avatar: string
  role: "seeker" | "recruiter" | "admin"
  status: "active" | "suspended" | "pending"
  joined: string; applications: number; momentum: number
  profileComplete: number; lastLogin: string
}

export interface AdminRecruiter {
  id: string; name: string; email: string; avatar: string
  company: string; companyColor: string
  status: "verified" | "pending" | "suspended"
  activeJobs: number; totalHires: number; joined: string
}

export interface AdminCompany {
  id: string; name: string; logo: string; color: string
  status: "verified" | "pending" | "suspended"
  recruiters: number; activeJobs: number; totalHires: number
  plan: string; joined: string; country: string
}

export interface AdminJob {
  id: string; title: string; company: string; companyColor: string
  recruiter: string; status: "active" | "closed" | "draft" | "flagged"
  applicants: number; momentumCost: number; aiScore: number
  posted: string; location: string; type: string
}

export interface AdminApplication {
  id: string; candidateName: string; candidateAvatar: string
  jobTitle: string; company: string; companyColor: string
  status: string; appliedDate: string; momentumUsed: number
}

export interface AdminReport {
  id: string; type: "job" | "company" | "recruiter" | "candidate" | "message"
  target: string; reason: string; reporter: string
  status: "pending" | "resolved" | "ignored"
  date: string; severity: "low" | "medium" | "high"
}

export interface AdminPayment {
  id: string; user: string; userAvatar: string; amount: number
  currency: string; type: string; status: "succeeded" | "failed" | "refunded"
  provider: string; date: string; description: string
}

export interface AuditLog {
  id: string; actor: string; action: string; target: string
  details: string; date: string; ip: string; severity: "info" | "warning" | "critical"
}

interface AdminState {
  activeView: AdminView
  theme: "light" | "dark"
  notifications: AdminNotification[]
  users: AdminUser[]
  recruiters: AdminRecruiter[]
  companies: AdminCompany[]
  jobs: AdminJob[]
  applications: AdminApplication[]
  reports: AdminReport[]
  payments: AdminPayment[]
  auditLogs: AuditLog[]

  setActiveView: (v: AdminView) => void
  toggleTheme: () => void
  markAllRead: () => void
  clearNotifications: () => void
  updateUserStatus: (id: string, status: AdminUser["status"]) => void
  updateReportStatus: (id: string, status: AdminReport["status"]) => void
  updateCompanyStatus: (id: string, status: AdminCompany["status"]) => void
  updateJobStatus: (id: string, status: AdminJob["status"]) => void
}

export const useAdminStore = create<AdminState>((set) => ({
  activeView: "Dashboard",
  theme: "light",

  notifications: [
    { id: "n1", title: "New company registration: TechCorp Inc", time: "2 min ago", read: false, type: "company" },
    { id: "n2", title: "Payment failed for Stripe account #4892", time: "15 min ago", read: false, type: "payment" },
    { id: "n3", title: "7 new moderation reports require review", time: "1 hour ago", read: false, type: "report" },
    { id: "n4", title: "AI scoring model updated to v2.3", time: "3 hours ago", read: true, type: "system" },
    { id: "n5", title: "Platform traffic spike detected — 200% above baseline", time: "5 hours ago", read: true, type: "system" },
  ],

  users: [
    { id: "u1", name: "Emily Carter", email: "emily@example.com", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", role: "seeker", status: "active", joined: "Jan 12, 2026", applications: 6, momentum: 240, profileComplete: 78, lastLogin: "2 hours ago" },
    { id: "u2", name: "James Wilson", email: "james@example.com", avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150", role: "seeker", status: "active", joined: "Feb 3, 2026", applications: 3, momentum: 80, profileComplete: 55, lastLogin: "1 day ago" },
    { id: "u3", name: "Priya Nair", email: "priya@example.com", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150", role: "seeker", status: "suspended", joined: "Mar 15, 2026", applications: 2, momentum: 0, profileComplete: 90, lastLogin: "5 days ago" },
    { id: "u4", name: "Alex Torres", email: "alex@example.com", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150", role: "seeker", status: "active", joined: "Apr 1, 2026", applications: 12, momentum: 520, profileComplete: 95, lastLogin: "30 min ago" },
    { id: "u5", name: "Sofia Rossi", email: "sofia@example.com", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150", role: "seeker", status: "pending", joined: "Jun 28, 2026", applications: 0, momentum: 100, profileComplete: 30, lastLogin: "Just now" },
  ],

  recruiters: [
    { id: "r1", name: "Sarah Kim", email: "sarah@stripe.com", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", company: "Stripe", companyColor: "purple", status: "verified", activeJobs: 4, totalHires: 28, joined: "Jan 5, 2026" },
    { id: "r2", name: "Marcus Chen", email: "marcus@vercel.com", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", company: "Vercel", companyColor: "blue", status: "verified", activeJobs: 2, totalHires: 15, joined: "Feb 12, 2026" },
    { id: "r3", name: "Jordan Lee", email: "jordan@planetscale.com", avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150", company: "PlanetScale", companyColor: "purple", status: "pending", activeJobs: 0, totalHires: 0, joined: "Jun 30, 2026" },
    { id: "r4", name: "Emma Davis", email: "emma@notion.com", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150", company: "Notion", companyColor: "orange", status: "suspended", activeJobs: 0, totalHires: 9, joined: "Mar 20, 2026" },
  ],

  companies: [
    { id: "c1", name: "Stripe", logo: "S", color: "purple", status: "verified", recruiters: 3, activeJobs: 8, totalHires: 42, plan: "Enterprise", joined: "Jan 2026", country: "USA" },
    { id: "c2", name: "Vercel", logo: "V", color: "blue", status: "verified", recruiters: 2, activeJobs: 5, totalHires: 23, plan: "Pro", joined: "Feb 2026", country: "USA" },
    { id: "c3", name: "Notion", logo: "N", color: "orange", status: "pending", recruiters: 1, activeJobs: 2, totalHires: 6, plan: "Starter", joined: "Jun 2026", country: "USA" },
    { id: "c4", name: "Linear", logo: "L", color: "green", status: "verified", recruiters: 2, activeJobs: 3, totalHires: 18, plan: "Pro", joined: "Mar 2026", country: "USA" },
    { id: "c5", name: "Figma", logo: "F", color: "green", status: "suspended", recruiters: 0, activeJobs: 0, totalHires: 31, plan: "Enterprise", joined: "Jan 2026", country: "USA" },
  ],

  jobs: [
    { id: "j1", title: "Senior Frontend Engineer", company: "Stripe", companyColor: "purple", recruiter: "Sarah Kim", status: "active", applicants: 48, momentumCost: 120, aiScore: 94, posted: "2 days ago", location: "San Francisco, CA", type: "Full Time" },
    { id: "j2", title: "Product Designer", company: "Vercel", companyColor: "blue", recruiter: "Marcus Chen", status: "active", applicants: 32, momentumCost: 80, aiScore: 88, posted: "1 day ago", location: "Remote", type: "Remote" },
    { id: "j3", title: "Data Scientist", company: "Figma", companyColor: "green", recruiter: "Priya Nair", status: "flagged", applicants: 15, momentumCost: 100, aiScore: 76, posted: "5 days ago", location: "San Francisco, CA", type: "Full Time" },
    { id: "j4", title: "Backend Engineer", company: "Linear", companyColor: "green", recruiter: "Alex Torres", status: "active", applicants: 27, momentumCost: 90, aiScore: 91, posted: "3 days ago", location: "New York, NY", type: "Full Time" },
    { id: "j5", title: "iOS Engineer", company: "Notion", companyColor: "orange", recruiter: "Emma Davis", status: "draft", applicants: 0, momentumCost: 60, aiScore: 0, posted: "—", location: "Remote", type: "Remote" },
  ],

  applications: [
    { id: "a1", candidateName: "Emily Carter", candidateAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", jobTitle: "Senior Frontend Engineer", company: "Stripe", companyColor: "purple", status: "In Process", appliedDate: "3 days ago", momentumUsed: 20 },
    { id: "a2", candidateName: "Alex Torres", candidateAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150", jobTitle: "Backend Engineer", company: "Linear", companyColor: "green", status: "Applied", appliedDate: "4 days ago", momentumUsed: 15 },
    { id: "a3", candidateName: "James Wilson", candidateAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150", jobTitle: "Product Designer", company: "Vercel", companyColor: "blue", status: "Offer", appliedDate: "1 week ago", momentumUsed: 10 },
    { id: "a4", candidateName: "Priya Nair", candidateAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150", jobTitle: "Data Scientist", company: "Figma", companyColor: "green", status: "Archived", appliedDate: "2 weeks ago", momentumUsed: 5 },
  ],

  reports: [
    { id: "rp1", type: "job", target: "Data Scientist — Figma", reason: "Misleading salary information", reporter: "Emily Carter", status: "pending", date: "2 hours ago", severity: "medium" },
    { id: "rp2", type: "recruiter", target: "Emma Davis — Notion", reason: "Unprofessional communication", reporter: "James Wilson", status: "pending", date: "5 hours ago", severity: "high" },
    { id: "rp3", type: "company", target: "Unknown Corp", reason: "Suspected fake company listing", reporter: "Sofia Rossi", status: "pending", date: "1 day ago", severity: "high" },
    { id: "rp4", type: "candidate", target: "Anonymous User", reason: "Spam applications to multiple listings", reporter: "Sarah Kim", status: "resolved", date: "2 days ago", severity: "low" },
    { id: "rp5", type: "message", target: "Chat Room #48291", reason: "Inappropriate content in chat", reporter: "System", status: "ignored", date: "3 days ago", severity: "medium" },
  ],

  payments: [
    { id: "pay1", user: "Emily Carter", userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", amount: 49.99, currency: "USD", type: "Momentum Purchase", status: "succeeded", provider: "Stripe", date: "Jul 3, 2026", description: "250 Momentum Credits" },
    { id: "pay2", user: "Stripe Inc", userAvatar: "", amount: 299.00, currency: "USD", type: "Enterprise Plan", status: "succeeded", provider: "Stripe", date: "Jul 1, 2026", description: "Monthly Enterprise Subscription" },
    { id: "pay3", user: "Alex Torres", userAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150", amount: 19.99, currency: "USD", type: "Momentum Purchase", status: "failed", provider: "PayPal", date: "Jun 30, 2026", description: "100 Momentum Credits" },
    { id: "pay4", user: "Vercel Inc", userAvatar: "", amount: 99.00, currency: "USD", type: "Pro Plan", status: "succeeded", provider: "Stripe", date: "Jun 28, 2026", description: "Monthly Pro Subscription" },
    { id: "pay5", user: "James Wilson", userAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150", amount: 9.99, currency: "USD", type: "Momentum Purchase", status: "refunded", provider: "Stripe", date: "Jun 25, 2026", description: "50 Momentum Credits (refunded)" },
  ],

  auditLogs: [
    { id: "al1", actor: "Super Admin", action: "USER_SUSPEND", target: "Priya Nair (u3)", details: "Suspended for ToS violation #24B", date: "2 hours ago", ip: "192.168.1.1", severity: "critical" },
    { id: "al2", actor: "System", action: "JOB_FLAGGED", target: "Data Scientist — Figma (j3)", details: "AI moderation flagged suspicious content", date: "3 hours ago", ip: "—", severity: "warning" },
    { id: "al3", actor: "Super Admin", action: "COMPANY_VERIFY", target: "Stripe (c1)", details: "Manual verification completed", date: "1 day ago", ip: "192.168.1.1", severity: "info" },
    { id: "al4", actor: "System", action: "PAYMENT_FAILED", target: "Alex Torres — $19.99", details: "Card declined: insufficient funds", date: "1 day ago", ip: "—", severity: "warning" },
    { id: "al5", actor: "Sarah Kim", action: "JOB_CREATE", target: "Senior Frontend Engineer (j1)", details: "New job posted and published", date: "2 days ago", ip: "10.0.0.42", severity: "info" },
    { id: "al6", actor: "Super Admin", action: "AI_MODEL_UPDATE", target: "Scoring Engine v2.3", details: "AI scoring weights recalibrated", date: "3 days ago", ip: "192.168.1.1", severity: "info" },
  ],

  setActiveView: (v) => set({ activeView: v }),
  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearNotifications: () => set({ notifications: [] }),
  updateUserStatus: (id, status) => set((s) => ({ users: s.users.map((u) => u.id === id ? { ...u, status } : u) })),
  updateReportStatus: (id, status) => set((s) => ({ reports: s.reports.map((r) => r.id === id ? { ...r, status } : r) })),
  updateCompanyStatus: (id, status) => set((s) => ({ companies: s.companies.map((c) => c.id === id ? { ...c, status } : c) })),
  updateJobStatus: (id, status) => set((s) => ({ jobs: s.jobs.map((j) => j.id === id ? { ...j, status } : j) })),
}))
