import { useState } from "react"
import { Search, UserX, UserCheck, Trash2, RotateCcw, Eye, Filter, Download } from "lucide-react"
import { Card } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Input } from "hyrr.shared"
import { useAdminStore, type AdminUser } from "../store/useAdminStore"
import { useToast } from "hyrr.shared"

const statusBadge = (status: AdminUser["status"]) => {
  if (status === "active")    return <Badge variant="success">Active</Badge>
  if (status === "suspended") return <Badge variant="destructive">Suspended</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

export function UsersPage() {
  const { users, updateUserStatus } = useAdminStore()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AdminUser["status"] | "all">("all")
  const [selected, setSelected] = useState<AdminUser | null>(null)

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || u.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Users</h1>
          <p className="text-body text-txt-body mt-1 font-medium">Manage all registered job seeker accounts on the platform.</p>
        </div>
        <Button onClick={() => toast("Export", "User data export queued.", "success")} variant="secondary" className="gap-2 cursor-pointer text-[12.5px]">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Users",    value: users.length,                                              color: "text-primary" },
          { label: "Active",         value: users.filter((u) => u.status === "active").length,         color: "text-sec-green" },
          { label: "Suspended",      value: users.filter((u) => u.status === "suspended").length,      color: "text-sec-red" },
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
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-9 h-9 text-[13px]" />
        </div>
        <div className="flex gap-1 bg-bg-secondary border border-bg-border p-1 rounded-[12px]">
          {(["all", "active", "suspended", "pending"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-[9px] text-[12px] font-semibold cursor-pointer capitalize transition-all ${statusFilter === s ? "bg-primary text-white" : "text-txt-body hover:bg-bg-hover"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Table */}
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="divide-y divide-bg-border/30">
            {filtered.map((user) => (
              <div
                key={user.id}
                onClick={() => setSelected(selected?.id === user.id ? null : user)}
                className={`flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-bg-hover/50 ${selected?.id === user.id ? "bg-primary-light/30" : ""}`}
              >
                <img src={user.avatar} className="w-10 h-10 rounded-full object-cover shrink-0 border border-bg-border" alt={user.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-txt-heading truncate">{user.name}</p>
                  <p className="text-[12px] text-txt-caption">{user.email}</p>
                </div>
                <div className="text-center shrink-0 hidden md:block">
                  <p className="text-[12.5px] font-bold text-txt-heading">{user.applications}</p>
                  <p className="text-[10px] text-txt-caption">apps</p>
                </div>
                <div className="text-center shrink-0 hidden md:block">
                  <p className="text-[12.5px] font-bold text-sec-orange">{user.momentum}</p>
                  <p className="text-[10px] text-txt-caption">momentum</p>
                </div>
                {statusBadge(user.status)}
                <div className="flex gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setSelected(user) }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-primary cursor-pointer transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); const ns = user.status === "active" ? "suspended" : "active"; updateUserStatus(user.id, ns); toast(ns === "suspended" ? "Suspended" : "Activated", `${user.name} ${ns}.`, ns === "suspended" ? "warning" : "success") }}
                    className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-sec-red cursor-pointer transition-colors"
                  >
                    {user.status === "active" ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toast("Password reset", `Reset email sent to ${user.email}`, "info") }} className="p-1.5 hover:bg-bg-hover rounded-[8px] text-txt-caption hover:text-sec-orange cursor-pointer transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 flex flex-col items-center gap-2 text-txt-caption">
                <Search className="w-8 h-8 opacity-30" />
                <p className="text-[13px]">No users match your search</p>
              </div>
            )}
          </div>
        </Card>

        {/* User Detail Panel */}
        {selected ? (
          <Card className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <img src={selected.avatar} className="w-16 h-16 rounded-full object-cover mx-auto border-4 border-bg-secondary shadow-card" alt={selected.name} />
              <h2 className="text-[16px] font-bold text-txt-heading">{selected.name}</h2>
              <p className="text-[12px] text-txt-caption">{selected.email}</p>
              {statusBadge(selected.status)}
            </div>
            <div className="space-y-2">
              {[
                { label: "Joined",           value: selected.joined },
                { label: "Last Login",       value: selected.lastLogin },
                { label: "Profile Complete", value: `${selected.profileComplete}%` },
                { label: "Applications",     value: selected.applications },
                { label: "Momentum Balance", value: `${selected.momentum} credits` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-bg-border/30 last:border-0">
                  <span className="text-[12px] text-txt-caption font-medium">{row.label}</span>
                  <span className="text-[12.5px] font-semibold text-txt-heading">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant={selected.status === "active" ? "secondary" : "primary"}
                onClick={() => { const ns = selected.status === "active" ? "suspended" : "active"; updateUserStatus(selected.id, ns); toast(ns === "suspended" ? "Suspended" : "Activated", `${selected.name} updated.`, "success") }}
                className="w-full cursor-pointer text-[12px]"
              >
                {selected.status === "active" ? "Suspend User" : "Activate User"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toast("Reset", `Email sent to ${selected.email}`, "info")} className="w-full cursor-pointer text-[12px]">Reset Password</Button>
              <Button size="sm" variant="ghost" onClick={() => toast("Deleted", `${selected.name} removed.`, "warning")} className="w-full cursor-pointer text-[12px] text-sec-red hover:text-sec-red">Delete Account</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 flex flex-col items-center justify-center gap-3 min-h-[240px] border-dashed">
            <Eye className="w-8 h-8 text-txt-disabled" />
            <p className="text-[13px] text-txt-caption text-center">Select a user to view<br />their full profile</p>
          </Card>
        )}
      </div>
    </div>
  )
}
