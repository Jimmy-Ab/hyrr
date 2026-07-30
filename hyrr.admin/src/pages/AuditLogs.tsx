import { useState } from "react"
import { Search, ScrollText, Download, ShieldAlert, AlertTriangle, Info } from "lucide-react"
import { Card } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Input } from "hyrr.shared"
import { useAdminStore, type AuditLog } from "../store/useAdminStore"
import { useToast } from "hyrr.shared"

const severityColor = (sev: AuditLog["severity"]) => {
  if (sev === "critical") return "bg-sec-red/10 border-sec-red/20 text-sec-red"
  if (sev === "warning") return "bg-sec-orange/10 border-sec-orange/20 text-sec-orange"
  return "bg-bg-primary border-bg-border text-txt-body"
}

const severityIcon = (sev: AuditLog["severity"]) => {
  if (sev === "critical") return <ShieldAlert className="w-4 h-4 text-sec-red" />
  if (sev === "warning") return <AlertTriangle className="w-4 h-4 text-sec-orange" />
  return <Info className="w-4 h-4 text-primary" />
}

export function AuditLogsPage() {
  const { auditLogs } = useAdminStore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<AuditLog["severity"] | "all">("all")

  const filtered = auditLogs.filter((log) => {
    const matchSearch = log.actor.toLowerCase().includes(search.toLowerCase()) ||
                        log.action.toLowerCase().includes(search.toLowerCase()) ||
                        log.target.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || log.severity === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Audit Logs</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Read-only audit stream tracking administrative events, security access, and AI updates.</p>
        </div>
        <Button onClick={() => toast("Export", "Audit trail compiled and downloaded.", "success")} className="gap-1.5 cursor-pointer text-[12px]">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actor, action, or target…" className="pl-9 h-9 text-[13px]" />
        </div>
        <div className="flex gap-1 bg-bg-secondary border border-bg-border p-1 rounded-[12px]">
          {(["all", "info", "warning", "critical"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-[9px] text-[12px] font-semibold cursor-pointer capitalize transition-all ${filter === s ? "bg-primary text-white" : "text-txt-body hover:bg-bg-hover"}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <Card className="overflow-hidden">
        <div className="divide-y divide-bg-border/30">
          {filtered.map((log) => (
            <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-bg-hover/30 transition-colors">
              <div className="w-8 h-8 rounded-full bg-bg-primary border border-bg-border flex items-center justify-center shrink-0 mt-0.5">
                {severityIcon(log.severity)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[13px] font-bold text-txt-heading">{log.actor}</span>
                    <span className="text-[11px] text-txt-caption mx-2">performed</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-bg-primary border border-bg-border text-txt-heading font-mono uppercase">{log.action}</span>
                    <span className="text-[11px] text-txt-caption mx-2">on</span>
                    <span className="text-[12.5px] font-semibold text-txt-heading">{log.target}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${severityColor(log.severity)}`}>{log.severity}</span>
                </div>
                <p className="text-[12px] text-txt-body mt-2 leading-relaxed bg-bg-primary/50 p-2.5 rounded-[8px] border border-bg-border/40 font-mono">{log.details}</p>
                <div className="flex items-center gap-3 text-[11px] text-txt-caption mt-2.5">
                  <span>IP: {log.ip}</span>
                  <span>·</span>
                  <span>{log.date}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-2 text-txt-caption">
              <ScrollText className="w-8 h-8 opacity-30" />
              <p className="text-[13px]">No audit logs match your filters</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
