import { apiFetch } from "hyrr.shared"
import { Loader2, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "../components/ui/card"

interface AnalyticsData {
  totalJobs: number
  totalApplications: number
  pipeline: {
    Saved: number
    Applied: number
    InProcess: number
    Interviewing: number
    Offer: number
    Archived: number
  }
  offerConversionRate: string
  avgAiMatchScore: number
  monthlyApplications: { month: string; applications: number }[]
}

const PIPELINE_COLORS: Record<string, string> = {
  Applied: "#4F8EF7",
  "In Process": "#FFB547",
  Interviewing: "#6C63FF",
  Offer: "#34C759",
  Archived: "#98A2B3",
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/jobs/analytics")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const pipelineData = data
    ? [
        { name: "Applied", count: data.pipeline.Applied, fill: PIPELINE_COLORS["Applied"] },
        { name: "In Process", count: data.pipeline.InProcess, fill: PIPELINE_COLORS["In Process"] },
        {
          name: "Interviewing",
          count: data.pipeline.Interviewing ?? 0,
          fill: PIPELINE_COLORS["Interviewing"],
        },
        { name: "Offer", count: data.pipeline.Offer, fill: PIPELINE_COLORS["Offer"] },
        { name: "Archived", count: data.pipeline.Archived, fill: PIPELINE_COLORS["Archived"] },
      ]
    : []

  const monthlyData = data?.monthlyApplications ?? []
  const thisMonthApps =
    monthlyData.length > 0 ? (monthlyData[monthlyData.length - 1]?.applications ?? 0) : 0

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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Grid: Overview summaries */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card hoverEffect className="p-6">
              <div className="flex justify-between items-start">
                <span className="text-[13px] font-bold text-txt-caption uppercase tracking-wider">
                  Applications This Month
                </span>
                <span className="text-sec-green text-[12px] font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Live
                </span>
              </div>
              <h3 className="text-[28px] font-extrabold text-txt-title mt-4">{thisMonthApps}</h3>
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
              <h3 className="text-[28px] font-extrabold text-txt-title mt-4">
                {data?.offerConversionRate ?? "0.0"}%
              </h3>
              <p className="text-caption text-txt-body mt-1 font-medium">
                Candidates reaching offer stage
              </p>
            </Card>

            <Card hoverEffect className="p-6">
              <div className="flex justify-between items-start">
                <span className="text-[13px] font-bold text-txt-caption uppercase tracking-wider">
                  Avg AI Match Score
                </span>
                <span className="text-sec-orange text-[12px] font-bold">AI Ranked</span>
              </div>
              <h3 className="text-[28px] font-extrabold text-txt-title mt-4">
                {data?.avgAiMatchScore ?? 0}
              </h3>
              <p className="text-caption text-txt-body mt-1 font-medium">
                Average AI score across all applicants
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
                  Monthly application trends (last 7 months)
                </p>
              </div>

              <div className="h-80 w-full font-medium">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EAF1" />
                    <XAxis
                      dataKey="month"
                      stroke="#98A2B3"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#98A2B3"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E8EAF1",
                        borderRadius: "14px",
                        boxShadow: "0 10px 30px rgba(15,23,42,.06)",
                        fontFamily: "Inter",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="applications"
                      stroke="#6C63FF"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorApplications)"
                    />
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
                  Live candidate counts across all pipeline stages
                </p>
              </div>

              <div className="h-80 w-full font-medium">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pipelineData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EAF1" />
                    <XAxis
                      dataKey="name"
                      stroke="#98A2B3"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#98A2B3"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(108,99,255,0.04)" }}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E8EAF1",
                        borderRadius: "14px",
                        boxShadow: "0 10px 30px rgba(15,23,42,.06)",
                        fontFamily: "Inter",
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={45}>
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
