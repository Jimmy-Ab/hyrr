import {
  Avatar,
  Button,
  Card,
  EmptyState,
  InfiniteSentinel,
  Input,
  PageHeader,
  creditSuffix,
  errorMessage,
  jobFiltersKey,
  useJobStore,
  useToast,
  type JobFilterInput,
  type WebJob,
} from "hyrr.shared"
import { ExternalLink, Globe, Loader2, MapPin, RefreshCw, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { JobCardMeta } from "./job-card-meta"
import { JobFilterBar } from "./job-filter-bar"

/**
 * Attribution only where the provider's terms require it (one small line in the detail pane):
 * - Remotive: "mention Remotive as a source" (the link back is the Apply target itself).
 * - Adzuna: "Jobs by Adzuna", linking to Adzuna.
 * Jooble and Arbeitnow publish no attribution requirement, so nothing is shown for them.
 */
function SourceAttribution({ source }: { source: WebJob["source"] }) {
  if (source === "REMOTIVE")
    return (
      <p className="mt-6 text-[12px] text-txt-caption" data-testid="source-attribution">
        Listing from{" "}
        <a
          href="https://remotive.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          Remotive
        </a>
      </p>
    )
  if (source === "ADZUNA")
    return (
      <p className="mt-6 text-[12px] text-txt-caption" data-testid="source-attribution">
        <a
          href="https://www.adzuna.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          Jobs by Adzuna
        </a>
      </p>
    )
  return null
}

const salary = (j: WebJob) => {
  if (!j.salaryMin && !j.salaryMax) return null
  const fmt = (n: number) =>
    new Intl.NumberFormat([], {
      style: j.salaryCurrency ? "currency" : "decimal",
      currency: j.salaryCurrency ?? undefined,
      maximumFractionDigits: 0,
    }).format(n)
  return [j.salaryMin, j.salaryMax]
    .filter(Boolean)
    .map((n) => fmt(n!))
    .join(" – ")
}

const ago = (iso?: string | null) => {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`
}

/**
 * Jobs from licensed job APIs. Applying charges the external apply cost once, adds the job to the
 * seeker's tracker and opens the original posting in a new tab.
 */
export function WebJobs() {
  const fetchWebJobs = useJobStore((s) => s.fetchWebJobs)
  const applyWebJob = useJobStore((s) => s.applyWebJob)
  const pricing = useJobStore((s) => s.pricing)
  const wallet = useJobStore((s) => s.wallet)
  const { toast } = useToast()
  const cost = pricing?.externalApplyCost

  const [q, setQ] = useState("")
  const [remote, setRemote] = useState(false)
  const [jobs, setJobs] = useState<WebJob[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const listRef = useRef<HTMLUListElement>(null)
  const [filters, setFilters] = useState<JobFilterInput>({})
  const filtersKey = jobFiltersKey(filters)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  // Bumped by every fresh search: a late "more" page from an older search is dropped.
  const searchSeq = useRef(0)
  const inFlight = useRef(false)

  const load = useCallback(
    async (more = false, refresh = false) => {
      if (more && (inFlight.current || !cursor)) return
      const seq = more ? searchSeq.current : ++searchSeq.current
      inFlight.current = more
      if (more) {
        setLoadingMore(true)
        setMoreError(null)
      } else {
        setLoading(true)
        setError(null)
      }
      try {
        const page = await fetchWebJobs(
          q,
          remote,
          more ? (cursor ?? undefined) : undefined,
          filters,
          refresh
        )
        if (seq !== searchSeq.current) return
        setJobs((list) => {
          if (!more) return page.items
          const seen = new Set(list.map((j) => j.id))
          return [...list, ...page.items.filter((j) => !seen.has(j.id))]
        })
        setCursor(page.nextCursor)
        if (!more) {
          setSelectedId(page.items[0]?.id ?? null)
          listRef.current?.scrollTo({ top: 0 })
        }
      } catch (err) {
        const message = errorMessage(err, "Could not load jobs from the web.")
        if (more) setMoreError(message)
        else setError(message)
      } finally {
        if (more) {
          inFlight.current = false
          setLoadingMore(false)
        } else setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchWebJobs, q, remote, cursor, filters]
  )

  useEffect(() => {
    void load()
    // Refetch when the remote toggle or a filter changes; the search box submits explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, filtersKey])

  const selected = jobs.find((j) => j.id === selectedId) ?? null

  const apply = async (job: WebJob) => {
    // Open the tab inside the click (popup blockers), point it at the posting once charged.
    const tab = window.open("about:blank", "_blank")
    setApplying(true)
    try {
      const res = await applyWebJob(job.id)
      if (tab) {
        tab.opener = null
        tab.location.href = res.url
      } else window.location.assign(res.url)
      setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, applied: true } : j)))
      toast(
        res.alreadyApplied ? "Opened the posting again" : "Opened the application",
        res.charged
          ? `${res.charged} credit${res.charged === 1 ? "" : "s"} used. It's in your tracker on Applications.`
          : "It's in your tracker on Applications.",
        "success"
      )
    } catch (err) {
      tab?.close()
      toast("Could not open the application", errorMessage(err), "error")
    } finally {
      setApplying(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void load()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Globe}
        tone="teal"
        title="Jobs from the web"
        subtitle="Openings from trusted job sites, best matches for your profile first."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load(false, true)}
            disabled={loading}
            className="gap-1.5"
            title="Re-rank these jobs for your current profile"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
        }
      />
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-caption" />
          <label htmlFor="web-q" className="sr-only">
            Search jobs from the web
          </label>
          <Input
            id="web-q"
            className="pl-10"
            placeholder="Title, company or location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-txt-body cursor-pointer">
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
          Remote only
        </label>
        <Button type="submit" disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </form>
      <JobFilterBar id="web" value={filters} onChange={setFilters} showType />

      {error ? (
        <Card role="alert" className="p-8 text-center text-[13px] text-sec-red">
          {error}
        </Card>
      ) : !loading && jobs.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No jobs from the web yet"
          description="Try other words, or check back soon: new postings arrive every few hours."
        />
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row">
          <ul
            ref={listRef}
            data-testid="web-job-list"
            className="flex w-full shrink-0 flex-col gap-2 lg:w-[360px] max-h-[70dvh] lg:max-h-[calc(100dvh-300px)] overflow-y-auto overscroll-contain pr-1 -mr-1"
          >
            {jobs.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === j.id}
                  onClick={() => setSelectedId(j.id)}
                  className={`w-full rounded-card border p-4 text-left transition-colors cursor-pointer ${
                    selectedId === j.id
                      ? "border-primary bg-bg-secondary ring-[3px] ring-primary/10"
                      : "border-bg-border/60 bg-bg-secondary/60 hover:bg-bg-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={j.company} src={j.companyLogo} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-txt-heading">{j.title}</p>
                      <p className="truncate text-[13px] text-txt-body">{j.company}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-txt-caption">
                    {j.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {j.location}
                      </span>
                    )}
                    {salary(j) && <span className="font-semibold text-primary">{salary(j)}</span>}
                    {j.match && j.match.score > 0 && (
                      <span className="font-semibold text-txt-heading">{j.match.score}% match</span>
                    )}
                    {j.applied && <span className="font-semibold text-sec-green">Applied</span>}
                  </p>
                  <JobCardMeta remote={j.remote} category={j.category} />
                </button>
              </li>
            ))}
            <li>
              <InfiniteSentinel
                rootRef={listRef}
                count={jobs.length}
                hasMore={!!cursor}
                loading={loadingMore}
                error={moreError}
                onMore={() => void load(true)}
                endLabel="That's every job from the web for now"
              />
            </li>
          </ul>

          {selected && (
            <Card className="min-w-0 flex-1 p-5 sm:p-8 lg:sticky lg:top-0 lg:self-start">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bg-border/40 pb-5">
                <div className="min-w-0">
                  <h2 className="break-words text-[20px] font-extrabold text-txt-title">
                    {selected.title}
                  </h2>
                  <p className="text-[14px] text-txt-body">
                    {selected.company}
                    {selected.location ? ` · ${selected.location}` : ""}
                    {selected.remote ? " · Remote" : ""}
                  </p>
                  <p className="mt-1 text-[12.5px] text-txt-caption">
                    {[
                      salary(selected),
                      selected.employmentType,
                      ago(selected.postedAt) && `Posted ${ago(selected.postedAt)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button onClick={() => apply(selected)} disabled={applying} className="gap-1.5">
                    {applying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    {selected.applied ? "Open the posting" : `Apply${creditSuffix(cost)}`}
                  </Button>
                  {!selected.applied && (
                    <span className="text-[11.5px] text-txt-caption">
                      Balance: {wallet?.balance ?? "–"} credits · reopening is free
                    </span>
                  )}
                </div>
              </div>
              {selected.description ? (
                <p className="mt-5 whitespace-pre-line text-[14px] leading-relaxed text-txt-body">
                  {selected.description}
                </p>
              ) : (
                <p className="mt-5 text-[13px] text-txt-caption">
                  The full description is on the original posting.
                </p>
              )}
              <SourceAttribution source={selected.source} />
              <p className="mt-2 text-[12px] text-txt-caption">
                Hyrr doesn't review external postings; apply with the usual care.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
