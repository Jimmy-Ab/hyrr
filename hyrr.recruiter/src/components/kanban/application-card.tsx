import { useDraggable } from "@dnd-kit/core"
import { Bookmark, MapPin, MoreHorizontal, Trash2 } from "lucide-react"
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
  const { toggleBookmark, deleteCandidate } = useJobStore()
  
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
        className={`p-5 relative border border-bg-border/60 bg-bg-secondary transition-all ${
          isOverlay
            ? "shadow-floating scale-[1.03] rotate-[1deg] border-primary-border ring-2 ring-primary/10"
            : "hover:shadow-card-hover hover:border-bg-border/90 active:cursor-grabbing"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            {/* Avatar */}
            <img
              src={candidate.avatar}
              alt={candidate.name}
              className="w-11 h-11 rounded-full object-cover border border-bg-border/50 shrink-0 pointer-events-none"
            />
            {/* Candidate Info */}
            <div className="min-w-0">
              <h4 className="text-body font-semibold text-txt-heading truncate">
                {candidate.name}
              </h4>
              <p className="text-caption text-txt-body mt-0.5 truncate font-medium">
                {candidate.title}
              </p>
              
              {/* Location */}
              <div className="flex items-center gap-1 text-[11px] text-txt-caption mt-2 font-medium">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
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
                <button className="text-txt-caption hover:text-txt-heading hover:bg-bg-hover p-1 rounded-full transition-colors cursor-pointer outline-none">
                  <MoreHorizontal className="w-4 h-4" />
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
        <div className="flex items-center justify-between mt-5 pt-3 border-t border-bg-border/30">
          <Badge variant={tagDetails.variant}>
            {tagDetails.text}
          </Badge>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleBookmark(candidate.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`cursor-pointer transition-colors p-1 -m-1 rounded-full hover:bg-bg-hover ${
              candidate.bookmarked
                ? "text-primary hover:text-primary-hover"
                : "text-txt-caption hover:text-txt-heading"
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
