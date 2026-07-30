import { Badge, Button, Card, Input, useToast } from "hyrr.shared"
import { Ban, CheckCircle2, Eye, Globe, Search, XCircle } from "lucide-react"
import { useState } from "react"
import { useAdminStore, type AdminCompany } from "../store/useAdminStore"

const colorBg: Record<string, string> = {
  purple: "bg-primary text-white",
  blue: "bg-sec-blue text-white",
  green: "bg-sec-green text-white",
  orange: "bg-sec-orange text-white",
}

export function CompaniesPage() {
  const { companies, updateCompanyStatus } = useAdminStore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<AdminCompany["status"] | "all">("all")
  const [selected, setSelected] = useState<AdminCompany | null>(null)

  const filtered = companies.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Companies</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Review, approve, and manage employer organizations on the platform.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Companies", value: companies.length, color: "text-primary" },
          {
            label: "Verified",
            value: companies.filter((c) => c.status === "verified").length,
            color: "text-sec-green",
          },
          {
            label: "Awaiting Review",
            value: companies.filter((c) => c.status === "pending").length,
            color: "text-sec-orange",
          },
          {
            label: "Total Active Jobs",
            value: companies.reduce((a, c) => a + c.activeJobs, 0),
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
            placeholder="Search company…"
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        <div className="flex gap-1 bg-bg-secondary border border-bg-border p-1 rounded-[12px]">
          {(["all", "verified", "pending", "suspended"] as const).map((s) => (
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
        {/* Company cards */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((company) => (
            <Card
              key={company.id}
              hoverEffect
              onClick={() => setSelected(selected?.id === company.id ? null : company)}
              className={`p-5 cursor-pointer transition-all ${selected?.id === company.id ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-[18px] shrink-0 ${colorBg[company.color] ?? "bg-primary text-white"}`}
                >
                  {company.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-txt-heading truncate">
                    {company.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Globe className="w-3 h-3 text-txt-caption" />
                    <span className="text-[11.5px] text-txt-caption">{company.country}</span>
                  </div>
                </div>
                <Badge
                  variant={
                    company.status === "verified"
                      ? "success"
                      : company.status === "pending"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {company.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                {[
                  { label: "Recruiters", value: company.recruiters },
                  { label: "Active Jobs", value: company.activeJobs },
                  { label: "Total Hires", value: company.totalHires },
                ].map((s) => (
                  <div key={s.label} className="p-2 bg-bg-primary rounded-[10px]">
                    <p className="text-[16px] font-extrabold text-txt-heading">{s.value}</p>
                    <p className="text-[10px] text-txt-caption">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-bg-border/30">
                <span className="text-[11px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full border border-primary/20">
                  {company.plan}
                </span>
                <span className="text-[11px] text-txt-caption">Since {company.joined}</span>
              </div>

              <div className="flex gap-2 mt-3">
                {company.status === "pending" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateCompanyStatus(company.id, "verified")
                        toast("Approved", `${company.name} verified.`, "success")
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-sec-green hover:bg-sec-green/10 px-2 py-1 rounded-[8px] cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateCompanyStatus(company.id, "suspended")
                        toast("Rejected", `${company.name} rejected.`, "warning")
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-sec-red hover:bg-sec-red/10 px-2 py-1 rounded-[8px] cursor-pointer transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
                {company.status === "verified" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateCompanyStatus(company.id, "suspended")
                      toast("Suspended", `${company.name} suspended.`, "warning")
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-sec-red hover:bg-sec-red/10 px-2 py-1 rounded-[8px] cursor-pointer transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" /> Suspend
                  </button>
                )}
                {company.status === "suspended" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateCompanyStatus(company.id, "verified")
                      toast("Reinstated", `${company.name} reactivated.`, "success")
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-sec-green hover:bg-sec-green/10 px-2 py-1 rounded-[8px] cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Reinstate
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Detail panel */}
        {selected ? (
          <Card className="p-6 space-y-5">
            <div className="text-center space-y-3">
              <div
                className={`w-20 h-20 rounded-[18px] flex items-center justify-center font-bold text-[32px] mx-auto ${colorBg[selected.color]}`}
              >
                {selected.logo}
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-txt-heading">{selected.name}</h2>
                <p className="text-[12px] text-txt-caption">{selected.country}</p>
              </div>
              <Badge
                variant={
                  selected.status === "verified"
                    ? "success"
                    : selected.status === "pending"
                      ? "secondary"
                      : "destructive"
                }
              >
                {selected.status}
              </Badge>
            </div>

            <div className="space-y-2">
              {[
                { label: "Plan", value: selected.plan },
                { label: "Since", value: selected.joined },
                { label: "Recruiters", value: selected.recruiters },
                { label: "Active Jobs", value: selected.activeJobs },
                { label: "Total Hires", value: selected.totalHires },
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
                onClick={() => toast("View jobs", `Jobs from ${selected.name}`, "info")}
              >
                View All Jobs
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full cursor-pointer text-[12px]"
                onClick={() => toast("Contact", `Emailing ${selected.name}`, "info")}
              >
                Contact Company
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full cursor-pointer text-[12px] text-sec-red hover:text-sec-red"
                onClick={() => toast("Deleted", `${selected.name} removed.`, "warning")}
              >
                Delete Company
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 flex flex-col items-center justify-center gap-3 min-h-[280px] border-dashed">
            <Eye className="w-8 h-8 text-txt-disabled" />
            <p className="text-[13px] text-txt-caption text-center">
              Click a company card
              <br />
              to view details
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
