import { useState } from "react"
import { AlertOctagon, Eye, Check, RefreshCcw, Trash2, Ban } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { useAdminStore, type AdminReport } from "../store/useAdminStore"
import { useToast } from "hyrr.shared"

const severityColor = (sev: AdminReport["severity"]) => {
  if (sev === "high") return "bg-sec-red/10 border-sec-red/20 text-sec-red"
  if (sev === "medium") return "bg-sec-orange/10 border-sec-orange/20 text-sec-orange"
  return "bg-bg-primary border-bg-border text-txt-body"
}

export function ReportsPage() {
  const { reports, updateReportStatus } = useAdminStore()
  const { toast } = useToast()
  const [filter, setFilter] = useState<AdminReport["status"] | "all">("pending")
  const [selected, setSelected] = useState<AdminReport | null>(null)

  const filtered = reports.filter((r) => filter === "all" || r.status === filter)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Reports & Moderation</h1>
        <p className="text-body text-txt-body mt-1 font-medium">Manage platform reports flagged by community members or automated heuristics.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-secondary border border-bg-border p-1 rounded-[12px] w-fit">
        {(["pending", "resolved", "ignored", "all"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-4 py-1.5 rounded-[9px] text-[12.5px] font-semibold cursor-pointer capitalize transition-all ${filter === s ? "bg-primary text-white" : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"}`}>{s}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="divide-y divide-bg-border/30">
            {filtered.map((rep) => (
              <div key={rep.id} onClick={() => setSelected(selected?.id === rep.id ? null : rep)} className={`flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-bg-hover/50 ${selected?.id === rep.id ? "bg-primary-light/30" : ""}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${rep.severity === "high" ? "bg-sec-red/10 text-sec-red" : "bg-sec-orange/10 text-sec-orange"}`}>
                  <AlertOctagon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold text-txt-heading truncate">{rep.target}</p>
                  <p className="text-[12px] text-txt-caption">Reporter: {rep.reporter} · Reason: {rep.reason}</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase ${severityColor(rep.severity)}`}>{rep.severity}</span>
                <Badge variant={rep.status === "pending" ? "secondary" : rep.status === "resolved" ? "success" : "secondary"}>{rep.status}</Badge>
                <div className="flex gap-1 shrink-0">
                  {rep.status === "pending" && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); updateReportStatus(rep.id, "resolved"); toast("Resolved", "Report resolved", "success") }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-sec-green cursor-pointer"><Check className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); updateReportStatus(rep.id, "ignored"); toast("Ignored", "Report ignored", "info") }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setSelected(rep) }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-primary cursor-pointer"><Eye className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {selected ? (
          <Card className="p-6 space-y-5">
            <div className="text-center space-y-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${selected.severity === "high" ? "bg-sec-red/10 text-sec-red" : "bg-sec-orange/10 text-sec-orange"}`}>
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-txt-heading truncate">{selected.target}</h2>
                <p className="text-[12px] text-txt-caption capitalize">Report Type: {selected.type}</p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border inline-block ${severityColor(selected.severity)}`}>{selected.severity} severity</span>
            </div>

            <div className="space-y-2">
              {[
                { label: "Reported Content", value: selected.target },
                { label: "Reason Given", value: selected.reason },
                { label: "Submitted By", value: selected.reporter },
                { label: "Time Occurred", value: selected.date },
                { label: "Current Status", value: selected.status },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-bg-border/30 last:border-0">
                  <span className="text-[12px] text-txt-caption">{row.label}</span>
                  <span className="text-[12.5px] font-semibold text-txt-heading text-right max-w-[160px] truncate">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Button size="sm" className="w-full cursor-pointer text-[12px]" onClick={() => { updateReportStatus(selected.id, "resolved"); toast("Resolved", "Content removed / User informed", "success") }}>Resolve (Remove Content)</Button>
              <Button size="sm" variant="secondary" className="w-full cursor-pointer text-[12px]" onClick={() => { updateReportStatus(selected.id, "ignored"); toast("Ignored", "Report closed without action", "info") }}>Dismiss / Ignore Report</Button>
              <Button size="sm" variant="ghost" className="w-full cursor-pointer text-[12px] text-sec-red hover:text-sec-red" onClick={() => toast("Banned", "Account permanently suspended.", "warning")}><Ban className="w-4 h-4 mr-2" /> Ban Associated Account</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 flex flex-col items-center justify-center gap-3 min-h-[240px] border-dashed">
            <AlertOctagon className="w-8 h-8 text-txt-disabled" />
            <p className="text-[13px] text-txt-caption text-center">Select a ticket to review<br />moderator options</p>
          </Card>
        )}
      </div>
    </div>
  )
}
