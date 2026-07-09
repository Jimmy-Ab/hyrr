import { useState } from "react"
import { BarChart3, LineChart, PieChart, Download, Calendar } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { useToast } from "hyrr.shared"
import { AreaChart, Area, BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"

const jobGrowthData = [
  { month: "Jan", jobs: 45, applications: 120 },
  { month: "Feb", jobs: 62, applications: 245 },
  { month: "Mar", jobs: 89, applications: 410 },
  { month: "Apr", jobs: 124, applications: 680 },
  { month: "May", jobs: 145, applications: 920 },
  { month: "Jun", jobs: 178, applications: 1240 },
  { month: "Jul", jobs: 184, applications: 1580 },
]

const momentumUsageData = [
  { category: "React Dev", spent: 4800 },
  { category: "AI Engineer", spent: 6200 },
  { category: "Designers", spent: 3400 },
  { category: "Product Mgrs", spent: 2900 },
  { category: "Backend Dev", spent: 5100 },
]

const conversionRateData = [
  { stage: "Saved", value: 100 },
  { stage: "Applied", value: 65 },
  { stage: "In Process", value: 24 },
  { stage: "Offer", value: 8 },
]

export function AnalyticsPage() {
  const { toast } = useToast()
  const [range, setRange] = useState("30d")

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Analytics</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Platform-wide traffic growth, job post yields, and transaction funnels.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-bg-secondary p-1 border border-bg-border rounded-[12px] text-[12px] font-semibold text-txt-body shrink-0">
            {["7d", "30d", "90d"].map(t => (
              <button key={t} onClick={() => setRange(t)} className={`px-2.5 py-1 rounded-[8px] cursor-pointer ${range === t ? "bg-primary text-white" : "hover:bg-bg-hover"}`}>{t}</button>
            ))}
          </div>
          <Button onClick={() => toast("Report exported", "Full PDF summary ready.", "success")} className="gap-1.5 cursor-pointer text-[12px]">
            <Download className="w-4 h-4" /> Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Job Listings vs App trends */}
        <Card className="p-6">
          <h2 className="text-[16px] font-bold text-txt-heading mb-4">Job Expansion & Application volume</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={jobGrowthData}>
              <defs>
                <linearGradient id="jobsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F8EF7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4F8EF7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-border)" strokeOpacity={0.4} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-txt-caption)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-txt-caption)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-bg-border)", fontSize: 12 }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="jobs" stroke="#4F8EF7" strokeWidth={2} fill="url(#jobsGrad)" name="Jobs Posted" />
              <Line type="monotone" dataKey="applications" stroke="#6C63FF" strokeWidth={2.5} name="Applications Received" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Momentum spend categories */}
        <Card className="p-6">
          <h2 className="text-[16px] font-bold text-txt-heading mb-4">Momentum Consumption by Category</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={momentumUsageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bg-border)" strokeOpacity={0.4} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--color-txt-caption)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-txt-caption)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-bg-border)", fontSize: 12 }} />
              <Bar dataKey="spent" fill="#FFB547" radius={[4, 4, 0, 0]} name="Credits Spent" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Funnel conversion rates */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 p-6">
          <h2 className="text-[16px] font-bold text-txt-heading mb-4">Hiring Funnel Analytics & Conversion Rates</h2>
          <div className="space-y-4">
            {conversionRateData.map((item, idx) => (
              <div key={item.stage} className="space-y-1.5">
                <div className="flex justify-between text-[13px] font-semibold text-txt-heading">
                  <span>{item.stage}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="w-full h-3.5 bg-bg-secondary border border-bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-txt-heading mb-3">Conversion Insights</h2>
            <p className="text-[12.5px] text-txt-caption leading-relaxed">
              Our conversion stats indicate a <strong>65% application rate</strong> from saved listings. 
              The technical interview step remains the highest friction drop-off point. Recruiter response speed has improved by 14% over the last week.
            </p>
          </div>
          <div className="mt-4 p-3 rounded-[12px] bg-primary-light border border-primary-border/30 text-[11px] text-primary font-bold">
            💡 Strategy recommendation: Reduce step 2 screening constraints to increase funnel flow.
          </div>
        </Card>
      </div>
    </div>
  )
}
