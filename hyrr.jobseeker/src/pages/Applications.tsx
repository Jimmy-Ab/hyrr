import {
  AnimatedNumber,
  APPLICATION_STATUS,
  APPLICATION_STATUS_COLUMNS,
  APPLICATION_STATUS_LABEL,
  Badge,
  Card,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  errorMessage,
  formatDateTime,
  PageHeader,
  Skeleton,
  stageTone,
  toneClass,
  useJobStore,
  useToast,
  VerifiedBadge,
  type ApplicationStatusCode,
  type JobApplication,
  type TimelineEntry,
} from "hyrr.shared"
import {
  Calendar,
  ChevronDown,
  DollarSign,
  LayoutList,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  User,
} from "lucide-react"
import { useId, useState } from "react"
import { PendingInterviewInvites } from "../components/interview-invites"
import { openOfferSheet } from "../components/offer-sheet"
import { OutreachInvitations } from "../components/outreach"

// ─── Stage timeline ───────────────────────────────────────────────────────────
function ApplicationTimeline({ applicationId }: { applicationId: string }) {
  const fetchTimeline = useJobStore((s) => s.fetchTimeline)
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelId = useId()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await fetchTimeline(applicationId))
    } catch (err) {
      setError(errorMessage(err, "Could not load the timeline."))
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    // Reload on every open so status changes since the last look show up.
    if (next && !loading) void load()
  }

  return (
    <div className="mt-3 pt-3 border-t border-bg-border/30">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-[12px] font-semibold text-txt-caption hover:text-txt-heading cursor-pointer"
      >
        Timeline
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={panelId} className="mt-2">
          {loading && !entries ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : error ? (
            <div role="alert" className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-sec-red">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="text-[12px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : !entries || entries.length === 0 ? (
            <p className="text-[12px] text-txt-caption">No status changes yet.</p>
          ) : (
            <ol className="relative ml-1.5 border-l border-bg-border pl-4 space-y-2.5">
              {entries.map((e, i) => (
                <li key={`${e.status}-${e.at}-${i}`} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ${
                      i === entries.length - 1 ? "bg-primary" : "bg-bg-border"
                    }`}
                    aria-hidden="true"
                  />
                  <p className="text-[12.5px] font-semibold text-txt-heading">{e.label}</p>
                  <p className="text-[11.5px] text-txt-caption">{formatDateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────
/** Column/stat colours come from the shared stage tones (lib/tones). */
const columnColors = (id: ApplicationStatusCode) =>
  `${toneClass(stageTone(id))} text-[var(--tone-fg)] bg-[var(--tone-bg)] border-[var(--tone-ring)]`

function JobColumn({
  id,
  title,
  items,
  onRequestRemove,
}: {
  id: JobApplication["status"]
  title: string
  items: JobApplication[]
  onRequestRemove: (application: JobApplication) => void
}) {
  return (
    <div
      className={`tone-card ${toneClass(stageTone(id))} flex flex-col w-[260px] min-w-[260px] sm:w-[280px] sm:min-w-[280px] shrink-0 rounded-[20px] bg-bg-secondary/60 border border-bg-border/40`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-bg-border/30">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[12px] font-bold border ${columnColors(id)}`}
          >
            {items.length}
          </span>
          <h3 className="text-[14px] font-bold text-txt-heading">{title}</h3>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 p-3 flex-1 min-h-[480px]">
        {items.map((app) => (
          <JobCard key={app.id} application={app} onRequestRemove={onRequestRemove} />
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-txt-disabled">
            <LayoutList className="w-8 h-8 opacity-30" />
            <p className="text-[13px] font-medium">No jobs here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Job Card ──────────────────────────────────────────────────────────────────
const companyDotColors: Record<string, string> = {
  purple: "bg-primary text-white",
  blue: "bg-sec-blue text-white",
  green: "bg-sec-green text-white",
  orange: "bg-sec-orange text-white",
}

function JobCard({
  application,
  onRequestRemove,
}: {
  application: JobApplication
  onRequestRemove: (application: JobApplication) => void
}) {
  const { setCandidateActiveView, openConversation } = useJobStore()
  const { toast } = useToast()
  const liveOffer = useJobStore((st) =>
    st.offers.find(
      (o) => o.applicationId === application.id && (o.status === "SENT" || o.status === "ACCEPTED")
    )
  )
  // Moved by the recruiter a moment ago (live `application_status_updated`).
  const justMoved = useJobStore(
    (st) =>
      st.liveEvent?.kind === "status" &&
      st.liveEvent.id === application.id &&
      Date.now() - st.liveEvent.at < 4000
  )

  const isSaved = application.status === APPLICATION_STATUS.SAVED
  const isWithdrawn = application.status === APPLICATION_STATUS.WITHDRAWN
  const tag = isWithdrawn ? "Withdrawn" : application.tag
  const tagVariant =
    tag === "Offer Received" || tag === "Offer Sent"
      ? ("success" as const)
      : tag === "Not a fit"
        ? ("destructive" as const)
        : tag === "Technical Interview" || tag === "Interview Stage"
          ? ("warning" as const)
          : ("secondary" as const)

  return (
    <div className={`group select-none outline-none ${justMoved ? "animate-rise" : ""}`}>
      <Card
        className={`p-4 relative border bg-bg-secondary transition-all hover:shadow-card-hover hover:border-bg-border/90 ${
          justMoved ? "border-primary/50 ring-2 ring-primary/15" : "border-bg-border/60"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          {/* Company Logo + Info */}
          <div className="flex min-w-0 gap-3">
            <div
              className={`w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center font-bold text-[13px] ${companyDotColors[application.companyColor] ?? "bg-primary text-white"}`}
            >
              {application.company[0]}
            </div>
            <div className="min-w-0">
              <h4 className="text-body font-semibold text-txt-heading truncate">
                {application.title}
              </h4>
              <p className="text-caption text-txt-body mt-0.5 font-medium flex items-center gap-1">
                {application.company}
                {application.companyVerified && <VerifiedBadge focusable={false} />}
              </p>
              {application.jobRemoved && (
                <p className="mt-1 text-[11.5px] font-semibold text-sec-red">No longer available</p>
              )}
              {liveOffer && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => openOfferSheet(liveOffer.id)}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-white hover:bg-primary/90 cursor-pointer"
                >
                  🎉 {liveOffer.status === "SENT" ? "Review offer" : "View offer"}
                </button>
              )}
            </div>
          </div>

          {/* Context Menu */}
          {!isWithdrawn && (
            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Actions for ${application.title}`}
                    className="text-txt-caption hover:text-txt-heading hover:bg-bg-hover p-1 rounded-full transition-colors cursor-pointer outline-none"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52" align="end">
                  <DropdownMenuLabel>Application Actions</DropdownMenuLabel>
                  {isSaved ? (
                    <>
                      <DropdownMenuItem onClick={() => setCandidateActiveView("Discover")}>
                        Apply from Discover
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onRequestRemove(application)}
                        className="text-sec-red focus:text-sec-red"
                      >
                        Remove from saved
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => onRequestRemove(application)}
                      className="text-sec-red focus:text-sec-red"
                    >
                      Withdraw application
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[12.5px] text-txt-caption font-medium">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{application.location}</span>
            <span className="mx-0.5">·</span>
            <span>{application.type}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-txt-caption font-medium">
            <DollarSign className="w-3.5 h-3.5 shrink-0" />
            <span>{application.salary}</span>
          </div>
          {application.offerAmount && application.status === APPLICATION_STATUS.OFFER && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-sec-green font-semibold">
              <DollarSign className="w-3.5 h-3.5 shrink-0" />
              <span>Offer: {application.offerAmount}</span>
            </div>
          )}
          {application.interviewDate && !isWithdrawn && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-primary font-semibold">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Interview: {application.interviewDate}</span>
            </div>
          )}
        </div>

        {/* Recruiter */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-bg-border/30">
          <img
            src={application.recruiterAvatar}
            alt=""
            className="w-5 h-5 rounded-full object-cover pointer-events-none"
          />
          <span className="min-w-0 truncate text-[12px] text-txt-caption font-medium flex items-center gap-1">
            <User className="w-3 h-3 shrink-0" /> {application.recruiterName}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {tag && <Badge variant={tagVariant}>{tag}</Badge>}
            {!isSaved && (
              <button
                type="button"
                onClick={() => {
                  setCandidateActiveView("Messages")
                  openConversation(application.id).catch((err: unknown) =>
                    toast("Couldn't open conversation", errorMessage(err), "error")
                  )
                }}
                aria-label={
                  isWithdrawn
                    ? `View messages about ${application.title}`
                    : `Message recruiter about ${application.title}`
                }
                title={isWithdrawn ? "View messages" : "Message Recruiter"}
                className="cursor-pointer transition-colors p-1 -m-1 rounded-full text-txt-caption hover:text-primary hover:bg-bg-hover"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {!isSaved && <ApplicationTimeline applicationId={application.id} />}
      </Card>
    </div>
  )
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────
export function ApplicationsBoard() {
  const { jobApplications, withdrawApplication } = useJobStore()
  const { toast } = useToast()
  const [pending, setPending] = useState<JobApplication | null>(null)

  // WITHDRAWN applications live in the Archived column (with a "Withdrawn" badge).
  const columnOf = (a: JobApplication): ApplicationStatusCode =>
    a.status === APPLICATION_STATUS.WITHDRAWN ? APPLICATION_STATUS.ARCHIVED : a.status

  const pendingIsSaved = pending?.status === APPLICATION_STATUS.SAVED

  const confirmRemove = async () => {
    if (!pending) return
    try {
      await withdrawApplication(pending.id)
      toast(
        pendingIsSaved ? "Removed" : "Application withdrawn",
        pendingIsSaved
          ? `${pending.title} was removed from your saved jobs.`
          : `Your application to ${pending.company} was withdrawn.`,
        "success"
      )
    } catch (err) {
      toast(
        pendingIsSaved ? "Couldn't remove job" : "Couldn't withdraw",
        errorMessage(err, "Please try again."),
        "error"
      )
      throw err
    }
  }

  const columns = APPLICATION_STATUS_COLUMNS.map((id) => ({
    id,
    title: APPLICATION_STATUS_LABEL[id],
  }))

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200 relative">
      <PageHeader
        icon={LayoutList}
        tone="blue"
        title="My Applications"
        subtitle="Track every application from saved to offer."
      />

      <OutreachInvitations />
      <PendingInterviewInvites />

      {/* Stats strip */}
      <div className="stagger grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        {columns.map((col) => {
          const count = jobApplications.filter((a) => columnOf(a) === col.id).length
          return (
            <Card
              key={col.id}
              hoverEffect
              className={`tone-card group ${toneClass(stageTone(col.id))} p-3.5 flex flex-col items-center rounded-xl`}
            >
              <span className="tone-wash" aria-hidden="true" />
              <span className="relative text-[22px] font-bold tabular-nums text-[var(--tone-fg)]">
                <AnimatedNumber value={count} />
              </span>
              <span className="relative text-[12.5px] text-txt-caption font-medium mt-0.5 text-center">
                {col.title}
              </span>
            </Card>
          )
        })}
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 custom-scrollbar-none min-h-[600px]">
        {columns.map((col) => (
          <JobColumn
            key={col.id}
            id={col.id}
            title={col.title}
            items={jobApplications.filter((a) => columnOf(a) === col.id)}
            onRequestRemove={setPending}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={pendingIsSaved ? "Remove saved job?" : "Withdraw application?"}
        description={
          pendingIsSaved
            ? `${pending?.title} at ${pending?.company} will be removed from your saved jobs.`
            : `Your application for ${pending?.title} at ${pending?.company} will be withdrawn and the hiring team will be notified. This cannot be undone.`
        }
        confirmLabel={pendingIsSaved ? "Remove" : "Withdraw"}
        onConfirm={confirmRemove}
      />
    </div>
  )
}
