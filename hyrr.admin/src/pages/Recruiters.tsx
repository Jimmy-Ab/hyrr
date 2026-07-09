import { useState } from "react"
import { Search, CheckCircle2, XCircle, UserX, Eye } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Input } from "hyrr.shared"
import { useAdminStore, type AdminRecruiter } from "../store/useAdminStore"
import { useToast } from "hyrr.shared"

const colorBg: Record<string, string> = {
  purple: "bg-primary text-white",
  blue:   "bg-sec-blue text-white",
  green:  "bg-sec-green text-white",
  orange: "bg-sec-orange text-white",
}

const statusBadge = (status: AdminRecruiter["status"]) => {
  if (status === "verified")  return <Badge variant="success">Verified</Badge>
  if (status === "pending")   return <Badge variant="secondary">Pending</Badge>
  if (status === "suspended") return <Badge variant="destructive">Suspended</Badge>
}

export function RecruitersPage() {
  const { recruiters, updateUserStatus } = useAdminStore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<AdminRecruiter["status"] | "all">("all")
  const [selected, setSelected] = useState<AdminRecruiter | null>(null)

  const filtered = recruiters.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.company.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || r.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Recruiters</h1>
        <p className="text-body text-txt-body mt-1 font-medium">Verify, manage, and monitor recruiter accounts across all companies.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Recruiters", value: recruiters.length, color: "text-primary" },
          { label: "Verified", value: recruiters.filter((r) => r.status === "verified").length, color: "text-sec-green" },
          { label: "Awaiting Verification", value: recruiters.filter((r) => r.status === "pending").length, color: "text-sec-orange" },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-[28px] font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-txt-caption font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search recruiter or company…" className="pl-9 h-9 text-[13px]" />
        </div>
        <div className="flex gap-1 bg-bg-secondary border border-bg-border p-1 rounded-[12px]">
          {(["all", "verified", "pending", "suspended"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-[9px] text-[12px] font-semibold cursor-pointer capitalize transition-all ${filter === s ? "bg-primary text-white" : "text-txt-body hover:bg-bg-hover"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="divide-y divide-bg-border/30">
            {filtered.map((r) => (
              <div key={r.id} onClick={() => setSelected(selected?.id === r.id ? null : r)} className={`flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-bg-hover/50 ${selected?.id === r.id ? "bg-primary-light/30" : ""}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0 ${colorBg[r.companyColor] ?? "bg-primary text-white"}`}>
                  {r.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-txt-heading truncate">{r.name}</p>
                  <p className="text-[12px] text-txt-caption">{r.company} · {r.email}</p>
                </div>
                <div className="text-center shrink-0 hidden md:block">
                  <p className="text-[12.5px] font-bold text-txt-heading">{r.activeJobs}</p>
                  <p className="text-[10px] text-txt-caption">active jobs</p>
                </div>
                <div className="text-center shrink-0 hidden md:block">
                  <p className="text-[12.5px] font-bold text-sec-green">{r.totalHires}</p>
                  <p className="text-[10px] text-txt-caption">hires</p>
                </div>
                {statusBadge(r.status)}
                <div className="flex gap-1 shrink-0">
                  {r.status === "pending" && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); toast("Verified", `${r.name} verified.`, "success") }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-sec-green cursor-pointer"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); toast("Rejected", `${r.name} rejected.`, "warning") }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-sec-red cursor-pointer"><XCircle className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                  {r.status === "verified" && (
                    <button onClick={(e) => { e.stopPropagation(); toast("Suspended", `${r.name} suspended.`, "warning") }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-sec-red cursor-pointer"><UserX className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setSelected(r) }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-primary cursor-pointer"><Eye className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {selected ? (
          <Card className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-[24px] mx-auto ${colorBg[selected.companyColor]}`}>
                {selected.name.charAt(0)}
              </div>
              <h2 className="text-[16px] font-bold text-txt-heading">{selected.name}</h2>
              <p className="text-[12px] text-txt-caption">{selected.company}</p>
              {statusBadge(selected.status)}
            </div>
            <div className="space-y-2">
              {[
                { label: "Email",       value: selected.email },
                { label: "Joined",      value: selected.joined },
                { label: "Active Jobs", value: selected.activeJobs },
                { label: "Total Hires", value: selected.totalHires },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-bg-border/30 last:border-0">
                  <span className="text-[12px] text-txt-caption">{row.label}</span>
                  <span className="text-[12.5px] font-semibold text-txt-heading">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {selected.status === "pending" && (
                <Button size="sm" className="w-full cursor-pointer text-[12px]" onClick={() => toast("Verified", `${selected.name} has been verified.`, "success")}>Verify Account</Button>
              )}
              <Button size="sm" variant="secondary" className="w-full cursor-pointer text-[12px]" onClick={() => toast("Message sent", "Email dispatched.", "info")}>Send Message</Button>
              <Button size="sm" variant="ghost" className="w-full cursor-pointer text-[12px] text-sec-red hover:text-sec-red" onClick={() => toast("Suspended", `${selected.name} suspended.`, "warning")}>Suspend Account</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 flex flex-col items-center justify-center gap-3 min-h-[240px] border-dashed">
            <Eye className="w-8 h-8 text-txt-disabled" />
            <p className="text-[13px] text-txt-caption text-center">Select a recruiter<br />to view their profile</p>
          </Card>
        )}
      </div>
    </div>
  )
}
