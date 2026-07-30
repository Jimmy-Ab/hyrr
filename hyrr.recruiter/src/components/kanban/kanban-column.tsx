import { useDroppable } from "@dnd-kit/core"
import { MoreHorizontal, Plus, Bookmark, Send, CheckCircle2, Archive, Clock } from "lucide-react"
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

  // Determine header icon with background box matching screenshot
  const getHeaderIcon = () => {
    switch (id) {
      case "Saved":
        return (
          <div className="w-7 h-7 rounded-lg bg-[#F2EFFF] flex items-center justify-center text-[#7C5CFC] shrink-0">
            <Bookmark className="w-3.5 h-3.5" />
          </div>
        )
      case "Applied":
        return (
          <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#3B82F6] shrink-0">
            <Send className="w-3.5 h-3.5" />
          </div>
        )
      case "In Process":
      case "Interviewing":
        return (
          <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
        )
      case "Offer":
        return (
          <div className="w-7 h-7 rounded-lg bg-[#E6F8ED] flex items-center justify-center text-[#10B981] shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        )
      case "Archived":
        return (
          <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#6B7280] shrink-0">
            <Archive className="w-3.5 h-3.5" />
          </div>
        )
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[300px] shrink-0 rounded-2xl p-2.5 min-h-[640px] max-h-[calc(100vh-220px)] transition-colors duration-200 ${
        isOver ? "bg-primary-light/10" : "bg-transparent"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
        <div className="flex items-center gap-2">
          {getHeaderIcon()}
          <span className="text-[14px] font-bold text-[#111827]">{title}</span>
          <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">
            {candidates.length}
          </span>
        </div>
        <button className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer outline-none">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Cards Stack */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar-none pr-0.5 min-h-0">
        {candidates.map((c) => (
          <ApplicationCard key={c.id} candidate={c} />
        ))}
        {candidates.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl text-center min-h-[140px] bg-slate-50/50">
            <p className="text-xs text-slate-400 font-medium">No candidates</p>
          </div>
        )}
      </div>

      {/* Add Candidate Button */}
      <Button
        variant="ghost"
        onClick={() => onAddCandidate(id)}
        className="w-full justify-start gap-1.5 mt-3 text-slate-400 hover:text-slate-600 rounded-xl text-[12.5px] hover:bg-slate-100/70 shadow-none font-medium h-9 shrink-0 cursor-pointer px-2"
      >
        <Plus className="w-4 h-4" />
        Add candidate
      </Button>
    </div>
  )
}
