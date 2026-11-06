import { saveText } from "./api"

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ""
  const s = typeof v === "object" ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 CSV with a header row. Columns are taken from `columns` (key → header). */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T & string; label: string }[]
): string {
  const head = columns.map((c) => cell(c.label)).join(",")
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(","))
  return [head, ...body].join("\r\n")
}

export function downloadCsv<T extends Record<string, unknown>>(
  name: string,
  rows: T[],
  columns: { key: keyof T & string; label: string }[]
) {
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  saveText(toCsv(rows, columns), `hyrr-${slug}-${stamp}.csv`)
}
