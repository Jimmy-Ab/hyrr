import {
  APPLICATION_STATUS,
  ActiveIndicator,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  EmptyState,
  FilterChips,
  InfiniteSentinel,
  Input,
  JOB_REPORT_REASONS,
  JOB_TYPES,
  MatchScore,
  PageHeader,
  RichTextRenderer,
  VerifiedBadge,
  creditSuffix,
  employmentTypeCode,
  errorMessage,
  insufficientCreditsDetails,
  isApiError,
  isInsufficientCredits,
  jobFiltersKey,
  takePendingJob,
  useJobStore,
  useToast,
  type JobFilterInput,
  type JobMatch,
  type JobReportReason,
  type JobType,
  type MatchTab,
  type PublicJob,
  type SavedSearchItem,
  type ScreeningQuestion,
} from "hyrr.shared"
import {
  AlertTriangle,
  Bookmark,
  BookmarkPlus,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  DollarSign,
  Flag,
  Globe,
  History,
  Languages,
  MailWarning,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserPen,
  Zap,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { CvTailorButton } from "../components/cv-tailor"
import { JobCardMeta } from "../components/job-card-meta"
import { JobFilterBar } from "../components/job-filter-bar"
import { WebJobs } from "../components/web-jobs"
import { useFillHeight } from "../lib/use-fill-height"

const colorBg: Record<string, string> = {
  purple: "bg-primary text-white",
  blue: "bg-sec-blue text-white",
  green: "bg-sec-green text-white",
  orange: "bg-sec-orange text-white",
}

const MATCH_TABS: { id: MatchTab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "all", label: "All jobs" },
]

function MatchBadge({ match }: { match: JobMatch }) {
  return (
    <MatchScore
      score={match.score}
      title={`${match.score}% match with your profile`}
      className="self-start"
    />
  )
}

function ReasonChips({ reasons, max }: { reasons: string[]; max: number }) {
  if (reasons.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.slice(0, max).map((r) => (
        <span
          key={r}
          className="rounded-full border border-bg-border bg-bg-primary px-2 py-0.5 text-[11px] font-medium text-txt-body"
        >
          {r}
        </span>
      ))}
    </div>
  )
}

function JobSkeleton() {
  return (
    <div className="p-4 rounded-card border border-bg-border/40 bg-bg-secondary/60 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-bg-border/60 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-bg-border/60 rounded w-3/4" />
          <div className="h-3 bg-bg-border/40 rounded w-1/2" />
          <div className="flex gap-2 mt-2">
            <div className="h-3 bg-bg-border/40 rounded w-16" />
            <div className="h-3 bg-bg-border/40 rounded w-12" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DiscoverHyrr({ sourceSwitch }: { sourceSwitch?: ReactNode }) {
  const {
    publicJobs,
    publicJobsLoading,
    jobApplications,
    discoverSearch,
    discoverTypeFilter,
    setDiscoverSearch,
    setDiscoverTypeFilter,
    applyFromDiscover,
    saveJobFromDiscover,
    setCandidateActiveView,
    seekerProfile,
    documents,
    fetchApplications,
    reportJob,
    resendVerification,
    matchedJobs,
    matchTab,
    matchedJobsLoading,
    thinProfile,
    fetchMatchedJobs,
    savedSearches,
    fetchSavedSearches,
    createSavedSearch,
    deleteSavedSearch,
    fetchScreeningQuestions,
    wallet,
    pricing,
  } = useJobStore()
  const applyCost = pricing?.applyCost
  const balance = wallet?.balance ?? null
  const [noCredits, setNoCredits] = useState<{ balance: number; required: number } | null>(null)
  const { toast } = useToast()

  // ── Matches ─────────────────────────────────────────────────────────────
  const [matchError, setMatchError] = useState<string | null>(null)
  // Tab whose results are in matchedJobs (cached from an earlier visit counts).
  const [loadedTab, setLoadedTab] = useState<MatchTab | null>(() => {
    const st = useJobStore.getState()
    return st.matchedJobs.length > 0 || st.thinProfile ? st.matchTab : null
  })
  const [locationFilter, setLocationFilter] = useState("")
  const [remoteOnly, setRemoteOnly] = useState(false)
  // Category, salary and recency (server-side); type and remote come from the controls above.
  const [extraFilters, setExtraFilters] = useState<JobFilterInput>(() => {
    const st = useJobStore.getState()
    const { categoryId, salary, postedWithin, matchLanguages } = st.matchFilters
    return {
      categoryId,
      salary,
      postedWithin,
      // On by default when the profile lists languages (kept as chosen afterwards).
      matchLanguages:
        matchLanguages ?? ((st.seekerProfile?.languages?.length ?? 0) > 0 || undefined),
    }
  })
  const serverFilters: JobFilterInput = {
    ...extraFilters,
    remote: remoteOnly || undefined,
    type:
      discoverTypeFilter && discoverTypeFilter !== "All"
        ? employmentTypeCode(discoverTypeFilter as JobType)
        : undefined,
  }
  const serverFiltersRef = useRef(serverFilters)
  serverFiltersRef.current = serverFilters
  const filtersKey = jobFiltersKey(serverFilters)

  const loadMatches = useCallback(
    async (tab: MatchTab, opts?: { refresh?: boolean }) => {
      setMatchError(null)
      try {
        await fetchMatchedJobs(tab, serverFiltersRef.current, opts)
        setLoadedTab(tab)
      } catch (err) {
        if (useJobStore.getState().matchTab === tab) {
          setMatchError(errorMessage(err, "Could not load jobs."))
        }
      }
    },
    [fetchMatchedJobs]
  )

  useEffect(() => {
    void loadMatches(useJobStore.getState().matchTab)
    fetchSavedSearches().catch((e) => console.warn("Failed to load saved searches.", e))
  }, [loadMatches, fetchSavedSearches])

  // Filters changed: reload page one of the current tab with them.
  const firstFilters = useRef(true)
  useEffect(() => {
    if (firstFilters.current) {
      firstFilters.current = false
      return
    }
    void loadMatches(useJobStore.getState().matchTab)
  }, [filtersKey, loadMatches])

  const switchTab = (tab: MatchTab) => {
    if (tab === matchTab && !matchError) return
    void loadMatches(tab)
  }

  // ── Saved searches ──────────────────────────────────────────────────────
  const [saveSearchOpen, setSaveSearchOpen] = useState(false)
  const [searchName, setSearchName] = useState("")
  const [saveSearchError, setSaveSearchError] = useState<string | null>(null)
  const [savingSearch, setSavingSearch] = useState(false)
  const [deleteSearch, setDeleteSearch] = useState<SavedSearchItem | null>(null)

  const openSaveSearch = () => {
    const parts = [
      discoverSearch.trim(),
      discoverTypeFilter !== "All" ? discoverTypeFilter : "",
      locationFilter.trim(),
      remoteOnly ? "Remote" : "",
    ].filter(Boolean)
    setSearchName(parts.join(" · ").slice(0, 80) || (matchTab === "for-you" ? "For you" : ""))
    setSaveSearchError(null)
    setSaveSearchOpen(true)
  }

  const submitSaveSearch = async () => {
    const name = searchName.trim()
    if (!name) {
      setSaveSearchError("Give this search a name.")
      return
    }
    setSavingSearch(true)
    setSaveSearchError(null)
    try {
      await createSavedSearch({
        name,
        query: discoverSearch.trim() || undefined,
        filters: {
          ...(discoverTypeFilter !== "All" ? { type: discoverTypeFilter } : {}),
          ...(locationFilter.trim() ? { location: locationFilter.trim() } : {}),
          ...(remoteOnly ? { remote: true } : {}),
          tab: matchTab,
        },
      })
      toast("Search saved", `"${name}" is in your saved searches.`, "success")
      setSaveSearchOpen(false)
    } catch (err) {
      setSaveSearchError(
        isApiError(err) && err.errorCode === "SAVED_SEARCH_LIMIT"
          ? "You've reached the limit of 20 saved searches. Delete one to save another."
          : errorMessage(err, "Please try again.")
      )
    } finally {
      setSavingSearch(false)
    }
  }

  const applySavedSearch = (s: SavedSearchItem) => {
    setDiscoverSearch(s.query)
    setDiscoverTypeFilter(s.filters.type || "All")
    setLocationFilter(s.filters.location || "")
    setRemoteOnly(!!s.filters.remote)
    const tab = s.filters.tab ?? "all"
    if (tab !== matchTab || matchError) void loadMatches(tab)
  }

  const confirmDeleteSearch = async () => {
    if (!deleteSearch) return
    try {
      await deleteSavedSearch(deleteSearch.id)
      toast("Saved search deleted", deleteSearch.name, "success")
    } catch (err) {
      toast("Couldn't delete saved search", errorMessage(err), "error")
      throw err
    }
  }

  // ── Screening questions (apply dialog) ──────────────────────────────────
  const [questions, setQuestions] = useState<ScreeningQuestion[] | null>(null)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answerErrors, setAnswerErrors] = useState<Set<string>>(() => new Set())

  const loadQuestions = async (jobId: string) => {
    setQuestions(null)
    setQuestionsError(null)
    try {
      const list = await fetchScreeningQuestions(jobId)
      setQuestions(list.filter((q) => q.id))
    } catch (err) {
      setQuestionsError(errorMessage(err, "Could not load the application questions."))
    }
  }

  const [selectedJob, setSelectedJob] = useState<PublicJob | null>(null)
  const [applyJob, setApplyJob] = useState<PublicJob | null>(null)
  const [resumeId, setResumeId] = useState<string>("")
  const [coverLetter, setCoverLetter] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applyBlocked, setApplyBlocked] = useState(false)
  const [resending, setResending] = useState(false)
  const [reportJobTarget, setReportJobTarget] = useState<PublicJob | null>(null)
  const [reportReason, setReportReason] = useState<JobReportReason>("SCAM")
  const [reportDetails, setReportDetails] = useState("")
  const [reporting, setReporting] = useState(false)
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set())
  const detailRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Wide screens: list + detail fill from where they start to the bottom of the screen.
  const { ref: splitRef, height: splitHeight } = useFillHeight()
  const matchedJobsCursor = useJobStore((s) => s.matchedJobsCursor)
  const matchedJobsLoadingMore = useJobStore((s) => s.matchedJobsLoadingMore)
  const fetchMoreMatchedJobs = useJobStore((s) => s.fetchMoreMatchedJobs)
  const [moreError, setMoreError] = useState<string | null>(null)
  const loadMore = useCallback(() => {
    setMoreError(null)
    fetchMoreMatchedJobs().catch((err) => setMoreError(errorMessage(err)))
  }, [fetchMoreMatchedJobs])

  const resumes = documents.filter((d) => d.type === "resume")

  // "All jobs" falls back to the plain public list when matching is unavailable.
  const useFallback = !!matchError && matchTab === "all"
  const sourceJobs = useFallback ? publicJobs : matchedJobs
  // Skeleton only when there is nothing current to show (no flash on background refetch).
  const listLoading = useFallback
    ? publicJobsLoading
    : !matchError && (loadedTab !== matchTab || (matchedJobsLoading && matchedJobs.length === 0))

  const filtered = sourceJobs.filter((j) => {
    const matchType = discoverTypeFilter === "All" || j.type === discoverTypeFilter
    const q = discoverSearch.toLowerCase()
    const matchSearch =
      !q ||
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.skills.some((s) => s.toLowerCase().includes(q))
    const loc = locationFilter.trim().toLowerCase()
    const matchLocation = !loc || j.location.toLowerCase().includes(loc)
    const matchRemote = !remoteOnly || !!j.remote || j.type === "Remote"
    return matchType && matchSearch && matchLocation && matchRemote
  })

  // Arriving from a public job page (/jobs/<id> → Apply on Hyrr): open that job.
  const pendingTried = useRef(false)
  useEffect(() => {
    if (listLoading) return
    const pending = takePendingJob(true)
    if (!pending) return
    const job = filtered.find((j) => j.id === pending)
    if (job) {
      takePendingJob()
      setSelectedJob(job)
    } else if (!pendingTried.current && matchTab !== "all") {
      pendingTried.current = true
      void loadMatches("all")
    } else takePendingJob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listLoading, filtered.map((j) => j.id).join(",")])

  // Keep the selection inside the visible list (tab switches and filters change it).
  useEffect(() => {
    if (listLoading) return
    if (takePendingJob(true)) return
    if (!selectedJob || !filtered.some((j) => j.id === selectedJob.id)) {
      setSelectedJob(filtered[0] ?? null)
    } else {
      const fresh = filtered.find((j) => j.id === selectedJob.id)
      if (fresh && fresh !== selectedJob) setSelectedJob(fresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((j) => j.id).join(","), listLoading])

  const hasFilters =
    !!discoverSearch.trim() || discoverTypeFilter !== "All" || !!locationFilter.trim() || remoteOnly

  const clearFilters = () => {
    setDiscoverSearch("")
    setDiscoverTypeFilter("All")
    setLocationFilter("")
    setRemoteOnly(false)
  }

  const applicationFor = (id: string) => jobApplications.find((a) => a.publicJobId === id)
  const isApplied = (id: string) => {
    const app = applicationFor(id)
    return !!app && app.status !== APPLICATION_STATUS.SAVED
  }
  const isSaved = (id: string) => applicationFor(id)?.status === APPLICATION_STATUS.SAVED
  const isWithdrawn = (id: string) => applicationFor(id)?.status === APPLICATION_STATUS.WITHDRAWN

  const selectJob = (job: PublicJob) => {
    setSelectedJob(job)
    // On narrow screens the detail pane is below the list.
    if (window.matchMedia?.("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth" }))
    } else {
      // Wide screens: the detail pane scrolls on its own; start each job at its top.
      requestAnimationFrame(() => detailRef.current?.scrollTo({ top: 0 }))
    }
  }

  const openApply = (job: PublicJob) => {
    if (isApplied(job.id)) return
    const active = resumes.find((d) => d.active) ?? resumes[0]
    setResumeId(active?.id ?? "")
    setCoverLetter("")
    setApplyBlocked(false)
    setNoCredits(null)
    setAnswers({})
    setAnswerErrors(new Set())
    setApplyJob(job)
    void loadQuestions(job.id)
  }

  const submitApplication = async () => {
    if (!applyJob) return
    const resume = resumes.find((d) => d.id === resumeId)
    const missing = (questions ?? [])
      .filter((q) => q.required && q.id && !answers[q.id]?.trim())
      .map((q) => q.id as string)
    if (missing.length > 0) {
      setAnswerErrors(new Set(missing))
      document.getElementById(`apply-q-${missing[0]}`)?.focus()
      return
    }
    setAnswerErrors(new Set())
    setSubmitting(true)
    try {
      await applyFromDiscover(applyJob.id, {
        resumeUrl: resume?.url || undefined,
        coverLetter: coverLetter.trim() || undefined,
        answers: (questions ?? [])
          .filter((q) => q.id && answers[q.id]?.trim())
          .map((q) => ({ questionId: q.id as string, answer: answers[q.id as string].trim() })),
      })
      toast("Applied!", `Your application to ${applyJob.company} has been submitted.`, "success")
      setApplyJob(null)
      setCandidateActiveView("Applications")
    } catch (err) {
      if (isInsufficientCredits(err)) {
        setNoCredits(
          insufficientCreditsDetails(err) ?? { balance: balance ?? 0, required: applyCost ?? 0 }
        )
      } else if (isApiError(err) && err.errorCode === "EMAIL_NOT_VERIFIED") {
        setApplyBlocked(true)
        useJobStore.setState((s) => (s.user ? { user: { ...s.user, emailVerified: false } } : {}))
      } else if (isApiError(err) && err.errorCode === "SCREENING_ANSWERS_REQUIRED") {
        const ids = Array.isArray(err.details)
          ? err.details.filter((d): d is string => typeof d === "string")
          : []
        // The question set may have changed since the dialog opened.
        if (ids.some((id) => !questions?.some((q) => q.id === id))) {
          await loadQuestions(applyJob.id)
        }
        setAnswerErrors(new Set(ids))
        toast("Answer the required questions", "Some required questions are unanswered.", "error")
      } else if (isApiError(err) && err.errorCode === "ALREADY_APPLIED") {
        toast("Already applied", "You have already applied to this job.", "info")
        setApplyJob(null)
        fetchApplications().catch(() => {})
      } else {
        toast("Application failed", errorMessage(err, "Please try again."), "error")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await resendVerification()
      toast("Verification e-mail sent", "Open the link in it, then apply again.", "success")
    } catch (err) {
      toast("Couldn't send e-mail", errorMessage(err), "error")
    } finally {
      setResending(false)
    }
  }

  const openReport = (job: PublicJob) => {
    setReportReason("SCAM")
    setReportDetails("")
    setReportJobTarget(job)
  }

  const submitReport = async () => {
    if (!reportJobTarget) return
    setReporting(true)
    try {
      await reportJob(reportJobTarget.id, reportReason, reportDetails)
      const id = reportJobTarget.id
      setReportedIds((prev) => new Set(prev).add(id))
      toast(
        "Report sent",
        "Thanks. Our team will review it and let you know the outcome.",
        "success"
      )
      setReportJobTarget(null)
    } catch (err) {
      toast("Couldn't send report", errorMessage(err, "Please try again."), "error")
    } finally {
      setReporting(false)
    }
  }

  const handleSave = async (job: PublicJob) => {
    if (isSaved(job.id) || isApplied(job.id)) {
      setCandidateActiveView("Applications")
      return
    }
    setSaving(true)
    try {
      await saveJobFromDiscover(job.id)
      toast("Saved", `${job.title} at ${job.company} added to your Saved list.`, "success")
    } catch (err) {
      toast("Could not save job", errorMessage(err, "Please try again."), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      <PageHeader
        icon={Compass}
        tone="blue"
        title="Discover Jobs"
        subtitle={`Find your next opportunity from ${publicJobs.length} open roles.`}
        className="relative z-10"
        actions={sourceSwitch}
      />

      {/* For you / All jobs + saved searches */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Job list"
          className="flex gap-1 rounded-[13px] border border-bg-border bg-bg-primary p-1"
        >
          {MATCH_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={matchTab === t.id}
              onClick={() => switchTab(t.id)}
              className={`press relative isolate flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-[13px] font-bold transition-colors duration-200 cursor-pointer ${
                matchTab === t.id ? "text-white" : "text-txt-body hover:text-txt-heading"
              }`}
            >
              {matchTab === t.id && (
                <ActiveIndicator
                  layoutId="discover-tab"
                  className="rounded-[10px] bg-primary shadow-button"
                />
              )}
              {t.id === "for-you" && <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadMatches(matchTab, { refresh: true })}
            disabled={matchedJobsLoading}
            className="gap-1.5"
            title="Re-rank jobs for your current profile"
          >
            <RefreshCw
              className={`h-4 w-4 ${matchedJobsLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <History className="h-4 w-4" aria-hidden="true" />
                <span className="sm:hidden">Saved</span>
                <span className="hidden sm:inline">Saved searches</span>
                {savedSearches.length > 0 ? ` (${savedSearches.length})` : ""}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Saved searches</DropdownMenuLabel>
              {savedSearches.length === 0 ? (
                <p className="px-3 py-2 text-[12.5px] text-txt-caption">
                  Nothing saved yet. Set up filters, then “Save this search”.
                </p>
              ) : (
                savedSearches.map((ss) => (
                  <div key={ss.id} className="flex items-center gap-1">
                    <DropdownMenuItem
                      className="min-w-0 flex-1"
                      onSelect={() => applySavedSearch(ss)}
                    >
                      <span className="truncate">{ss.name}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      aria-label={`Delete saved search ${ss.name}`}
                      className="shrink-0 px-2 text-txt-caption hover:text-sec-red focus:text-sec-red"
                      onSelect={() => setDeleteSearch(ss)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </DropdownMenuItem>
                  </div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" onClick={openSaveSearch}>
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden">Save</span>
            <span className="hidden sm:inline">Save this search</span>
          </Button>
        </div>
      </div>

      {/* Thin profile: matches need skills/title */}
      {thinProfile && matchTab === "for-you" && (
        <div
          role="status"
          className="relative z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-primary-border/40 bg-primary-light p-4"
        >
          <UserPen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13.5px] font-medium text-txt-heading">
            Add your skills and title to get matches.
          </p>
          <Button size="sm" onClick={() => setCandidateActiveView("Profile")}>
            Complete profile
          </Button>
        </div>
      )}

      {/* Search + Filter Bar */}
      <Card className="p-4 glass-panel border-bg-border/60 relative z-10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
            <input
              type="text"
              placeholder="Search roles, companies, skills…"
              aria-label="Search roles"
              value={discoverSearch}
              onChange={(e) => setDiscoverSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-input border border-bg-border bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>
          <div className="relative sm:w-56">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
            <input
              type="text"
              placeholder="Location"
              aria-label="Filter by location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-input border border-bg-border bg-bg-primary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>
        </div>
        <div className="mt-3">
          <JobFilterBar
            id="hyrr"
            value={extraFilters}
            onChange={setExtraFilters}
            showLanguages
            leading={
              <>
                <button
                  type="button"
                  aria-pressed={remoteOnly}
                  onClick={() => setRemoteOnly((v) => !v)}
                  className={`h-10 shrink-0 rounded-input border px-3 text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    remoteOnly
                      ? "border-primary-border bg-primary-light text-primary"
                      : "border-bg-border bg-bg-primary text-txt-body hover:bg-bg-hover"
                  }`}
                >
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  Remote
                </button>
                <div
                  role="group"
                  aria-label="Employment type"
                  className="flex h-10 max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-input border border-bg-border bg-bg-primary p-1 custom-scrollbar-none"
                >
                  {/* "Remote" has its own toggle; the chips cover the employment types. */}
                  {JOB_TYPES.filter((t) => t !== "Remote").map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={discoverTypeFilter === t}
                      onClick={() => setDiscoverTypeFilter(t)}
                      className={`h-full shrink-0 whitespace-nowrap rounded-[9px] px-3 text-[13px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        discoverTypeFilter === t
                          ? "bg-primary text-white shadow-button"
                          : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            }
          />
        </div>
      </Card>

      {/* Split Pane */}
      {/* Wide screens: list and detail are two equal-height panes that each scroll on their own
          (data-lenis-prevent keeps the page's smooth scroller from taking the wheel). */}
      <div
        ref={splitRef}
        style={splitHeight ? { height: splitHeight } : undefined}
        className="flex flex-col lg:flex-row lg:items-stretch lg:sticky lg:top-5 gap-5 flex-1 min-w-0 lg:flex-none lg:min-h-0 lg:overflow-hidden"
      >
        {/* Job List */}
        {/* Narrow list beside the detail pane; full width (centred empty/error states) when the
            list has nothing to show and no detail pane is rendered. */}
        <div
          ref={listRef}
          data-testid="hyrr-job-list"
          data-lenis-prevent
          className={`w-full flex flex-col gap-3 ${
            selectedJob || listLoading || filtered.length > 0
              ? "lg:w-[360px] shrink-0 max-h-[70dvh] lg:max-h-none lg:h-full overflow-y-auto overscroll-contain pr-1 -mr-1"
              : "lg:flex-1 lg:items-center"
          }`}
        >
          {listLoading ? (
            Array.from({ length: 5 }).map((_, i) => <JobSkeleton key={i} />)
          ) : matchError && !useFallback ? (
            <Card
              role="alert"
              className="w-full max-w-[640px] p-8 flex flex-col items-center gap-3 text-center"
            >
              <AlertTriangle className="w-8 h-8 text-sec-orange" aria-hidden="true" />
              <p className="text-[14px] font-semibold text-txt-heading">{matchError}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => void loadMatches(matchTab)}>
                  Retry
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void loadMatches("all")}>
                  Browse all jobs
                </Button>
              </div>
            </Card>
          ) : filtered.length === 0 && hasFilters ? (
            <Card className="w-full max-w-[640px] p-10 flex flex-col items-center gap-3 text-center">
              <Briefcase className="w-10 h-10 text-txt-disabled" />
              <p className="text-[14px] font-semibold text-txt-heading">No roles found</p>
              <p className="text-caption text-txt-caption">Try adjusting your search or filters.</p>
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </Card>
          ) : filtered.length === 0 && matchTab === "for-you" ? (
            <EmptyState
              className="w-full max-w-[640px]"
              icon={Sparkles}
              title={thinProfile ? "Tell us what you do" : "No matches right now"}
              description={
                thinProfile
                  ? "Add your skills and job title to your profile and we'll pick jobs for you."
                  : "We'll keep looking as new jobs are posted. Meanwhile, browse everything that's open."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => void loadMatches("all")}>
                    Browse all jobs
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCandidateActiveView("Profile")}
                  >
                    Improve profile
                  </Button>
                </div>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              className="w-full max-w-[640px]"
              icon={Briefcase}
              title="No open roles yet"
              description="Create a job alert and we'll tell you when something is posted."
              action={
                <Button size="sm" onClick={() => setCandidateActiveView("Alerts")}>
                  Set up an alert
                </Button>
              }
            />
          ) : (
            filtered.map((job) => {
              const active = selectedJob?.id === job.id
              const applied = isApplied(job.id)
              const saved = isSaved(job.id)
              return (
                <button
                  key={job.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectJob(job)}
                  className={`spotlight w-full text-left p-4 rounded-card border transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer block active:scale-[0.99] ${
                    active
                      ? "border-primary bg-bg-secondary ring-[3px] ring-primary/10 shadow-card"
                      : "border-bg-border/60 bg-bg-secondary/60 hover:bg-bg-secondary hover:border-primary/25 hover:-translate-y-px hover:shadow-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-[12px] flex items-center justify-center text-white font-bold text-[14px] shrink-0 ${colorBg[job.companyColor] ?? "bg-primary"}`}
                    >
                      {job.company[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-[13.5px] font-bold text-txt-heading truncate">
                          {job.title}
                        </h4>
                        {job.featured && (
                          <Star className="w-3.5 h-3.5 text-sec-orange shrink-0 fill-current" />
                        )}
                      </div>
                      <p className="text-[13px] text-txt-body mt-0.5 flex items-center gap-1 min-w-0">
                        <span className="truncate">{job.company}</span>
                        {job.companyVerified && <VerifiedBadge focusable={false} />}
                        {job.companyFastResponder && (
                          <span
                            title="This company usually replies to applicants within 2 days"
                            className="shrink-0 text-[11px] font-semibold text-sec-green"
                          >
                            ⚡ Fast responder
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[12px] text-txt-caption flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                        <span className="text-[12px] font-semibold text-primary">{job.salary}</span>
                      </div>
                      <JobCardMeta
                        remote={!!job.remote || job.type === "Remote"}
                        category={job.category}
                        skills={job.skills}
                      />
                      {job.match && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          <MatchBadge match={job.match} />
                          <ReasonChips reasons={job.match.reasons} max={3} />
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={
                            isWithdrawn(job.id)
                              ? "secondary"
                              : applied
                                ? "success"
                                : saved
                                  ? "primary"
                                  : "secondary"
                          }
                        >
                          {isWithdrawn(job.id)
                            ? "Withdrawn"
                            : applied
                              ? "Applied"
                              : saved
                                ? "Saved"
                                : job.type}
                        </Badge>
                        <span className="text-[11.5px] text-txt-caption">{job.posted}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
          {!listLoading && !matchError && !useFallback && (
            <InfiniteSentinel
              rootRef={listRef}
              count={filtered.length}
              hasMore={!!matchedJobsCursor}
              loading={matchedJobsLoadingMore}
              error={moreError}
              onMore={loadMore}
              endLabel="That's every job for now"
            />
          )}
        </div>

        {/* Job Detail */}
        {selectedJob && (
          <div
            ref={detailRef}
            data-testid="hyrr-job-detail"
            data-lenis-prevent
            className="flex-1 min-w-0 scroll-mt-4 rounded-card lg:h-full lg:overflow-y-auto lg:overscroll-contain"
          >
            <Card className="p-5 sm:p-8">
              {/* Header */}
              <div className="flex items-start gap-4 sm:gap-5 pb-6 border-b border-bg-border/40">
                <div
                  className={`hidden sm:flex w-16 h-16 rounded-[18px] flex items-center justify-center text-white font-black text-[24px] shrink-0 ${colorBg[selectedJob.companyColor] ?? "bg-primary"}`}
                >
                  {selectedJob.company[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[20px] sm:text-[22px] font-extrabold text-txt-title break-words">
                        {selectedJob.title}
                      </h2>
                      <p className="text-[14px] text-txt-body font-medium mt-0.5 flex items-center gap-1.5">
                        {selectedJob.company}
                        {selectedJob.companyVerified && <VerifiedBadge size="md" />}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedJob.match && <MatchBadge match={selectedJob.match} />}
                      {selectedJob.featured && (
                        <Badge variant="warning">
                          <Star className="w-3 h-3 mr-1 fill-current" />
                          Featured
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[13.5px] text-txt-caption font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedJob.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      {selectedJob.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {selectedJob.salary}
                    </span>
                    {!!selectedJob.languages?.length && (
                      <span className="flex items-center gap-1" data-testid="job-languages">
                        <Languages className="w-3.5 h-3.5" aria-hidden="true" />
                        {selectedJob.languages.join(", ")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Posted {selectedJob.posted}
                    </span>
                    {selectedJob.remote && (
                      <span className="flex items-center gap-1 text-sec-green font-semibold">
                        <Globe className="w-3.5 h-3.5" />
                        Remote OK
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Why it matches */}
              {selectedJob.match && selectedJob.match.reasons.length > 0 && (
                <div className="py-4 border-b border-bg-border/40">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-txt-heading">
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                    Why this matches you
                  </h3>
                  <ul className="space-y-1.5">
                    {selectedJob.match.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-[13px] text-txt-body">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sec-green" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Skills */}
              <div className="py-5 border-b border-bg-border/40 flex flex-wrap gap-2">
                {selectedJob.skills.map((s) => (
                  <span
                    key={s}
                    className="text-[12.5px] font-bold text-primary bg-primary-light border border-primary-border/30 px-2.5 py-0.5 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Description */}
              <div className="py-5 border-b border-bg-border/40">
                <h3 className="text-[14px] font-bold text-txt-heading mb-2">About the Role</h3>
                <RichTextRenderer content={selectedJob.description} />
              </div>

              {/* Requirements */}
              <div className="py-5 border-b border-bg-border/40">
                <h3 className="text-[14px] font-bold text-txt-heading mb-3">Requirements</h3>
                <ul className="space-y-2">
                  {selectedJob.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-[13px] text-txt-body">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Benefits */}
              <div className="py-5">
                <h3 className="text-[14px] font-bold text-txt-heading mb-3">Benefits & Perks</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.benefits.map((b) => (
                    <span
                      key={b}
                      className="text-[13px] font-semibold text-sec-green bg-sec-green/10 border border-sec-green/20 px-2.5 py-1 rounded-full"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-wrap gap-3 mt-2">
                <Button
                  variant={isApplied(selectedJob.id) ? "secondary" : "primary"}
                  onClick={() => openApply(selectedJob)}
                  disabled={isApplied(selectedJob.id) || !seekerProfile}
                  title={!seekerProfile ? "Loading your profile…" : undefined}
                  className={`flex-1 min-w-[160px] h-11 text-[14px] font-bold cursor-pointer ${isApplied(selectedJob.id) ? "" : "shadow-button"}`}
                >
                  {isWithdrawn(selectedJob.id)
                    ? "Application withdrawn"
                    : isApplied(selectedJob.id)
                      ? "✓ Applied"
                      : "Apply Now"}
                </Button>
                <CvTailorButton jobId={selectedJob.id} jobTitle={selectedJob.title} />
                {!isApplied(selectedJob.id) && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSave(selectedJob)}
                    disabled={saving}
                    className="h-11 px-4 cursor-pointer"
                    aria-label={
                      isSaved(selectedJob.id) ? "Saved — view in Applications" : "Save job"
                    }
                    title={isSaved(selectedJob.id) ? "Saved — view in Applications" : "Save job"}
                  >
                    <Bookmark
                      className={`w-4.5 h-4.5 ${isSaved(selectedJob.id) ? "fill-current text-primary" : ""}`}
                    />
                    <span className="text-[13px] font-semibold">
                      {isSaved(selectedJob.id) ? "Saved" : "Save"}
                    </span>
                  </Button>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => openReport(selectedJob)}
                  disabled={reportedIds.has(selectedJob.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-txt-caption hover:text-sec-red hover:bg-bg-hover disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-txt-caption cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                  {reportedIds.has(selectedJob.id) ? "Reported" : "Report job"}
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Apply dialog */}
      <Dialog open={!!applyJob} onOpenChange={(open) => !open && !submitting && setApplyJob(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply to {applyJob?.title}</DialogTitle>
            <DialogDescription>
              {applyJob?.company} · {applyJob?.location}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            {noCredits && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-xl border border-sec-orange/30 bg-sec-orange/10 p-3"
              >
                <p className="flex items-start gap-2 text-[13px] text-txt-heading">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-sec-orange" aria-hidden="true" />
                  <span>
                    Applying needs {noCredits.required} Momentum credit
                    {noCredits.required === 1 ? "" : "s"}; you have {noCredits.balance}.
                  </span>
                </p>
                <div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setApplyJob(null)
                      setCandidateActiveView("Momentum")
                    }}
                  >
                    Buy credits
                  </Button>
                </div>
              </div>
            )}
            {applyBlocked && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-xl border border-sec-orange/30 bg-sec-orange/10 p-3"
              >
                <p className="flex items-start gap-2 text-[13px] text-txt-heading">
                  <MailWarning
                    className="mt-0.5 h-4 w-4 shrink-0 text-sec-orange"
                    aria-hidden="true"
                  />
                  <span>
                    Please verify your e-mail address before applying. We sent you a link when you
                    signed up.
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleResend}
                  disabled={resending}
                  className="self-start"
                >
                  {resending ? "Sending…" : "Resend verification e-mail"}
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="apply-resume"
                className="text-[13.5px] font-semibold text-txt-heading"
              >
                Resume
              </label>
              {resumes.length > 0 ? (
                <select
                  id="apply-resume"
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value)}
                  className="h-10 w-full rounded-input border border-bg-border bg-bg-primary px-3 text-[13px] text-txt-heading focus:outline-none focus:border-primary/40"
                >
                  {resumes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.active ? " (active)" : ""}
                    </option>
                  ))}
                  <option value="">Apply without a resume</option>
                </select>
              ) : (
                <p className="text-[13.5px] text-txt-caption">
                  You have no resumes yet.{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={() => {
                      setApplyJob(null)
                      setCandidateActiveView("Documents")
                    }}
                  >
                    Upload one in Documents
                  </button>{" "}
                  or apply without it.
                </p>
              )}
            </div>
            {questionsError ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-2 rounded-xl border border-sec-orange/30 bg-sec-orange/10 p-3"
              >
                <p className="text-[13px] text-txt-heading">{questionsError}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyJob && void loadQuestions(applyJob.id)}
                >
                  Retry
                </Button>
              </div>
            ) : questions === null ? (
              <div className="space-y-2" aria-busy="true" aria-label="Loading questions">
                <div className="h-4 w-1/2 animate-pulse rounded bg-bg-border/60" />
                <div className="h-16 w-full animate-pulse rounded-xl bg-bg-border/40" />
              </div>
            ) : questions.length > 0 ? (
              <fieldset className="flex flex-col gap-4">
                <legend className="mb-2 text-[13.5px] font-semibold text-txt-heading">
                  Questions from the employer
                </legend>
                {questions.map((q) => {
                  const id = q.id as string
                  const invalid = answerErrors.has(id)
                  return (
                    <div key={id} className="flex flex-col gap-1.5">
                      <label htmlFor={`apply-q-${id}`} className="text-[13px] text-txt-heading">
                        {q.question}
                        {q.required ? (
                          <span className="ml-1 text-sec-red" aria-hidden="true">
                            *
                          </span>
                        ) : (
                          <span className="ml-1 font-normal text-txt-caption">(optional)</span>
                        )}
                      </label>
                      <textarea
                        id={`apply-q-${id}`}
                        value={answers[id] ?? ""}
                        onChange={(e) => {
                          const value = e.target.value
                          setAnswers((a) => ({ ...a, [id]: value }))
                          if (invalid && value.trim()) {
                            setAnswerErrors((prev) => {
                              const next = new Set(prev)
                              next.delete(id)
                              return next
                            })
                          }
                        }}
                        rows={3}
                        maxLength={2000}
                        required={q.required}
                        aria-required={q.required}
                        aria-invalid={invalid}
                        aria-describedby={invalid ? `apply-q-${id}-error` : undefined}
                        className={`w-full rounded-input border bg-bg-primary p-3 text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none ${
                          invalid
                            ? "border-sec-red focus:border-sec-red"
                            : "border-bg-border focus:border-primary/40"
                        }`}
                      />
                      {invalid && (
                        <p id={`apply-q-${id}-error`} className="text-[12px] text-sec-red">
                          This question is required.
                        </p>
                      )}
                    </div>
                  )
                })}
              </fieldset>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="apply-cover" className="text-[13.5px] font-semibold text-txt-heading">
                Cover letter <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <textarea
                id="apply-cover"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={6}
                maxLength={5000}
                placeholder="Tell the hiring team why you're a great fit…"
                className="w-full rounded-input border border-bg-border bg-bg-primary p-3 text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>
          <DialogFooter>
            {balance !== null && (
              <p className="mr-auto self-center text-[12px] text-txt-caption">
                Balance: {balance} credit{balance === 1 ? "" : "s"}
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setApplyJob(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitApplication}
              disabled={submitting || !!noCredits || (questions === null && !questionsError)}
            >
              {submitting ? "Submitting…" : `Apply${creditSuffix(applyCost)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save search dialog */}
      <Dialog
        open={saveSearchOpen}
        onOpenChange={(open) => !open && !savingSearch && setSaveSearchOpen(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>
              Keeps your search text, filters and tab so you can re-apply them in one click.
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void submitSaveSearch()
            }}
          >
            <label
              htmlFor="saved-search-name"
              className="text-[13px] font-semibold text-txt-heading"
            >
              Name
            </label>
            <Input
              id="saved-search-name"
              value={searchName}
              maxLength={80}
              autoFocus
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="e.g. Remote frontend roles"
            />
            {saveSearchError && (
              <p role="alert" className="text-[13px] font-medium text-sec-red">
                {saveSearchError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSaveSearchOpen(false)}
                disabled={savingSearch}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingSearch}>
                {savingSearch ? "Saving…" : "Save search"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteSearch}
        onOpenChange={(open) => !open && setDeleteSearch(null)}
        title="Delete saved search?"
        description={`"${deleteSearch?.name}" will be removed from your saved searches.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteSearch}
      />

      {/* Report dialog */}
      <Dialog
        open={!!reportJobTarget}
        onOpenChange={(open) => !open && !reporting && setReportJobTarget(null)}
      >
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report this job</DialogTitle>
            <DialogDescription>
              {reportJobTarget?.title} · {reportJobTarget?.company}. Reports are anonymous to the
              employer.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="report-reason"
                className="text-[13.5px] font-semibold text-txt-heading"
              >
                Reason
              </label>
              <select
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as JobReportReason)}
                className="h-10 w-full rounded-input border border-bg-border bg-bg-primary px-3 text-[13px] text-txt-heading focus:outline-none focus:border-primary/40"
              >
                {JOB_REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="report-details"
                className="text-[13.5px] font-semibold text-txt-heading"
              >
                Details <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <textarea
                id="report-details"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="What's wrong with this posting? E.g. it asks for a fee or bank details."
                className="w-full rounded-input border border-bg-border bg-bg-primary p-3 text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReportJobTarget(null)}
              disabled={reporting}
            >
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={submitReport} disabled={reporting}>
              {reporting ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Discover: Hyrr jobs, or jobs from the web (licensed job APIs). */
export function DiscoverJobs() {
  const [source, setSource] = useState<"hyrr" | "web">("hyrr")
  // The server switches web jobs off: hide the source entirely.
  const webJobsOn = useJobStore((s) => s.pricing?.features.webJobs !== false)
  const showWeb = webJobsOn && source === "web"
  // The source switch sits in the page header of whichever list is shown.
  const sourceSwitch = webJobsOn ? (
    <FilterChips<"hyrr" | "web">
      id="discover-source"
      label="Job source"
      value={source}
      onChange={setSource}
      options={[
        { value: "hyrr", label: "Hyrr jobs" },
        { value: "web", label: "From the web", tone: "teal" },
      ]}
    />
  ) : undefined
  return showWeb ? (
    <WebJobs sourceSwitch={sourceSwitch} />
  ) : (
    <DiscoverHyrr sourceSwitch={sourceSwitch} />
  )
}
