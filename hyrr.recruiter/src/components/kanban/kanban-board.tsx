import {
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useToast } from "hyrr.shared"
import { useState } from "react"
import { columnForStatus, errorMessage, isWithdrawn, PIPELINE_STATUSES } from "../../lib/recruiter"
import { useJobStore, type Candidate } from "../../store/useJobStore"
import { ApplicationCard } from "./application-card"
import { KanbanColumn } from "./kanban-column"

/** Pipeline board for one job, or for every job when `jobId` is omitted. */
export function KanbanBoard({ jobId }: { jobId?: string }) {
  const { candidates, jobs, moveCandidate, searchQuery, setAddCandidateOpen } = useJobStore()
  const jobTitles = jobId ? undefined : Object.fromEntries(jobs.map((j) => [j.id, j.title]))
  const { toast } = useToast()

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const activeCandidate = candidates.find((c) => c.id === activeId)

  const query = searchQuery.trim().toLowerCase()
  const filteredCandidates = candidates.filter((c) => {
    if (jobId && c.jobId !== jobId) return false
    if (!query) return true
    return (
      c.name.toLowerCase().includes(query) ||
      (c.title || "").toLowerCase().includes(query) ||
      (c.location || "").toLowerCase().includes(query)
    )
  })

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const candidateId = String(active.id)
    const targetStatus = String(over.id) as Candidate["status"]
    const candidate = candidates.find((c) => c.id === candidateId)
    if (!candidate || isWithdrawn(candidate) || candidate.status === targetStatus) return

    try {
      await moveCandidate(candidateId, targetStatus)
      toast("Status updated", `${candidate.name} moved to ${targetStatus}.`, "success")
    } catch (err) {
      toast("Could not move candidate", errorMessage(err), "error")
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "To move a candidate, press space or enter, use the arrow keys to move to another column, then press space or enter again to drop. Press escape to cancel.",
        },
      }}
    >
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-6 pt-2 min-h-[520px]">
        {PIPELINE_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            id={status}
            title={status}
            candidates={filteredCandidates.filter((c) => columnForStatus(c.status) === status)}
            onAddCandidate={(column) => setAddCandidateOpen(true, column)}
            jobTitles={jobTitles}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: "0.4" } },
          }),
        }}
      >
        {activeCandidate ? (
          <ApplicationCard
            candidate={activeCandidate}
            isOverlay
            jobTitle={jobTitles?.[activeCandidate.jobId]}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
