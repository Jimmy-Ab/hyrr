import { TonePill } from "hyrr.shared"
import { auditReason } from "../../lib/audit"
import { dateTime, humanize } from "../../lib/format"
import { severityTone } from "../../lib/tones"
import type { AuditRow } from "../../lib/types"

/** Compact audit trail for detail sheets. */
export function AuditList({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) return <p className="text-[13px] text-txt-caption">No admin actions yet.</p>
  return (
    <ol className="relative flex flex-col gap-3 border-l border-bg-border pl-4">
      {rows.map((r) => {
        const reason = auditReason(r)
        return (
          <li key={r.id} className="relative">
            <span
              className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-bg-border ring-4 ring-bg-secondary"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-txt-heading">
                {humanize(r.action)}
              </span>
              {r.severity !== "info" && (
                <TonePill tone={severityTone(r.severity)}>{humanize(r.severity)}</TonePill>
              )}
            </div>
            <p className="text-[12.5px] text-txt-body">{r.details}</p>
            {reason && <p className="mt-0.5 text-[12.5px] italic text-txt-body">“{reason}”</p>}
            <p className="mt-0.5 text-[11.5px] text-txt-caption">
              {r.actor?.name ?? "System"} · {dateTime(r.createdAt)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
