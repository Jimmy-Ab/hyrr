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
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 select-none">
      {/* Job Title & Sub-header */}
      <div className="flex items-center justify-between border-b border-bg-border/30 pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-extrabold text-txt-title tracking-tight leading-none">
              {currentJob.title}
            </h1>
            <Badge variant="success">Active</Badge>
          </div>
          <p className="text-caption text-txt-body mt-2 font-semibold">
            {currentJob.location}  •  {currentJob.type}  •  {currentJob.posted}
          </p>
        </div>

        {/* View Switchers & Dots */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-bg-secondary p-1 border border-bg-border rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] shrink-0">
            <Button
              variant="primary"
              size="sm"
              className="h-8 rounded-[10px] gap-1.5 font-bold cursor-pointer px-3"
            >
              <Kanban className="w-4 h-4 text-white" />
              Board
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("Candidates")}
              className="text-txt-body hover:text-txt-heading h-8 rounded-[10px] gap-1.5 font-semibold cursor-pointer px-3"
            >
              <List className="w-4 h-4" />
              List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("Analytics")}
              className="text-txt-body hover:text-txt-heading h-8 rounded-[10px] gap-1.5 font-semibold cursor-pointer px-3"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
          </div>

          <Button
            variant="secondary"
            size="icon"
            onClick={() => toast("Menu Clicked", "Contextual actions triggered.", "info")}
            className="w-8 h-8 border border-bg-border hover:border-primary/20 shadow-none cursor-pointer rounded-[10px] shrink-0"
          >
            <MoreHorizontal className="w-4 h-4 text-txt-heading" />
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto custom-scrollbar-none">
        <KanbanBoard />
      </div>
    </div>
  )
}
