import { useDroppable } from "@dnd-kit/core"
import { MoreHorizontal, Plus, Briefcase, Send, CheckCircle2, Archive, Clock } from "lucide-react"
import { ApplicationCard } from "./application-card"
import { type Candidate } from "../../store/useJobStore"
import { Button } from "../ui/button"

interface KanbanColumnProps {
  id: Candidate["status"]
  title: string
  candidates: Candidate[]
  onAddCandidate: (column: Candidate["status"]) => void
}

export function KanbanColumn({ id, title, candidates, onAddCandidate }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  // Determine header icon
  const getHeaderIcon = () => {
    switch (id) {
      case "Saved":
        return <Briefcase className="w-5 h-5 text-primary" />
      case "Applied":
        return <Send className="w-5 h-5 text-sec-blue" />
      case "In Process":
        return <Clock className="w-5 h-5 text-sec-orange" />
      case "Offer":
        return <CheckCircle2 className="w-5 h-5 text-sec-green" />
      case "Archived":
        return <Archive className="w-5 h-5 text-sec-gray" />
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[340px] shrink-0 rounded-card bg-bg-secondary border border-bg-border/60 p-4 min-h-[640px] max-h-[calc(100vh-260px)] transition-colors duration-200 ${
        isOver ? "bg-primary-light/20 border-primary-border/50" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-bg-border/20 shrink-0">
        <div className="flex items-center gap-2">
          {getHeaderIcon()}
          <span className="text-[15px] font-semibold text-txt-heading">{title}</span>
          <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-bg-primary border border-bg-border text-[11px] text-txt-body font-bold">
            {candidates.length}
          </span>
        </div>
        <button className="text-txt-caption hover:text-txt-heading p-1 rounded-full hover:bg-bg-hover transition-colors cursor-pointer outline-none">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Cards Stack */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar-none pr-0.5 min-h-0">
        {candidates.map((c) => (
          <ApplicationCard key={c.id} candidate={c} />
        ))}
        {candidates.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-bg-border/40 rounded-card text-center min-h-[140px] bg-bg-primary/20">
            <p className="text-caption text-txt-caption font-semibold">No candidates</p>
          </div>
        )}
      </div>

      {/* Add Candidate Button */}
      <Button
        variant="ghost"
        onClick={() => onAddCandidate(id)}
        className="w-full justify-center gap-1.5 mt-4 border border-dashed border-bg-border hover:border-primary-border text-txt-body hover:text-primary rounded-button text-caption hover:bg-primary-light/20 shadow-none font-semibold h-10 shrink-0 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Add candidate
      </Button>
    </div>
  )
}
