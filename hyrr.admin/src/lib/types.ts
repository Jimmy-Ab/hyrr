/** Admin API payloads (CONTRACT7). Shapes come from the backend; keep them in sync. */

export type Page<T> = { items: T[]; nextCursor: string | null }

export type Period = "today" | "week" | "month" | "year"

export type MetricKey =
  | "newUsers"
  | "newSeekers"
  | "newRecruiters"
  | "newCompanies"
  | "jobsPublished"
  | "applications"
  | "offers"
  | "messages"
  | "revenueUsdCents"
  | "revenueEtbCents"
  | "creditsSpent"
  | "activeUsers"

export type Metric = { current: number; previous: number; sparkline: number[] }
export type HealthState = "ok" | "disabled" | "error"
export type Range = { from: string; to: string }

export type Dashboard = {
  period: Period
  range: Range
  previousRange: Range
  metrics: Record<MetricKey, Metric>
  totals: {
    liveJobs: number
    users: number
    seekers: number
    recruiters: number
    companies: number
    openApplications: number
  }
  attention: {
    flaggedJobs: number
    pendingReports: number
    failedPayments24h: number
    failedQueueJobs: number
    aiProvider: "ok" | "disabled"
  }
  health: {
    db: HealthState
    redis: HealthState
    queues: HealthState
    search: HealthState
    email: HealthState
  }
}

export type SeriesKey =
  | "signupsSeekers"
  | "signupsRecruiters"
  | "companies"
  | "jobsPublished"
  | "applications"
  | "revenueUsdCents"
  | "revenueEtbCents"
  | "creditsBought"
  | "creditsSpent"
  | "activeUsers"

export type Point = { t: string; v: number }
export type Interval = "day" | "week" | "month"

export type Analytics = {
  range: Range
  interval: Interval
  series: Record<SeriesKey, Point[]>
  previousTotals: Record<SeriesKey, number>
  totals: Record<SeriesKey, number>
  health: {
    appsPerJobAvg: number
    appsPerJobMedian: number
    zeroApplicantJobsPct: number
    medianHoursToFirstApplication: number | null
    funnel: { stage: string; reached: number; conversion: number }[]
    offerRate: number
  }
  breakdowns: {
    categories: { name: string; jobs: number; applications: number }[]
    locations: { name: string; jobs: number }[]
    companiesByApplications: { id: string; name: string; value: number }[]
    companiesBySpend: { id: string; name: string; value: number }[]
    remote: { remote: number; onsite: number }
    employmentTypes: { type: string; jobs: number }[]
  }
  money: {
    byProvider: { provider: string; usdCents: number; etbCents: number; count: number }[]
    byKind: { kind: string; count: number; usdCents: number; etbCents: number }[]
    avgOrderUsdCents: number
    payingCompanies: number
    payingSeekers: number
    spentByType: { type: string; credits: number }[]
  }
  cohorts: { month: string; joined: number; activeAfter30d: number; pct: number }[]
}

export type CompanyRef = { id: string; name: string }

export type ModerationItem = {
  job: {
    id: string
    title: string
    status: string
    publishedAt: string | null
    company: { id: string; name: string; verified: boolean; status: string }
  }
  reports: {
    total: number
    pending: number
    reasons: { reason: string; count: number }[]
    lastAt: string | null
  }
}

export type ModerationDetail = {
  job: {
    id: string
    title: string
    status: string
    description?: string | null
    location?: string | null
    publishedAt?: string | null
    createdAt?: string | null
    company?: { id: string; name: string; verified?: boolean; status?: string } | null
    recruiter?: { id: string; name: string; email: string } | null
    [key: string]: unknown
  }
  reports: {
    id: string
    reason: string
    details: string | null
    status: string
    createdAt: string
    reporter: { id: string; name: string } | null
  }[]
  companyHistory: { flaggedJobs: number; removedJobs: number; verified: boolean; status: string }
}

export type AuditRow = {
  id: string
  actor: { id: string; name: string; email: string } | null
  action: string
  target: string
  details: string
  meta: Record<string, unknown> | null
  ip: string | null
  severity: "info" | "warning" | "critical" | string
  createdAt: string
}

export type UserRole = "SEEKER" | "RECRUITER" | "ADMIN"
export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING"

export type AdminUser = {
  id: string
  name: string
  email: string
  avatar: string | null
  role: UserRole
  status: UserStatus
  emailVerified: boolean
  twoFactorEnabled: boolean
  joinedAt: string
  lastActiveAt: string | null
  company: CompanyRef | null
}

export type AdminUserDetail = AdminUser & {
  seeker: {
    title: string | null
    location: string | null
    applications: number
    profileStrength: number
  } | null
  wallet: { balance: number } | null
  recent: { applications: number; jobsPosted: number; messages30d: number }
  audit: AuditRow[]
}

export type CompanyStatus = "VERIFIED" | "PENDING" | "SUSPENDED"

export type AdminCompany = {
  id: string
  name: string
  logo: string | null
  verified: boolean
  status: CompanyStatus
  joinedAt: string
  members: number
  jobs: number
  liveJobs: number
  balance: number
  plan: string | null
}

export type LedgerRow = {
  id: string
  amount: number
  type: string
  balanceAfter: number
  note: string | null
  createdAt: string
}

export type AdminPayment = {
  id: string
  provider: string
  providerRef: string | null
  kind: string
  status: string
  amount: number
  currency: string
  credits: number
  description: string | null
  createdAt: string
  paidAt: string | null
  owner: { type: "company" | "seeker"; id: string; name: string } | null
}

export type AdminCompanyDetail = Omit<AdminCompany, "members" | "jobs"> & {
  website: string | null
  verifiedDomain: string | null
  members: { id: string; name: string; email: string; role: string; status: string }[]
  jobs: { id: string; title: string; status: string; applicants: number }[]
  wallet: { balance: number; recent: LedgerRow[] } | null
  payments: AdminPayment[]
  subscription: {
    planCode?: string
    plan?: { name?: string } | null
    status?: string
    currentPeriodEnd?: string
  } | null
  audit: AuditRow[]
  invites: {
    id: string
    email: string
    role: string
    createdAt: string
    expiresAt: string
    expired: boolean
  }[]
  joinRequests: {
    id: string
    createdAt: string
    user: { id: string; name: string; email: string }
  }[]
}

export type MomentumConfig = {
  publishBase: number
  multipliers: { remote: number; highSalary: number; featuredCategory: number }
  highSalaryThresholdUsd: number
  featureCost: number
  featureDays: number
  aiRerunCost: number
  signupBonus: number
  applyCost: number
  outreachCost: number
  externalApplyCost: number
  resumeTailorCost: number
  mockInterviewCost: number
  negotiationAdviceCost: number
  seekerSignupBonus: number
  source?: Record<string, "defaults" | "env" | "settings">
}

export type CreditPackage = {
  id: string
  code: string
  name: string
  audience: "RECRUITER" | "SEEKER"
  credits: number
  bonusCredits: number
  priceUsdCents: number
  priceEtbCents: number
  active: boolean
  sortOrder?: number
}

export type Plan = {
  id: string
  code: string
  name: string
  monthlyCredits: number
  seatLimit: number | null
  priceUsdCents: number
  active: boolean
  sortOrder?: number
}

export type AiSettings = {
  activeModel: string
  temperature: number
  systemPrompt: string
  availableModels: string[]
  resolvedModel: string | null
  provider: string | null
  configuredProviders: string[]
}

export type SystemStatus = {
  ai: {
    providers: { openai: boolean; anthropic: boolean; google: boolean }
    activeModel: string | null
    embeddings: boolean
  }
  email: boolean
  payments: { stripe: boolean; chapa: boolean }
  storage: "local" | "s3" | string
  search: "meili" | "postgres" | string
  queues: "bullmq" | "inline" | string
  captcha: boolean
  sentry: boolean
}
