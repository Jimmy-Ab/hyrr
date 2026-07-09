import { useState } from "react"
import { Search, CreditCard, RefreshCw, FileText, Download, AlertTriangle } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Input } from "hyrr.shared"
import { useAdminStore, type AdminPayment } from "../store/useAdminStore"
import { useToast } from "hyrr.shared"

const statusColor = (status: AdminPayment["status"]) => {
  if (status === "succeeded") return "bg-sec-green/10 border-sec-green/20 text-sec-green"
  if (status === "failed") return "bg-sec-red/10 border-sec-red/20 text-sec-red"
  return "bg-sec-orange/10 border-sec-orange/20 text-sec-orange"
}

export function PaymentsPage() {
  const { payments } = useAdminStore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")

  const filtered = payments.filter((p) =>
    p.user.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Payments</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Verify Stripe charges, process refunds, and track multi-gateway subscription revenues.</p>
        </div>
        <Button onClick={() => toast("Export", "Financial transactions summary exported.", "success")} className="gap-1.5 cursor-pointer text-[12px]">
          <Download className="w-4 h-4" /> Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `$${payments.filter(p => p.status === "succeeded").reduce((acc, p) => acc + p.amount, 0).toFixed(2)}`, color: "text-sec-green" },
          { label: "Successful Charges", value: payments.filter(p => p.status === "succeeded").length, color: "text-primary" },
          { label: "Failed Transactions", value: payments.filter(p => p.status === "failed").length, color: "text-sec-red" },
          { label: "Refunded Issues", value: payments.filter(p => p.status === "refunded").length, color: "text-sec-orange" },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-[24px] font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-txt-caption font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payee or charge ID…" className="pl-9 h-9 text-[13px]" />
        </div>
      </div>

      {/* Gateway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: "Stripe Gateway", status: "Operational", rate: "99.8% Success" },
          { name: "PayPal Portal", status: "Operational", rate: "99.4% Success" },
          { name: "Chapa / Telebirr", status: "Operational", rate: "98.2% Success" },
        ].map(g => (
          <Card key={g.name} className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[13px] font-bold text-txt-heading">{g.name}</p>
              <p className="text-[11px] text-txt-caption mt-0.5">{g.rate}</p>
            </div>
            <Badge variant="success">{g.status}</Badge>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="divide-y divide-bg-border/30">
          {filtered.map((pay) => (
            <div key={pay.id} className="flex items-center justify-between p-4 hover:bg-bg-hover/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-txt-heading truncate">{pay.description}</p>
                  <p className="text-[11px] text-txt-caption">{pay.user} · {pay.date} via {pay.provider}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border capitalize ${statusColor(pay.status)}`}>{pay.status}</span>
                <p className="text-[13.5px] font-extrabold text-txt-heading">${pay.amount.toFixed(2)}</p>
                <div className="flex gap-1 shrink-0">
                  {pay.status === "succeeded" && (
                    <button onClick={() => toast("Refunded", `Initiating refund of $${pay.amount} for ${pay.user}`, "warning")} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-sec-orange cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={() => toast("Invoice download", `Retrieving invoice for ${pay.id}`, "info")} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-primary cursor-pointer"><FileText className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
