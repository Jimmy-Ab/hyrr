import { Badge, Button, Card, Input, useToast } from "hyrr.shared"
import { Archive, CheckCircle2, Eye, Search, Star, XCircle, Zap } from "lucide-react"
import { useState } from "react"
import { useAdminStore, type AdminJob } from "../store/useAdminStore"

const colorBg: Record<string, string> = {
  purple: "bg-primary text-white",
  blue: "bg-sec-blue text-white",
  green: "bg-sec-green text-white",
  orange: "bg-sec-orange text-white",
}

const statusBadge = (status: AdminJob["status"]) => {
  if (status === "active") return <Badge variant="success">Active</Badge>
  if (status === "flagged") return <Badge variant="destructive">Flagged</Badge>
  if (status === "draft") return <Badge variant="secondary">Draft</Badge>
  return <Badge variant="secondary">Closed</Badge>
}

export function JobsPage() {
  const { jobs, updateJobStatus } = useAdminStore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<AdminJob["status"] | "all">("all")
  const [selected, setSelected] = useState<AdminJob | null>(null)

  const filtered = jobs.filter((j) => {
    const matchSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || j.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Jobs</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Review every job posting across all companies, approve, reject, feature, or archive.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Jobs", value: jobs.length, color: "text-primary" },
          {
            label: "Active",
            value: jobs.filter((j) => j.status === "active").length,
            color: "text-sec-green",
          },
          {
            label: "Flagged",
            value: jobs.filter((j) => j.status === "flagged").length,
            color: "text-sec-red",
          },
          {
            label: "Total Applicants",
            value: jobs.reduce((a, j) => a + j.applicants, 0),
            color: "text-sec-blue",
          },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-[28px] font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-txt-caption font-semibold uppercase tracking-wider mt-0.5">
              {s.label}
            </p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job or company…"
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        <div className="flex gap-1 bg-bg-secondary border border-bg-border p-1 rounded-[12px]">
          {(["all", "active", "flagged", "draft", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-[9px] text-[12px] font-semibold cursor-pointer capitalize transition-all ${filter === s ? "bg-primary text-white" : "text-txt-body hover:bg-bg-hover"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="divide-y divide-bg-border/30">
            {filtered.map((job) => (
              <div
                key={job.id}
                onClick={() => setSelected(selected?.id === job.id ? null : job)}
                className={`flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-bg-hover/50 ${selected?.id === job.id ? "bg-primary-light/30" : ""}`}
              >
                <div
                  className={`w-10 h-10 rounded-[12px] flex items-center justify-center font-bold text-[13px] shrink-0 ${colorBg[job.companyColor]}`}
                >
                  {job.company.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-txt-heading truncate">
                    {job.title}
                  </p>
                  <p className="text-[12px] text-txt-caption">
                    {job.company} · {job.recruiter} · {job.location}
                  </p>
                </div>
                <div className="text-center shrink-0 hidden md:block">
                  <p className="text-[12.5px] font-bold text-txt-heading">{job.applicants}</p>
                  <p className="text-[10px] text-txt-caption">applicants</p>
                </div>
                <div className="flex items-center gap-1 text-[12px] font-semibold text-sec-orange shrink-0">
                  <Zap className="w-3.5 h-3.5" /> {job.momentumCost}
                </div>
                {/* AI Score */}
                {job.aiScore > 0 && (
                  <div
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${job.aiScore >= 90 ? "bg-sec-green/10 text-sec-green" : job.aiScore >= 75 ? "bg-sec-orange/10 text-sec-orange" : "bg-sec-red/10 text-sec-red"}`}
                  >
                    AI {job.aiScore}
                  </div>
                )}
                {statusBadge(job.status)}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toast("Featured", `${job.title} marked as featured.`, "success")
                    }}
                    className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-sec-orange cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  {job.status === "flagged" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          updateJobStatus(job.id, "active")
                          toast("Approved", `${job.title} approved.`, "success")
                        }}
                        className="p-1.5 hover:bg-bg-hover rounded-[8px] text-sec-green cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          updateJobStatus(job.id, "closed")
                          toast("Removed", `${job.title} removed.`, "warning")
                        }}
                        className="p-1.5 hover:bg-bg-hover rounded-[8px] text-sec-red cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateJobStatus(job.id, "closed")
                      toast("Archived", `${job.title} archived.`, "info")
                    }}
                    className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {selected ? (
          <Card className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-[18px] shrink-0 ${colorBg[selected.companyColor]}`}
              >
                {selected.company.charAt(0)}
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-txt-heading leading-snug">
                  {selected.title}
                </h2>
                <p className="text-[12px] text-txt-caption">{selected.company}</p>
              </div>
            </div>
            {statusBadge(selected.status)}
            <div className="space-y-2">
              {[
                { label: "Recruiter", value: selected.recruiter },
                { label: "Type", value: selected.type },
                { label: "Location", value: selected.location },
                { label: "Posted", value: selected.posted },
                { label: "Applicants", value: selected.applicants },
                {
                  label: "Momentum Cost",
                  value: `${selected.momentumCost} credits`,
                },
                {
                  label: "AI Score",
                  value: selected.aiScore > 0 ? `${selected.aiScore} / 100` : "—",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-1.5 border-b border-bg-border/30 last:border-0"
                >
                  <span className="text-[12px] text-txt-caption">{row.label}</span>
                  <span className="text-[12.5px] font-semibold text-txt-heading">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full cursor-pointer text-[12px]"
                onClick={() => toast("Featured", `${selected.title} featured!`, "success")}
              >
                Feature Job
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full cursor-pointer text-[12px]"
                onClick={() => {
                  updateJobStatus(selected.id, "closed")
                  toast("Archived", `${selected.title} archived.`, "info")
                }}
              >
                Archive
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full cursor-pointer text-[12px] text-sec-red hover:text-sec-red"
                onClick={() => toast("Deleted", `${selected.title} deleted.`, "warning")}
              >
                Delete Job
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 flex flex-col items-center justify-center gap-3 min-h-[280px] border-dashed">
            <Eye className="w-8 h-8 text-txt-disabled" />
            <p className="text-[13px] text-txt-caption text-center">
              Select a job
              <br />
              to view details
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
