import { useDroppable } from "@dnd-kit/core"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "hyrr.shared"
import {
  Archive,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Plus,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react"
import { type Candidate } from "../../store/useJobStore"
import { ApplicationCard } from "./application-card"

interface KanbanColumnProps {
  id: Candidate["status"]
  title: string
  candidates: Candidate[]
  onAddCandidate: (column: Candidate["status"]) => void
  /** jobId -> title; when given, each card shows its job (All jobs board). */
  jobTitles?: Record<string, string>
}

const COLUMN_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
  Applied: { icon: Send, cls: "bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]" },
  "In Process": {
    icon: Clock,
    cls: "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]",
  },
  Interviewing: {
    icon: Users,
    cls: "bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)]",
  },
  Offer: {
    icon: CheckCircle2,
    cls: "bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]",
  },
  Archived: {
    icon: Archive,
    cls: "bg-[var(--badge-secondary-bg)] text-[var(--badge-secondary-text)]",
  },
}

export function KanbanColumn({
  id,
  title,
  candidates,
  onAddCandidate,
  jobTitles,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const iconDef = COLUMN_ICON[id] ?? COLUMN_ICON.Archived
  const Icon = iconDef.icon

  return (
    <section
      ref={setNodeRef}
      aria-label={`${title} column, ${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`}
      className={`flex flex-col w-[280px] sm:w-[300px] shrink-0 rounded-2xl p-2.5 min-h-[480px] max-h-[calc(100dvh-220px)] transition-colors duration-200 ${
        isOver ? "bg-primary-light/40" : "bg-transparent"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconDef.cls}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-[14px] font-bold text-txt-title">{title}</h2>
          <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-bg-hover text-txt-body text-[11px] font-semibold">
            {candidates.length}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${title} column actions`}
              className="text-txt-caption hover:text-txt-heading p-1 rounded-md hover:bg-bg-hover transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setTimeout(() => onAddCandidate(id), 0)}>
              <Plus className="w-3.5 h-3.5" />
              Add candidate here
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Cards Stack */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar-none pr-0.5 min-h-0">
        {candidates.map((c) => (
          <ApplicationCard key={c.id} candidate={c} jobTitle={jobTitles?.[c.jobId]} />
        ))}
        {candidates.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-bg-border rounded-xl text-center min-h-[140px] bg-bg-secondary/50">
            <p className="text-xs text-txt-caption font-medium">No candidates</p>
          </div>
        )}
      </div>

      {/* Add Candidate Button */}
      <Button
        variant="ghost"
        onClick={() => onAddCandidate(id)}
        className="w-full justify-start gap-1.5 mt-3 rounded-xl text-[12.5px] shadow-none font-medium h-9 shrink-0 cursor-pointer px-2"
      >
        <Plus className="w-4 h-4" />
        Add candidate
      </Button>
    </section>
  )
}
