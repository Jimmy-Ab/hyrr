import { Button, EmptyState, PageHeader, TonePill, errorMessage, useToast } from "hyrr.shared"
import { Download, ScrollText } from "lucide-react"
import * as React from "react"
import {
  DataTable,
  ErrorBlock,
  LoadMore,
  LoadingRows,
  SearchBox,
  td,
} from "../components/ui/common"
import { downloadFromApi, qs, useAdminQuery, useCursorList } from "../lib/api"
import { auditReason } from "../lib/audit"
import { dateTime, humanize } from "../lib/format"
import { severityTone } from "../lib/tones"
import type { AdminUser, AuditRow, Page } from "../lib/types"

const controlCls =
  "h-10 rounded-input border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-heading focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15 [color-scheme:light] dark:[color-scheme:dark]"

export function AuditLog() {
  const { toast } = useToast()
  const [actorId, setActorId] = React.useState("")
  const [action, setAction] = React.useState("")
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [exporting, setExporting] = React.useState(false)
  const admins = useAdminQuery<Page<AdminUser>>("/users", { role: "ADMIN", limit: 100 })

  const filters = {
    actorId: actorId || undefined,
    action: action || undefined,
    from: from ? new Date(`${from}T00:00:00Z`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59Z`).toISOString() : undefined,
  }
  const list = useCursorList<AuditRow>("/audit", filters, 50)
  const filtered = !!(actorId || action || from || to)

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadFromApi(
        `/audit.csv${qs(filters)}`,
        `hyrr-audit-${new Date().toISOString().slice(0, 10)}.csv`
      )
    } catch (err: any) {
      toast("Couldn't export the audit log", errorMessage(err), "error")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Audit log"
        icon={ScrollText}
        tone="slate"
        subtitle="Every admin action: who, what, why and from where"
        actions={
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={exporting}>
            <Download className="h-3.5 w-3.5" /> {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="audit-actor"
            className="mb-1 block text-[11.5px] font-semibold text-txt-caption"
          >
            Admin
          </label>
          <select
            id="audit-actor"
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            className={`${controlCls} min-w-[200px] cursor-pointer`}
          >
            <option value="">All admins</option>
            {admins.data?.items.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <span
            className="mb-1 block text-[11.5px] font-semibold text-txt-caption"
            aria-hidden="true"
          >
            Action
          </span>
          <SearchBox
            value={action}
            onChange={setAction}
            placeholder="e.g. user.suspend"
            label="Filter by action"
            className="sm:w-[220px]"
          />
        </div>
        <div>
          <label
            htmlFor="audit-from"
            className="mb-1 block text-[11.5px] font-semibold text-txt-caption"
          >
            From
          </label>
          <input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={controlCls}
          />
        </div>
        <div>
          <label
            htmlFor="audit-to"
            className="mb-1 block text-[11.5px] font-semibold text-txt-caption"
          >
            To
          </label>
          <input
            id="audit-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={controlCls}
          />
        </div>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActorId("")
              setAction("")
              setFrom("")
              setTo("")
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <LoadingRows />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          tone="slate"
          title={filtered ? "Nothing matches" : "No admin actions yet"}
          description={
            filtered
              ? "Try a wider date range or another admin."
              : "Suspensions, removals, credit adjustments and price changes are recorded here."
          }
        />
      ) : (
        <div>
          <DataTable head={["When", "Admin", "Action", "Target", "Details", "IP"]}>
            {list.items.map((r) => {
              const reason = auditReason(r)
              return (
                <tr key={r.id} className="border-b border-bg-border/50 align-top">
                  <td className={`${td} whitespace-nowrap text-txt-body`}>
                    {dateTime(r.createdAt)}
                  </td>
                  <td className={td}>
                    <span className="block font-semibold text-txt-heading">
                      {r.actor?.name ?? "System"}
                    </span>
                    <span className="block text-[11.5px] text-txt-caption">{r.actor?.email}</span>
                  </td>
                  <td className={td}>
                    <span className="flex flex-col items-start gap-1">
                      <span className="font-mono text-[12px] text-txt-heading">{r.action}</span>
                      {r.severity !== "info" && (
                        <TonePill tone={severityTone(r.severity)}>{humanize(r.severity)}</TonePill>
                      )}
                    </span>
                  </td>
                  <td className={`${td} max-w-[200px] break-words text-txt-body`}>{r.target}</td>
                  <td className={`${td} max-w-[360px]`}>
                    <span className="block text-txt-heading">{r.details}</span>
                    {reason && (
                      <span className="mt-0.5 block italic text-txt-body">“{reason}”</span>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap font-mono text-[12px] text-txt-caption`}>
                    {r.ip || "—"}
                  </td>
                </tr>
              )
            })}
          </DataTable>
          <LoadMore
            shown={list.items.length}
            hasMore={!!list.hasNextPage}
            loading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          />
        </div>
      )}
    </div>
  )
}
