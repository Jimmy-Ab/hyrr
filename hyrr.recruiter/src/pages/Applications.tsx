import { KanbanBoard } from "../components/kanban/kanban-board"
import { useJobStore } from "../store/useJobStore"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Kanban, List, BarChart3, MoreHorizontal } from "lucide-react"
import { useToast } from "../components/ui/toast"

export function Applications() {
  const { jobs, selectedJobId, setActiveView } = useJobStore()
  const { toast } = useToast()

  const currentJob = jobs.find((j) => j.id === selectedJobId) || jobs[0]

  if (!currentJob) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-body text-txt-body font-semibold">No active job selected.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200 select-none relative">
      {/* Job Title & Sub-header */}
      <div className="flex items-center justify-between pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight leading-none">
              {currentJob.title}
            </h1>
            <Badge variant="success" className="bg-[#E6F8ED] text-[#16A34A] hover:bg-[#E6F8ED] border-0 font-semibold px-2.5 py-0.5 rounded-md text-xs">
              Active
            </Badge>
          </div>
          <p className="text-[13px] text-slate-400 mt-1.5 font-normal">
            {currentJob.location}  •  {currentJob.type}  •  Posted 5 days ago
          </p>
        </div>

        {/* View Switchers & Dots */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white p-1 border border-slate-200 rounded-xl shadow-xs shrink-0">
            <button
              className="h-8 rounded-lg gap-1.5 font-semibold text-xs cursor-pointer px-3 flex items-center bg-primary-light text-primary border border-primary-border/40"
            >
              <Kanban className="w-3.5 h-3.5 text-primary" />
              Board
            </button>
            <button
              onClick={() => setActiveView("Candidates")}
              className="h-8 rounded-lg gap-1.5 font-medium text-xs cursor-pointer px-3 flex items-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setActiveView("Analytics")}
              className="h-8 rounded-lg gap-1.5 font-medium text-xs cursor-pointer px-3 flex items-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </button>
          </div>

          <button
            onClick={() => toast("Menu Clicked", "Contextual actions triggered.", "info")}
            className="w-8 h-8 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-colors cursor-pointer rounded-xl flex items-center justify-center shrink-0 text-slate-400"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto custom-scrollbar-none">
        <KanbanBoard />
      </div>
    </div>
  )
}
