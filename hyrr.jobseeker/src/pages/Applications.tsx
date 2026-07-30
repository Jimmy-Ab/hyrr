import {
  APPLICATION_STATUS,
  APPLICATION_STATUS_COLUMNS,
  APPLICATION_STATUS_LABEL,
  Badge,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  useJobStore,
  type ApplicationStatusCode,
  type JobApplication,
} from "hyrr.shared"
import {
  Bookmark,
  Calendar,
  DollarSign,
  LayoutList,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  User,
} from "lucide-react"
import { useEffect } from "react"

// ─── Kanban Column ─────────────────────────────────────────────────────────────
const columnColors: Record<ApplicationStatusCode, string> = {
  [APPLICATION_STATUS.SAVED]: "text-primary bg-primary-light border-primary-border/40",
  [APPLICATION_STATUS.APPLIED]: "text-sec-blue bg-sec-blue/10 border-sec-blue/20",
  [APPLICATION_STATUS.IN_PROCESS]: "text-sec-orange bg-sec-orange/10 border-sec-orange/20",
  [APPLICATION_STATUS.INTERVIEWING]: "text-primary bg-primary-light border-primary-border/40",
  [APPLICATION_STATUS.OFFER]: "text-sec-green bg-sec-green/10 border-sec-green/20",
  [APPLICATION_STATUS.ARCHIVED]: "text-txt-caption bg-bg-primary border-bg-border/40",
}

function JobColumn({
  id,
  title,
  items,
}: {
  id: JobApplication["status"]
  title: string
  items: JobApplication[]
}) {
  return (
    <div className="flex flex-col w-[280px] min-w-[280px] shrink-0 rounded-[20px] bg-bg-secondary/60 border border-bg-border/40">
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-bg-border/30">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold border ${columnColors[id]}`}
          >
            {items.length}
          </span>
          <h3 className="text-[14px] font-bold text-txt-heading">{title}</h3>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 p-3 flex-1 min-h-[480px]">
        {items.map((app) => (
          <JobCard key={app.id} application={app} />
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-txt-disabled">
            <LayoutList className="w-8 h-8 opacity-30" />
            <p className="text-[12px] font-medium">No jobs here</p>
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

function JobCard({ application }: { application: JobApplication }) {
  const { toggleJobBookmark, setCandidateActiveView, setActiveConversation } = useJobStore()

  const tag = application.tag
  const tagVariant =
    tag === "Offer Received"
      ? ("success" as const)
      : tag === "Not a fit"
        ? ("destructive" as const)
        : tag === "Technical Interview"
          ? ("warning" as const)
          : ("secondary" as const)

  return (
    <div className="group select-none outline-none">
      <Card className="p-4 relative border border-bg-border/60 bg-bg-secondary transition-all hover:shadow-card-hover hover:border-bg-border/90">
        <div className="flex items-start justify-between gap-2">
          {/* Company Logo + Info */}
          <div className="flex gap-3">
            <div
              className={`w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center font-bold text-[13px] ${companyDotColors[application.companyColor] ?? "bg-primary text-white"}`}
            >
              {application.company[0]}
            </div>
            <div className="min-w-0">
              <h4 className="text-body font-semibold text-txt-heading truncate">
                {application.title}
              </h4>
              <p className="text-caption text-txt-body mt-0.5 font-medium">{application.company}</p>
            </div>
          </div>

          {/* Context Menu */}
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-txt-caption hover:text-txt-heading hover:bg-bg-hover p-1 rounded-full transition-colors cursor-pointer outline-none">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48" align="end">
                <DropdownMenuLabel>Application Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => toggleJobBookmark(application.id)}>
                  {application.bookmarked ? "Remove Bookmark" : "Bookmark"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11.5px] text-txt-caption font-medium">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{application.location}</span>
            <span className="mx-0.5">·</span>
            <span>{application.type}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-txt-caption font-medium">
            <DollarSign className="w-3.5 h-3.5 shrink-0" />
            <span>{application.salary}</span>
          </div>
          {application.interviewDate && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-primary font-semibold">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Interview: {application.interviewDate}</span>
            </div>
          )}
        </div>

        {/* Recruiter */}
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2 mt-3 pt-3 border-t border-bg-border/30"
        >
          <img
            src={application.recruiterAvatar}
            alt={application.recruiterName}
            className="w-5 h-5 rounded-full object-cover pointer-events-none"
          />
          <span className="text-[11px] text-txt-caption font-medium flex items-center gap-1">
            <User className="w-3 h-3" /> {application.recruiterName}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {tag && <Badge variant={tagVariant}>{tag}</Badge>}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setActiveConversation(application.id)
                setCandidateActiveView("Messages")
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Message Recruiter"
              className="cursor-pointer transition-colors p-1 -m-1 rounded-full text-txt-caption hover:text-primary hover:bg-bg-hover"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleJobBookmark(application.id)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title={application.bookmarked ? "Remove Bookmark" : "Bookmark"}
              className={`cursor-pointer transition-colors p-1 -m-1 rounded-full hover:bg-bg-hover ${
                application.bookmarked ? "text-primary" : "text-txt-caption hover:text-txt-heading"
              }`}
            >
              <Bookmark
                className="w-3.5 h-3.5"
                fill={application.bookmarked ? "currentColor" : "none"}
              />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────
export function ApplicationsBoard() {
  const { jobApplications, fetchInitialData } = useJobStore()

  useEffect(() => {
    fetchInitialData()
  }, []) // eslint-disable-line

  const columns = APPLICATION_STATUS_COLUMNS.map((id) => ({
    id,
    title: APPLICATION_STATUS_LABEL[id],
  }))

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200 relative">
      <div>
        <h1 className="text-[22px] font-bold text-[#111827] tracking-tight leading-none">
          My Applications
        </h1>
        <p className="text-[13px] text-slate-400 mt-1.5 font-normal">
          Track your search pipeline across saved, applied, process, offer, and archived stages.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-6 gap-4">
        {columns.map((col) => {
          const count = jobApplications.filter((a) => a.status === col.id).length
          return (
            <Card
              key={col.id}
              className="p-3.5 flex flex-col items-center border border-slate-100 bg-white rounded-xl shadow-xs"
            >
              <span
                className={`text-[20px] font-bold ${
                  col.id === APPLICATION_STATUS.OFFER
                    ? "text-emerald-600"
                    : col.id === APPLICATION_STATUS.ARCHIVED
                      ? "text-slate-400"
                      : "text-slate-900"
                }`}
              >
                {count}
              </span>
              <span className="text-[11.5px] text-slate-400 font-medium mt-0.5">{col.title}</span>
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
            items={jobApplications.filter((a) => a.status === col.id)}
          />
        ))}
      </div>
    </div>
  )
}
