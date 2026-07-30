import { Button, Card, Input, useToast } from "hyrr.shared"
import { Eye, Search, Zap } from "lucide-react"
import { useState } from "react"
import { useAdminStore, type AdminApplication } from "../store/useAdminStore"

const statusColor = (status: string) => {
  const s = status.toLowerCase()
  if (s === "applied") return "bg-primary-light border-primary-border/20 text-primary"
  if (s === "in process") return "bg-sec-blue/10 border-sec-blue/20 text-sec-blue"
  if (s === "offer") return "bg-sec-green/10 border-sec-green/20 text-sec-green"
  return "bg-bg-primary border-bg-border text-txt-body"
}

export function ApplicationsPage() {
  const { applications } = useAdminStore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<AdminApplication | null>(null)

  const filtered = applications.filter(
    (app) =>
      app.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      app.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      app.company.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Applications</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Monitor all application submissions, stage transitions, and momentum credit history.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Applications", value: applications.length, color: "text-primary" },
          {
            label: "Total Momentum Spent",
            value: applications.reduce((acc, a) => acc + a.momentumUsed, 0),
            color: "text-sec-orange",
          },
          {
            label: "Active Pipelines",
            value: applications.filter((a) => a.status !== "Archived").length,
            color: "text-sec-green",
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

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate, job, company…"
            className="pl-9 h-9 text-[13px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="divide-y divide-bg-border/30">
            {filtered.map((app) => (
              <div
                key={app.id}
                onClick={() => setSelected(selected?.id === app.id ? null : app)}
                className={`flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-bg-hover/50 ${selected?.id === app.id ? "bg-primary-light/30" : ""}`}
              >
                <img
                  src={app.candidateAvatar}
                  className="w-10 h-10 rounded-full object-cover border border-bg-border shrink-0"
                  alt={app.candidateName}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-txt-heading truncate">
                    {app.candidateName}
                  </p>
                  <p className="text-[12px] text-txt-caption">
                    {app.jobTitle} at {app.company}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[12px] font-semibold text-sec-orange shrink-0">
                  <Zap className="w-3.5 h-3.5" /> {app.momentumUsed}
                </div>
                <span
                  className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full border ${statusColor(app.status)}`}
                >
                  {app.status}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(app)
                  }}
                  className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-primary cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {selected ? (
          <Card className="p-6 space-y-5">
            <div className="text-center space-y-3">
              <img
                src={selected.candidateAvatar}
                className="w-16 h-16 rounded-full object-cover mx-auto border-4 border-bg-secondary shadow-card"
                alt={selected.candidateName}
              />
              <div>
                <h2 className="text-[16px] font-bold text-txt-heading">{selected.candidateName}</h2>
                <p className="text-[12px] text-txt-caption">Candidate Application</p>
              </div>
              <span
                className={`text-[11.5px] font-bold px-2.5 py-0.5 rounded-full border inline-block ${statusColor(selected.status)}`}
              >
                {selected.status}
              </span>
            </div>

            <div className="space-y-2">
              {[
                { label: "Job Title", value: selected.jobTitle },
                { label: "Company", value: selected.company },
                { label: "Applied", value: selected.appliedDate },
                { label: "Credits Consumed", value: `${selected.momentumUsed} Momentum` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-1.5 border-b border-bg-border/30 last:border-0"
                >
                  <span className="text-[12px] text-txt-caption">{row.label}</span>
                  <span className="text-[12.5px] font-semibold text-txt-heading text-right max-w-[160px] truncate">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="space-y-3 pt-3 border-t border-bg-border/30">
              <p className="text-[12px] font-bold text-txt-caption uppercase tracking-wider">
                Application Journey
              </p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-sec-green mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-bold text-txt-heading">Application Submitted</p>
                    <p className="text-[11px] text-txt-caption">{selected.appliedDate}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-bold text-txt-heading">
                      Stage updated: {selected.status}
                    </p>
                    <p className="text-[11px] text-txt-caption">Just now</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 text-[12px]"
                onClick={() =>
                  toast("View Profile", `Viewing profile of ${selected.candidateName}`, "info")
                }
              >
                View Candidate
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 text-[12px]"
                onClick={() => toast("Audit Log", "Retrieving historical telemetry", "info")}
              >
                Audit History
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 flex flex-col items-center justify-center gap-3 min-h-[240px] border-dashed">
            <Eye className="w-8 h-8 text-txt-disabled" />
            <p className="text-[13px] text-txt-caption text-center">
              Select an application
              <br />
              to review history
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
