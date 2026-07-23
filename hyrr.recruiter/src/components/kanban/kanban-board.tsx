import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import { KanbanColumn } from "./kanban-column"
import { ApplicationCard } from "./application-card"
import { useJobStore, type Candidate } from "../../store/useJobStore"
import { useToast } from "../ui/toast"

export function KanbanBoard() {
  const { candidates, selectedJobId, moveCandidate, searchQuery, setAddCandidateOpen } = useJobStore()
  const { toast } = useToast()
  
  const [activeId, setActiveId] = useState<string | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const activeCandidate = candidates.find((c) => c.id === activeId)

  // Filter candidates for selected job and query
  const filteredCandidates = candidates.filter((c) => {
    if (c.jobId !== selectedJobId) return false
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(query) ||
      c.title.toLowerCase().includes(query) ||
      c.location.toLowerCase().includes(query)
    )
  })

  const columns: { id: Candidate["status"]; title: string }[] = [
    { id: "Applied",      title: "Applied" },
    { id: "In Process",   title: "In Process" },
    { id: "Interviewing", title: "Interviewing" },
    { id: "Offer",        title: "Offer" },
    { id: "Archived",     title: "Archived" },
  ]

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const candidateId = active.id as string
    const targetStatus = over.id as Candidate["status"]

    const candidate = candidates.find((c) => c.id === candidateId)
    if (candidate && candidate.status !== targetStatus) {
      moveCandidate(candidateId, targetStatus)
      toast("Status Updated", `${candidate.name} has been moved to ${targetStatus}.`, "success")
    }
  }

  const handleOpenAddModal = (column: Candidate["status"]) => {
    setAddCandidateOpen(true, column)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-6 pt-2 custom-scrollbar-none min-h-[640px]">
        {columns.map((col) => {
          const colCandidates = filteredCandidates.filter((c) => c.status === col.id)
          return (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              candidates={colCandidates}
              onAddCandidate={handleOpenAddModal}
            />
          )
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: "0.4",
              },
            },
          }),
        }}
      >
        {activeCandidate ? (
          <ApplicationCard candidate={activeCandidate} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
