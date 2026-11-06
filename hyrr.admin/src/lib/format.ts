const nf = new Intl.NumberFormat("en-US")
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

export const num = (n: number | null | undefined) => (n == null ? "—" : nf.format(n))
export const short = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : nf.format(n))

/** Integer cents → "$1,234" (or "ETB 1,234"). Whole units unless `cents` is small. */
export function money(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "—"
  const units = cents / 100
  const digits = Math.abs(units) < 100 && units % 1 !== 0 ? 2 : 0
  const value = units.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return currency.toUpperCase() === "USD" ? `$${value}` : `${currency.toUpperCase()} ${value}`
}

export const pct = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`

/** A value already in percent (0–100), as the analytics endpoint returns them. */
export const pct100 = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v) ? "—" : `${Number(v).toFixed(digits)}%`

/** Period-over-period change as a ratio (0.12 = +12%); null when there's no base. */
export function change(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return (current - previous) / previous
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export const date = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "—")
export const dateTime = (iso: string | null | undefined) =>
  iso ? dateTimeFmt.format(new Date(iso)) : "—"

/** "3 min ago", "2 d ago", falls back to the date after 30 days. */
export function ago(iso: string | null | undefined) {
  if (!iso) return "Never"
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return "Just now"
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`
  return date(iso)
}

/** Bucket label for a series point ("Mar 4", "Mar 2026"). */
export function bucketLabel(iso: string, interval: "day" | "week" | "month") {
  const d = new Date(iso)
  return interval === "month"
    ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/** "IN_PROCESS" → "In process". */
export const humanize = (code: string | null | undefined) =>
  code ? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ") : "—"

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?"
