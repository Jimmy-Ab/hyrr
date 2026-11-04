import { useDraggable } from "@dnd-kit/core"
import {
  Badge,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from "hyrr.shared"
import { Bookmark, MessageSquare, MoreHorizontal, StickyNote, Trash2 } from "lucide-react"
import { useState } from "react"
import { avatarFallback, errorMessage, isWithdrawn } from "../../lib/recruiter"
import { useJobStore, type Candidate } from "../../store/useJobStore"
import { AiScoreChips } from "../ai/ai-score"
import { LabelChips } from "../labels/labels"
import { ConfirmDialog } from "../layout/confirm-dialog"

interface ApplicationCardProps {
  candidate: Candidate
  isOverlay?: boolean
  /** Shown on the "All jobs" board so recruiters can tell candidates of different jobs apart. */
  jobTitle?: string
}

type TagVariant = "warning" | "success" | "destructive" | "secondary" | "info"

function getTagDetails(candidate: Candidate): { variant: TagVariant; text: string } {
  if (candidate.tag) {
    switch (candidate.tag) {
      case "Interview":
      case "Technical Test":
      case "Screening":
        return { variant: "warning", text: candidate.tag }
      case "Offer Sent":
        return { variant: "success", text: candidate.tag }
      case "Not a fit":
        return { variant: "destructive", text: candidate.tag }
      default:
        return { variant: "secondary", text: candidate.tag }
    }
  }
  if (candidate.status === "Applied") return { variant: "info", text: candidate.dateText }
  return { variant: "secondary", text: candidate.dateText }
}

export function ApplicationCard({ candidate, isOverlay = false, jobTitle }: ApplicationCardProps) {
  const {
    toggleBookmark,
    deleteCandidate,
    setSelectedCandidateId,
    openConversation,
    setActiveView,
  } = useJobStore()
  const { toast } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const withdrawn = isWithdrawn(candidate)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    disabled: isOverlay || withdrawn,
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.3 : 1,
      }
    : undefined

  const tagDetails = getTagDetails(candidate)

  const handleBookmark = async () => {
    try {
      await toggleBookmark(candidate.id)
    } catch (err) {
      toast("Could not update bookmark", errorMessage(err), "error")
    }
  }

  const handleMessage = () => {
    setActiveView("Messages")
    openConversation(candidate.id).catch((err: unknown) =>
      toast("Could not open conversation", errorMessage(err), "error")
    )
  }

  const handleDelete = async () => {
    try {
      await deleteCandidate(candidate.id)
      toast("Candidate deleted", `${candidate.name} was removed.`, "success")
    } catch (err) {
      toast("Could not delete candidate", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        aria-label={`${candidate.name}${withdrawn ? " (withdrawn)" : ""}`}
        className={`group select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          withdrawn ? "cursor-default" : isOverlay ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <Card
          onDoubleClick={() => setSelectedCandidateId(candidate.id)}
          className={`p-4 relative border border-bg-border bg-bg-card rounded-2xl transition-all shadow-xs ${
            isOverlay
              ? "shadow-floating scale-[1.03] rotate-[1deg] border-primary-border ring-2 ring-primary/10"
              : "hover:shadow-card-hover hover:border-primary-border/60"
          } ${withdrawn ? "opacity-70" : ""}`}
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex gap-3 min-w-0">
              <img
                src={candidate.avatar || avatarFallback(candidate.name)}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0 pointer-events-none"
              />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="block max-w-full text-left text-[13.5px] font-bold text-txt-heading truncate hover:text-primary cursor-pointer"
                >
                  {candidate.name}
                </button>
                {jobTitle && (
                  <p className="text-[11.5px] text-primary mt-0.5 truncate font-semibold">
                    {jobTitle}
                  </p>
                )}
                {candidate.title && (
                  <p className="text-[12px] text-txt-body mt-0.5 truncate font-normal">
                    {candidate.title}
                  </p>
                )}
                {candidate.location && (
                  <p className="text-[11.5px] text-txt-caption mt-1 font-normal truncate">
                    {candidate.location}
                  </p>
                )}
              </div>
            </div>

            {/* Context Options Menu */}
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="shrink-0"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Actions for ${candidate.name}`}
                    className="text-txt-caption hover:text-txt-heading p-1 rounded-full hover:bg-bg-hover transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44" align="end">
                  <DropdownMenuLabel>Candidate Actions</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => setSelectedCandidateId(candidate.id)}>
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleBookmark}>
                    {candidate.bookmarked ? "Remove Bookmark" : "Bookmark Candidate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setTimeout(() => setConfirmDelete(true), 0)}
                    className="text-sec-red focus:text-sec-red"
                  >
                    <Trash2 className="w-4 h-4 mr-1 text-sec-red" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {(candidate.labels?.length ?? 0) > 0 && (
            <div className="mt-2.5">
              <LabelChips labels={candidate.labels} />
            </div>
          )}

          {/* Card Footer: Tag & Bookmark */}
          <div className="flex items-center justify-between mt-3.5 pt-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {withdrawn ? (
                <Badge
                  variant="destructive"
                  className="font-medium text-[11px] px-2.5 py-0.5 rounded-md"
                >
                  Withdrawn
                </Badge>
              ) : (
                <Badge
                  variant={tagDetails.variant}
                  className="font-medium text-[11px] px-2.5 py-0.5 rounded-md"
                >
                  {tagDetails.text}
                </Badge>
              )}
              <AiScoreChips candidate={candidate} />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {candidate.notesCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-txt-caption"
                  title={`${candidate.notesCount} note${candidate.notesCount === 1 ? "" : "s"}`}
                >
                  <StickyNote className="w-3.5 h-3.5" aria-hidden="true" />
                  {candidate.notesCount}
                  <span className="sr-only"> notes</span>
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMessage()
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={`Message ${candidate.name}`}
                title="Message"
                className="cursor-pointer transition-colors p-1 -m-1 rounded-full text-txt-disabled hover:text-primary hover:bg-bg-hover"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleBookmark()
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                aria-label={candidate.bookmarked ? "Remove bookmark" : "Bookmark candidate"}
                aria-pressed={candidate.bookmarked}
                className={`cursor-pointer transition-colors p-1 -m-1 rounded-full hover:bg-bg-hover ${
                  candidate.bookmarked
                    ? "text-primary hover:text-primary-hover"
                    : "text-txt-disabled hover:text-txt-body"
                }`}
              >
                <Bookmark
                  className="w-4 h-4"
                  fill={candidate.bookmarked ? "currentColor" : "none"}
                />
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Rendered outside the draggable so dialog key/pointer events don't reach dnd-kit */}
      {confirmDelete && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete candidate?"
          description={`${candidate.name}'s application and its history will be permanently deleted.`}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
