import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from "recharts"
import { TrendingUp } from "lucide-react"
import { Card } from "../components/ui/card"
import { useJobStore } from "../store/useJobStore"

export function Analytics() {
  const { candidates } = useJobStore()

  // Pipeline distribution statistics
  const pipelineData = [
    { name: "Saved", count: candidates.filter((c) => c.status === "Saved").length, fill: "#6C63FF" },
    { name: "Applied", count: candidates.filter((c) => c.status === "Applied").length, fill: "#4F8EF7" },
    { name: "In Process", count: candidates.filter((c) => c.status === "In Process").length, fill: "#FFB547" },
    { name: "Offer", count: candidates.filter((c) => c.status === "Offer").length, fill: "#34C759" },
    { name: "Archived", count: candidates.filter((c) => c.status === "Archived").length, fill: "#8A94A6" },
  ]

  // Monthly applications timeline mock
  const monthlyData = [
    { month: "Jan", applications: 12 },
    { month: "Feb", applications: 19 },
    { month: "Mar", applications: 28 },
    { month: "Apr", applications: 35 },
    { month: "May", applications: 22 },
    { month: "Jun", applications: 40 },
    { month: "Jul", applications: 48 },
  ]

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      {/* Header */}
      <div>
        <h1 className="text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">Analytics Dashboard</span>
          </h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Monitor your application growth, candidate velocity, and conversions.
        </p>
      </div>

      {/* Grid: Overview summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hoverEffect className="p-6">
          <div className="flex justify-between items-start">
            <span className="text-[13px] font-bold text-txt-caption uppercase tracking-wider">
              Application Growth
            </span>
            <span className="text-sec-green text-[12px] font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              +28%
            </span>
          </div>
          <h3 className="text-[28px] font-extrabold text-txt-title mt-4">48</h3>
          <p className="text-caption text-txt-body mt-1 font-medium">
            New applications received this month
          </p>
        </Card>

        <Card hoverEffect className="p-6">
          <div className="flex justify-between items-start">
            <span className="text-[13px] font-bold text-txt-caption uppercase tracking-wider">
              Offer Conversion Rate
            </span>
            <span className="text-primary text-[12px] font-bold">Target 15%</span>
          </div>
          <h3 className="text-[28px] font-extrabold text-txt-title mt-4">11.7%</h3>
          <p className="text-caption text-txt-body mt-1 font-medium">
            Candidates reaching offer stage
          </p>
        </Card>

        <Card hoverEffect className="p-6">
          <div className="flex justify-between items-start">
            <span className="text-[13px] font-bold text-txt-caption uppercase tracking-wider">
              Average Days to Hire
            </span>
            <span className="text-sec-orange text-[12px] font-bold">-4 days</span>
          </div>
          <h3 className="text-[28px] font-extrabold text-txt-title mt-4">24 days</h3>
          <p className="text-caption text-txt-body mt-1 font-medium">
            Average duration to fill a job vacancy
          </p>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Applications Timeline AreaChart */}
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-card-title font-semibold text-txt-heading">
              Application Intake
            </h3>
            <p className="text-caption text-txt-caption mt-0.5 font-medium">
              Monthly applications trends for July 2026
            </p>
          </div>

          <div className="h-80 w-full font-medium">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EAF1" />
                <XAxis dataKey="month" stroke="#98A2B3" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#98A2B3" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E8EAF1",
                    borderRadius: "14px",
                    boxShadow: "0 10px 30px rgba(15,23,42,.06)",
                    fontFamily: "Inter"
                  }}
                />
                <Area type="monotone" dataKey="applications" stroke="#6C63FF" strokeWidth={2} fillOpacity={1} fill="url(#colorApplications)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pipeline stage BarChart */}
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-card-title font-semibold text-txt-heading">
              Candidate Pipeline Distribution
            </h3>
            <p className="text-caption text-txt-caption mt-0.5 font-medium">
              Applicants counts currently allocated in columns
            </p>
          </div>

          <div className="h-80 w-full font-medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EAF1" />
                <XAxis dataKey="name" stroke="#98A2B3" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#98A2B3" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E8EAF1",
                    borderRadius: "14px",
                    boxShadow: "0 10px 30px rgba(15,23,42,.06)",
                    fontFamily: "Inter"
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={45}>
                  {pipelineData.map((entry, index) => (
                    <Bar key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
