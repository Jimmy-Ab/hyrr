import type { ExternalJobSource } from "@prisma/client"

/** One posting from any licensed job API, normalised. */
export type ExternalJobInput = {
  source: ExternalJobSource
  sourceId: string
  title: string
  company: string
  /** Provider-supplied logo (https only); null = initials avatar in the app. */
  companyLogo: string | null
  location: string | null
  remote: boolean
  description: string | null
  url: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  employmentType: string | null
  category: string | null
  postedAt: Date | null
}

export const DESCRIPTION_MAX = 4000
const FETCH_TIMEOUT_MS = 15_000

/** HTML → readable plain text (descriptions are shown as text, never rendered as HTML). */
export function plainText(html: unknown, max = DESCRIPTION_MAX): string | null {
  if (typeof html !== "string" || !html.trim()) return null
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
  return text ? text.slice(0, max) : null
}

const httpUrl = (v: unknown) => (typeof v === "string" && /^https?:\/\//i.test(v) ? v : null)

/** Image URLs: https only (no mixed content), bounded length. */
const httpsUrl = (v: unknown) =>
  typeof v === "string" && v.length <= 500 && /^https:\/\/[^\s]+$/i.test(v) ? v : null
const int = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : v
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}
const date = (v: unknown) => {
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v ?? ""))
  return Number.isNaN(d.getTime()) ? null : d
}
const str = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null
const isRemote = (...parts: unknown[]) =>
  parts.some((p) => typeof p === "string" && /remote|anywhere|worldwide/i.test(p))

function valid(job: ExternalJobInput | null): job is ExternalJobInput {
  return !!job && !!job.sourceId && !!job.title && !!job.company && !!job.url
}

// ─── Adzuna (https://developer.adzuna.com) ───────────────────────────────────
const ADZUNA_CURRENCY: Record<string, string> = {
  gb: "GBP",
  us: "USD",
  de: "EUR",
  fr: "EUR",
  nl: "EUR",
  it: "EUR",
  es: "EUR",
  at: "EUR",
  be: "EUR",
  ca: "CAD",
  au: "AUD",
  nz: "NZD",
  in: "INR",
  za: "ZAR",
  sg: "SGD",
  br: "BRL",
  mx: "MXN",
  pl: "PLN",
  ch: "CHF",
}
export function mapAdzuna(raw: any, country: string): ExternalJobInput | null {
  const job: ExternalJobInput = {
    source: "ADZUNA",
    sourceId: String(raw?.id ?? ""),
    title: str(raw?.title) ?? "",
    company: str(raw?.company?.display_name) ?? "",
    companyLogo: null,
    location: str(raw?.location?.display_name),
    remote: isRemote(raw?.title, raw?.location?.display_name),
    description: plainText(raw?.description),
    url: httpUrl(raw?.redirect_url) ?? "",
    salaryMin: int(raw?.salary_min),
    salaryMax: int(raw?.salary_max),
    salaryCurrency: raw?.salary_min || raw?.salary_max ? (ADZUNA_CURRENCY[country] ?? null) : null,
    employmentType: str(raw?.contract_time ?? raw?.contract_type, 40),
    category: str(raw?.category?.label, 80),
    postedAt: date(raw?.created),
  }
  return valid(job) ? job : null
}

// ─── Jooble (https://jooble.org/api/about) ───────────────────────────────────
export function mapJooble(raw: any): ExternalJobInput | null {
  const job: ExternalJobInput = {
    source: "JOOBLE",
    sourceId: String(raw?.id ?? ""),
    title: str(raw?.title) ?? "",
    company: str(raw?.company) ?? "",
    companyLogo: null,
    location: str(raw?.location),
    remote: isRemote(raw?.title, raw?.location, raw?.type),
    description: plainText(raw?.snippet),
    url: httpUrl(raw?.link) ?? "",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    employmentType: str(raw?.type, 40),
    category: null,
    postedAt: date(raw?.updated),
  }
  return valid(job) ? job : null
}

// ─── Remotive (https://remotive.com/api-documentation) ─ must link back ──────
export function mapRemotive(raw: any): ExternalJobInput | null {
  const job: ExternalJobInput = {
    source: "REMOTIVE",
    sourceId: String(raw?.id ?? ""),
    title: str(raw?.title) ?? "",
    company: str(raw?.company_name) ?? "",
    // Remotive is the only provider with a logo field; served from its own CDN (https only).
    companyLogo: httpsUrl(raw?.company_logo ?? raw?.company_logo_url),
    location: str(raw?.candidate_required_location) ?? "Remote",
    remote: true,
    description: plainText(raw?.description),
    url: httpUrl(raw?.url) ?? "",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    employmentType: str(raw?.job_type, 40),
    category: str(raw?.category, 80),
    postedAt: date(raw?.publication_date),
  }
  return valid(job) ? job : null
}

// ─── Arbeitnow (https://www.arbeitnow.com/blog/job-board-api) ────────────────
export function mapArbeitnow(raw: any): ExternalJobInput | null {
  const job: ExternalJobInput = {
    source: "ARBEITNOW",
    sourceId: String(raw?.slug ?? ""),
    title: str(raw?.title) ?? "",
    company: str(raw?.company_name) ?? "",
    companyLogo: null,
    location: str(raw?.location),
    remote: raw?.remote === true || isRemote(raw?.location),
    description: plainText(raw?.description),
    url: httpUrl(raw?.url) ?? "",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    employmentType: Array.isArray(raw?.job_types) ? str(raw.job_types[0], 40) : null,
    category: Array.isArray(raw?.tags) ? str(raw.tags[0], 80) : null,
    postedAt: date(raw?.created_at),
  }
  return valid(job) ? job : null
}

// ─── Fetchers (only providers with keys / switched on run) ───────────────────
const list = (v: string | undefined, fallback: string) =>
  (v ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": "HyrrJobs/1.0", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export type Provider = {
  source: ExternalJobSource
  enabled: boolean
  fetch: (max: number) => Promise<ExternalJobInput[]>
}

export function providers(env = process.env): Provider[] {
  const queries = list(
    env.EXTERNAL_JOBS_QUERIES,
    "software engineer,product designer,data analyst,marketing,sales"
  )
  const off = (v?: string) => (v ?? "true").trim().toLowerCase() === "false"
  return [
    {
      source: "ADZUNA",
      enabled: !!env.ADZUNA_APP_ID && !!env.ADZUNA_APP_KEY,
      fetch: async (max) => {
        const out: ExternalJobInput[] = []
        for (const country of list(env.ADZUNA_COUNTRIES, "gb,us"))
          for (const what of queries) {
            if (out.length >= max) return out
            const qs = new URLSearchParams({
              app_id: env.ADZUNA_APP_ID!,
              app_key: env.ADZUNA_APP_KEY!,
              results_per_page: "50",
              what,
              max_days_old: "14",
            })
            const data = await getJson(
              `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${qs}`
            )
            for (const r of data?.results ?? []) {
              const job = mapAdzuna(r, country)
              if (job) out.push(job)
            }
          }
        return out
      },
    },
    {
      source: "JOOBLE",
      enabled: !!env.JOOBLE_API_KEY,
      fetch: async (max) => {
        const out: ExternalJobInput[] = []
        for (const keywords of queries)
          for (const location of list(env.JOOBLE_LOCATIONS, "")) {
            if (out.length >= max) return out
            const data = await getJson(`https://jooble.org/api/${env.JOOBLE_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ keywords, location, page: 1 }),
            })
            for (const r of data?.jobs ?? []) {
              const job = mapJooble(r)
              if (job) out.push(job)
            }
          }
        return out
      },
    },
    {
      // Free, no key; their terms ask for a link back and few requests per day.
      source: "REMOTIVE",
      enabled: !off(env.REMOTIVE_ENABLED),
      fetch: async (max) => {
        const data = await getJson(
          `https://remotive.com/api/remote-jobs?limit=${Math.min(max, 200)}`
        )
        return ((data?.jobs ?? []).map(mapRemotive).filter(Boolean) as ExternalJobInput[]).slice(
          0,
          max
        )
      },
    },
    {
      source: "ARBEITNOW",
      enabled: !off(env.ARBEITNOW_ENABLED),
      fetch: async (max) => {
        const data = await getJson("https://www.arbeitnow.com/api/job-board-api")
        return ((data?.data ?? []).map(mapArbeitnow).filter(Boolean) as ExternalJobInput[]).slice(
          0,
          max
        )
      },
    },
  ]
}
