import { useDraggable } from "@dnd-kit/core"
import { Bookmark, MapPin, MoreHorizontal, Trash2, Sparkles } from "lucide-react"
import { Card } from "../ui/card"
import { Badge } from "../ui/badge"
import { useJobStore, type Candidate } from "../../store/useJobStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown"

interface ApplicationCardProps {
  candidate: Candidate
  isOverlay?: boolean
}

export function ApplicationCard({ candidate, isOverlay = false }: ApplicationCardProps) {
  const { toggleBookmark, deleteCandidate, setSelectedCandidateId } = useJobStore()
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    disabled: isOverlay,
  })

  // Set drag styles
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.3 : 1,
      }
    : undefined

  // Determine tag style for status
  const getTagDetails = () => {
    if (candidate.tag) {
      switch (candidate.tag) {
        case "Interview":
          return { variant: "warning" as const, text: "Interview" }
        case "Technical Test":
          return { variant: "warning" as const, text: "Technical Test" }
        case "Screening":
          return { variant: "warning" as const, text: "Screening" }
        case "Offer Sent":
          return { variant: "success" as const, text: "Offer Sent" }
        case "Not a fit":
          return { variant: "destructive" as const, text: "Not a fit" }
        default:
          return { variant: "secondary" as const, text: candidate.tag }
      }
    }
    
    // Fallback based on column for time texts
    if (candidate.status === "Saved") {
      return { variant: "primary" as const, text: candidate.dateText }
    } else if (candidate.status === "Applied") {
      return { variant: "info" as const, text: candidate.dateText }
    }
    
    return { variant: "secondary" as const, text: candidate.dateText }
  }

  const tagDetails = getTagDetails()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group select-none outline-none ${
        isOverlay ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <Card
        onDoubleClick={() => setSelectedCandidateId(candidate.id)}
        className={`p-4 relative border border-slate-100 bg-white rounded-2xl transition-all shadow-xs ${
          isOverlay
            ? "shadow-lg scale-[1.02] rotate-[1deg] border-primary-border ring-2 ring-primary/10"
            : "hover:shadow-md hover:border-slate-200 active:cursor-grabbing"
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex gap-3">
            {/* Avatar */}
            <img
              src={candidate.avatar}
              alt={candidate.name}
              className="w-10 h-10 rounded-full object-cover shrink-0 pointer-events-none"
            />
            {/* Candidate Info */}
            <div className="min-w-0">
              <h4
                onClick={() => setSelectedCandidateId(candidate.id)}
                className="text-[13.5px] font-bold text-slate-800 truncate hover:text-primary cursor-pointer"
              >
                {candidate.name}
              </h4>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate font-normal">
                {candidate.title}
              </p>
              
              {/* Location */}
              <div className="text-[11.5px] text-slate-400 mt-1 font-normal">
                <span className="truncate">{candidate.location}</span>
              </div>
            </div>
          </div>

          {/* Context Options Menu */}
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer outline-none">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40" align="end">
                <DropdownMenuLabel>Candidate Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => toggleBookmark(candidate.id)}>
                  {candidate.bookmarked ? "Remove Bookmark" : "Bookmark Candidate"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => deleteCandidate(candidate.id)}
                  className="text-sec-red focus:text-sec-red hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1 text-sec-red" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Card Footer: Tag & Bookmark Ribbon */}
        <div className="flex items-center justify-between mt-3.5 pt-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant={tagDetails.variant} className="font-medium text-[11px] px-2.5 py-0.5 rounded-md">
              {tagDetails.text}
            </Badge>
            {candidate.aiScore != null && (
              <Badge variant="success" className="bg-emerald-500 text-white flex items-center gap-1 shrink-0 py-0.5 px-2 text-[10.5px] border-none">
                <Sparkles className="w-3 h-3 fill-current" />
                {candidate.aiScore}%
              </Badge>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleBookmark(candidate.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`cursor-pointer transition-colors p-1 -m-1 rounded-full hover:bg-slate-100 ${
              candidate.bookmarked
                ? "text-primary hover:text-primary-hover"
                : "text-slate-300 hover:text-slate-500"
            }`}
          >
            <Bookmark
              className="w-4 h-4"
              fill={candidate.bookmarked ? "currentColor" : "none"}
            />
          </button>
        </div>
      </Card>
    </div>
  )
}
