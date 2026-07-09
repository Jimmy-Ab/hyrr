import { Users, Briefcase, Calendar, CheckSquare, ArrowUpRight } from "lucide-react"
import { Card } from "../components/ui/card"
import { useJobStore } from "../store/useJobStore"

export function Dashboard() {
  const { candidates, jobs, notifications, setActiveView } = useJobStore()

  // Calculate statistics
  const totalCandidates = candidates.length
  const activeJobs = jobs.filter((j) => j.status === "Active").length
  const offersSent = candidates.filter((c) => c.status === "Offer").length
  const interviewsCount = 8 // static mock

  const stats = [
    { title: "Total Candidates", value: totalCandidates, icon: Users, change: "+12% vs last month", trend: "up" },
    { title: "Active Openings", value: activeJobs, icon: Briefcase, change: "2 new this week", trend: "neutral" },
    { title: "Interviews Booked", value: interviewsCount, icon: Calendar, change: "8 upcoming sessions", trend: "neutral" },
    { title: "Offers Sent", value: offersSent, icon: CheckSquare, change: "+25% vs last month", trend: "up" },
  ]

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Page Title */}
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Overview</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Here is a quick summary of your recruitment pipeline activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <Card key={idx} hoverEffect className="p-6 flex flex-col justify-between h-36">
              <div className="flex items-start justify-between">
                <span className="text-[14px] font-bold tracking-wider text-txt-caption uppercase">
                  {stat.title}
                </span>
                <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary-border/40 flex items-center justify-center text-primary">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold text-txt-title leading-none">
                  {stat.value}
                </span>
                <span className="text-[12px] text-txt-caption font-semibold">
                  {stat.change}
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Main Grid split: Recent Applicants & Upcoming Schedule */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Pipeline Actions */}
        <Card className="xl:col-span-2 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-card-title font-semibold text-txt-heading">
                  Recent Activities
                </h3>
                <p className="text-caption text-txt-caption mt-0.5">
                  Latest status updates across jobs
                </p>
              </div>
              <button
                onClick={() => setActiveView("Analytics")}
                className="flex items-center gap-1 text-[13px] text-primary hover:text-primary-hover font-semibold transition-colors cursor-pointer"
              >
                <span>View Analytics</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {notifications.slice(0, 4).map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-center justify-between p-3.5 rounded-[16px] bg-bg-primary/50 border border-bg-border/30 hover:border-bg-border/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-[14px] font-medium text-txt-heading">
                      {notif.title}
                    </span>
                  </div>
                  <span className="text-caption text-txt-caption font-semibold">
                    {notif.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Pipeline Summary card */}
        <Card className="p-6">
          <h3 className="text-card-title font-semibold text-txt-heading mb-4">
            Pipeline Distribution
          </h3>
          <div className="flex flex-col gap-3.5">
            {[
              { label: "Saved Listings", count: candidates.filter(c => c.status === "Saved").length, color: "bg-primary" },
              { label: "Applied", count: candidates.filter(c => c.status === "Applied").length, color: "bg-sec-blue" },
              { label: "In Technical Stage", count: candidates.filter(c => c.status === "In Process").length, color: "bg-sec-orange" },
              { label: "Offered Candidates", count: candidates.filter(c => c.status === "Offer").length, color: "bg-sec-green" },
              { label: "Archived Listings", count: candidates.filter(c => c.status === "Archived").length, color: "bg-sec-gray" },
            ].map((col, idx) => {
              const max = totalCandidates || 1
              const percentage = Math.round((col.count / max) * 100)
              
              return (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[13px] font-medium">
                    <span className="text-txt-body">{col.label}</span>
                    <span className="text-txt-heading font-semibold">{col.count} ({percentage}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-bg-primary overflow-hidden">
                    <div className={`h-full rounded-full ${col.color}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
