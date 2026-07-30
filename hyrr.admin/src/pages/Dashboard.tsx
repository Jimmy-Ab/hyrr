import { Badge, Card, useToast } from "hyrr.shared"
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  DollarSign,
  FileText,
  Flag,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// Date format matching May 19, May 26, Jun 2, Jun 9, Jun 16
const overviewData = [
  { name: "May 19", Users: 12000, Jobs: 4500, Applications: 18000, Revenue: 22000 },
  { name: "May 26", Users: 15400, Jobs: 5100, Applications: 21000, Revenue: 29000 },
  { name: "Jun 2", Users: 14200, Jobs: 4900, Applications: 20000, Revenue: 34000 },
  { name: "Jun 9", Users: 18450, Jobs: 7245, Applications: 24532, Revenue: 45230 },
  { name: "Jun 16", Users: 19800, Jobs: 8100, Applications: 27000, Revenue: 51000 },
]

const aiPieData = [
  { name: "AI Job Scoring", value: 42450, color: "#6C63FF", pct: "33%" },
  { name: "Resume Matching", value: 38650, color: "#4F8EF7", pct: "30%" },
  { name: "Recommendations", value: 27350, color: "#34C759", pct: "21%" },
  { name: "Other AI Features", value: 19000, color: "#FFB547", pct: "16%" },
]

const statCards = [
  {
    label: "Total Users",
    value: "24,532",
    delta: "+12.5%",
    up: true,
    icon: Users,
    bg: "bg-primary-light",
    text: "text-primary",
    border: "border-primary/20",
  },
  {
    label: "Recruiters",
    value: "1,842",
    delta: "+8.3%",
    up: true,
    icon: Users,
    bg: "bg-sec-blue/10",
    text: "text-sec-blue",
    border: "border-sec-blue/20",
  },
  {
    label: "Companies",
    value: "3,567",
    delta: "+10.1%",
    up: true,
    icon: Building2,
    bg: "bg-sec-green/10",
    text: "text-sec-green",
    border: "border-sec-green/20",
  },
  {
    label: "Active Jobs",
    value: "9,689",
    delta: "+15.7%",
    up: true,
    icon: Briefcase,
    bg: "bg-sec-orange/10",
    text: "text-sec-orange",
    border: "border-sec-orange/20",
  },
  {
    label: "Applications",
    value: "78,432",
    delta: "+18.2%",
    up: true,
    icon: FileText,
    bg: "bg-primary-light",
    text: "text-primary",
    border: "border-primary/20",
  },
  {
    label: "Revenue",
    value: "$125,430",
    delta: "+20.6%",
    up: true,
    icon: DollarSign,
    bg: "bg-sec-green/10",
    text: "text-sec-green",
    border: "border-sec-green/20",
  },
  {
    label: "Momentum in Circulation",
    value: "312,450",
    delta: "+14.3%",
    up: true,
    icon: Zap,
    bg: "bg-primary-light",
    text: "text-primary",
    border: "border-primary/20",
  },
  {
    label: "Pending Reports",
    value: "23",
    delta: "-8.7%",
    up: false,
    icon: Flag,
    bg: "bg-sec-red/10",
    text: "text-sec-red",
    border: "border-sec-red/20",
  },
]

const recentActivities = [
  {
    text: "New company registered: TechNova Solutions Ltd.",
    time: "2 minutes ago",
    type: "company",
  },
  { text: "New job posted: Senior Backend Developer", time: "15 minutes ago", type: "job" },
  { text: "New user registered: Sarah Johnson", time: "32 minutes ago", type: "user" },
  { text: "Payment received: Momentum Purchase - $49.00", time: "1 hour ago", type: "payment" },
]

const latestSignups = [
  {
    name: "Sarah Johnson",
    role: "Candidate",
    time: "2 minutes ago",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80",
  },
  {
    name: "Michael Chen",
    role: "Recruiter",
    time: "8 minutes ago",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80",
  },
  {
    name: "TechNova Solutions",
    role: "Company",
    time: "15 minutes ago",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80",
  },
  {
    name: "Emily Davis",
    role: "Candidate",
    time: "18 minutes ago",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80",
  },
  {
    name: "David Wilson",
    role: "Recruiter",
    time: "25 minutes ago",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80",
  },
]

const recentPayments = [
  { desc: "Momentum Purchase", user: "by Sarah Johnson", amount: "$49.00", status: "Success" },
  {
    desc: "Company Subscription",
    user: "by TechNova Solutions",
    amount: "$199.00",
    status: "Success",
  },
  { desc: "Momentum Purchase", user: "by Michael Chen", amount: "$29.00", status: "Success" },
  {
    desc: "Featured Job Upgrade",
    user: "by Bright Future Ltd.",
    amount: "$89.00",
    status: "Pending",
  },
  { desc: "Company Subscription", user: "by InnovateX Inc.", amount: "$299.00", status: "Success" },
]

const systemStatus = [
  { name: "Web Application", status: "Operational" },
  { name: "API Services", status: "Operational" },
  { name: "Database", status: "Operational" },
  { name: "AI Services", status: "Operational" },
  { name: "File Storage", status: "Operational" },
  { name: "Payment Gateway", status: "Operational" },
]

const activityDot: Record<string, string> = {
  company: "bg-sec-orange",
  job: "bg-primary",
  user: "bg-sec-blue",
  payment: "bg-sec-green",
}

export function AdminDashboard() {
  const { toast } = useToast()

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Upper Title Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold text-txt-title tracking-tight font-sans">
            Admin Dashboard
          </h1>
          <p className="text-[13.5px] text-txt-caption font-medium mt-0.5">
            Overview of platform activity and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Welcome subtitle */}
          <div className="text-[12.5px] text-txt-caption mr-4 hidden md:block">
            <span className="font-semibold text-txt-heading">Welcome back, Admin! 👋</span>
            <p className="text-[11px] mt-0.5">Here's what's happening on your platform today.</p>
          </div>
          <button
            onClick={() => toast("Range", "Custom calendar picker coming soon.", "info")}
            className="flex items-center gap-2 px-3.5 py-2 border border-bg-border rounded-[14px] bg-bg-secondary hover:bg-bg-hover text-[12.5px] font-semibold text-txt-body transition-colors cursor-pointer outline-none"
          >
            <Calendar className="w-4 h-4 text-txt-caption" />
            <span>May 19 – Jun 19, 2025</span>
          </button>
        </div>
      </div>

      {/* Grid: 2 rows of 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((s, idx) => {
          const Icon = s.icon
          return (
            <Card
              key={idx}
              hoverEffect
              className="p-5 flex flex-col justify-between h-[130px] relative group cursor-pointer border border-bg-border/60"
            >
              <div className="absolute top-4 right-4 text-txt-disabled group-hover:text-txt-caption transition-colors">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="flex items-start justify-between">
                <div
                  className={`w-9 h-9 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center`}
                >
                  <Icon className={`w-[17px] h-[17px] ${s.text}`} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[24px] font-extrabold text-txt-title tracking-tight leading-none">
                    {s.value}
                  </span>
                  <span
                    className={`text-[11px] font-bold flex items-center gap-0.5 ${s.up ? "text-sec-green" : "text-sec-red"}`}
                  >
                    {s.up ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {s.delta}
                  </span>
                </div>
                <p className="text-[11.5px] text-txt-caption font-semibold mt-1.5">{s.label}</p>
                <p className="text-[10px] text-txt-disabled mt-0.5">vs Apr 19 - May 18</p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* 3-Column Mid Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart Card */}
        <Card className="xl:col-span-2 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[15px] font-extrabold text-txt-heading">Platform Overview</h2>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] text-txt-caption">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Users
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-txt-caption">
                  <span className="w-2.5 h-2.5 rounded-full bg-sec-blue" /> Jobs
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-txt-caption">
                  <span className="w-2.5 h-2.5 rounded-full bg-sec-green" /> Applications
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-txt-caption">
                  <span className="w-2.5 h-2.5 rounded-full bg-sec-orange" /> Revenue
                </div>
              </div>
            </div>
            <select className="h-8 px-2.5 rounded-[10px] border border-bg-border bg-bg-secondary text-[11.5px] font-bold text-txt-body outline-none cursor-pointer">
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>

          <div className="h-[210px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-bg-border)"
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--color-txt-caption)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-txt-caption)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid var(--color-bg-border)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Users"
                  stroke="#6C63FF"
                  strokeWidth={2.5}
                  fill="url(#primaryGrad)"
                />
                <Area type="monotone" dataKey="Jobs" stroke="#4F8EF7" strokeWidth={2} fill="none" />
                <Area
                  type="monotone"
                  dataKey="Applications"
                  stroke="#34C759"
                  strokeWidth={2}
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="Revenue"
                  stroke="#FFB547"
                  strokeWidth={2}
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* System Status Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-extrabold text-txt-heading">System Status</h2>
            <button
              onClick={() => toast("System Status", "All endpoints verified.", "success")}
              className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="space-y-3.5">
            {systemStatus.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sec-green" />
                  <span className="text-[12.5px] font-medium text-txt-heading">{s.name}</span>
                </div>
                <Badge variant="success" className="text-[10px] font-bold">
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3: AI Usage Summary + Bottom Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Usage Card */}
        <Card className="p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-extrabold text-txt-heading">AI Usage Summary</h2>
            <select className="h-8 px-2 rounded-[10px] border border-bg-border bg-bg-secondary text-[11.5px] font-bold text-txt-body outline-none cursor-pointer">
              <option>This Month</option>
            </select>
          </div>

          <div className="flex items-center gap-4 flex-1">
            <div className="w-[120px] h-[120px] shrink-0 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={aiPieData} innerRadius={38} outerRadius={50} dataKey="value">
                    {aiPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <p className="text-[16px] font-extrabold text-txt-heading leading-tight">72%</p>
                <p className="text-[9px] text-txt-caption uppercase tracking-wider font-semibold">
                  Total requests
                </p>
                <p className="text-[9px] text-txt-heading font-extrabold mt-0.5">128,450</p>
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              {aiPieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[11.5px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-txt-body truncate">{d.name}</span>
                  </div>
                  <span className="text-txt-caption shrink-0 font-medium ml-1">
                    {d.value.toLocaleString()} ({d.pct})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent Activities */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-extrabold text-txt-heading">Recent Activities</h2>
            <button
              onClick={() => toast("Activities", "Opening log book...", "info")}
              className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentActivities.map((a, i) => (
              <div key={i} className="flex gap-3">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${activityDot[a.type]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-txt-heading leading-tight font-medium">
                    {a.text}
                  </p>
                  <p className="text-[10px] text-txt-caption mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Latest Signups */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-extrabold text-txt-heading">Latest Signups</h2>
            <button
              onClick={() => toast("Users list", "Navigating to Users page.", "info")}
              className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="space-y-3.5">
            {latestSignups.map((u, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={u.avatar}
                    className="w-8 h-8 rounded-full object-cover border border-bg-border shrink-0"
                    alt={u.name}
                  />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-txt-heading truncate">{u.name}</p>
                    <p className="text-[11px] text-txt-caption">{u.role}</p>
                  </div>
                </div>
                <span className="text-[10.5px] text-txt-caption shrink-0 font-medium">
                  {u.time}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 4: Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-extrabold text-txt-heading">Recent Payments</h2>
            <button
              onClick={() => toast("Ledger", "Navigating to Payments ledger.", "info")}
              className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentPayments.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-[12px] bg-bg-secondary border border-bg-border/60 hover:bg-bg-hover/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                    <DollarSign className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-txt-heading">{p.desc}</p>
                    <p className="text-[11.5px] text-txt-caption">{p.user}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-[13.5px] font-extrabold text-txt-heading">{p.amount}</span>
                  <Badge
                    variant={p.status === "Success" ? "success" : "warning"}
                    className="text-[10px] font-bold"
                  >
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
