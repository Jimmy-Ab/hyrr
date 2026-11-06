import type { AuditRow } from "./types"

/** Reason stored in an audit row's meta, if any. */
export const auditReason = (row: AuditRow): string | null => {
  const r = row.meta && (row.meta as Record<string, unknown>).reason
  return typeof r === "string" && r ? r : null
}
