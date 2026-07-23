import { useState, useEffect } from "react"
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor,
  type DragEndEvent, type DragStartEvent, defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import { useDroppable, useDraggable } from "@dnd-kit/core"
import { useJobStore, type JobApplication } from "hyrr.shared"
import { Card, Badge, Button, useToast } from "hyrr.shared"
import {
  Bookmark, MoreHorizontal, MapPin, DollarSign, Calendar, User, LayoutList
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "hyrr.shared"

// ─── Kanban Column ─────────────────────────────────────────────────────────────
const columnColors: Record<string, string> = {
  Saved:      "text-primary bg-primary-light border-primary-border/40",
  Applied:    "text-sec-blue bg-sec-blue/10 border-sec-blue/20",
  "In Process": "text-sec-orange bg-sec-orange/10 border-sec-orange/20",
  Offer:      "text-sec-green bg-sec-green/10 border-sec-green/20",
  Archived:   "text-txt-caption bg-bg-primary border-bg-border/40",
}

function JobColumn({
  id, title, items
}: {
  id: JobApplication["status"]
  title: string
  items: JobApplication[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[280px] min-w-[280px] shrink-0 rounded-[20px] bg-bg-secondary/60 border transition-all duration-200 ${
        isOver ? "border-primary/40 bg-primary-light/30 shadow-card" : "border-bg-border/40"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-bg-border/30">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold border ${columnColors[id]}`}>
            {items.length}
          </span>
          <h3 className="text-[14px] font-bold text-txt-heading">{title}</h3>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 p-3 flex-1 min-h-[480px]">
        {items.map((app) => <JobCard key={app.id} application={app} />)}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-txt-disabled">
            <LayoutList className="w-8 h-8 opacity-30" />
            <p className="text-[12px] font-medium">No jobs here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Job Card ──────────────────────────────────────────────────────────────────
const companyDotColors: Record<string, string> = {
  purple: "bg-primary text-white",
  blue:   "bg-sec-blue text-white",
  green:  "bg-sec-green text-white",
  orange: "bg-sec-orange text-white",
}

const badgeVariant = (status: JobApplication["status"]) => {
  if (status === "Offer")      return "success" as const
  if (status === "Archived")   return "secondary" as const
  if (status === "In Process") return "warning" as const
  if (status === "Applied")    return "info" as const
  return "primary" as const
}

function JobCard({ application, isOverlay = false }: { application: JobApplication; isOverlay?: boolean }) {
  const { toggleJobBookmark, moveJobApplication } = useJobStore()

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
    disabled: isOverlay,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.3 : 1 }
    : undefined

  const tag = application.tag
  const tagVariant = tag === "Offer Received" ? "success" as const
    : tag === "Not a fit"         ? "destructive" as const
    : tag === "Technical Interview" ? "warning" as const
    : "secondary" as const

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group select-none outline-none ${isOverlay ? "cursor-grabbing" : "cursor-grab"}`}
    >
      <Card
        className={`p-4 relative border border-bg-border/60 bg-bg-secondary transition-all ${
          isOverlay
            ? "shadow-floating scale-[1.03] rotate-[1deg] border-primary-border ring-2 ring-primary/10"
            : "hover:shadow-card-hover hover:border-bg-border/90 active:cursor-grabbing"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          {/* Company Logo + Info */}
          <div className="flex gap-3">
            <div className={`w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center font-bold text-[13px] ${companyDotColors[application.companyColor] ?? "bg-primary text-white"}`}>
              {application.company[0]}
            </div>
            <div className="min-w-0">
              <h4 className="text-body font-semibold text-txt-heading truncate">{application.title}</h4>
              <p className="text-caption text-txt-body mt-0.5 font-medium">{application.company}</p>
            </div>
          </div>

          {/* Context Menu */}
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
              <DropdownMenuContent className="w-48" align="end">
                <DropdownMenuLabel>Application Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => toggleJobBookmark(application.id)}>
                  {application.bookmarked ? "Remove Bookmark" : "Bookmark"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => moveJobApplication(application.id, "Archived")} className="text-sec-red focus:text-sec-red">
                  Archive Application
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11.5px] text-txt-caption font-medium">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{application.location}</span>
            <span className="mx-0.5">·</span>
            <span>{application.type}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-txt-caption font-medium">
            <DollarSign className="w-3.5 h-3.5 shrink-0" />
            <span>{application.salary}</span>
          </div>
          {application.interviewDate && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-primary font-semibold">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Interview: {application.interviewDate}</span>
            </div>
          )}
        </div>

        {/* Recruiter */}
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-2 mt-3 pt-3 border-t border-bg-border/30"
        >
          <img
            src={application.recruiterAvatar}
            alt={application.recruiterName}
            className="w-5 h-5 rounded-full object-cover pointer-events-none"
          />
          <span className="text-[11px] text-txt-caption font-medium flex items-center gap-1">
            <User className="w-3 h-3" /> {application.recruiterName}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {tag && <Badge variant={tagVariant}>{tag}</Badge>}
            <button
              onClick={(e) => { e.stopPropagation(); toggleJobBookmark(application.id) }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`cursor-pointer transition-colors p-1 -m-1 rounded-full hover:bg-bg-hover ${
                application.bookmarked ? "text-primary" : "text-txt-caption hover:text-txt-heading"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={application.bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────
export function ApplicationsBoard() {
  const { jobApplications, moveJobApplication, fetchInitialData } = useJobStore()
  const { toast } = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    fetchInitialData()
  }, []) // eslint-disable-line

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeApp = jobApplications.find((a) => a.id === activeId)

  const columns: { id: JobApplication["status"]; title: string }[] = [
    { id: "Saved",      title: "Saved" },
    { id: "Applied",    title: "Applied" },
    { id: "In Process", title: "In Process" },
    { id: "Offer",      title: "Offer" },
    { id: "Archived",   title: "Archived" },
  ]

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)
  const handleDragEnd   = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const app = jobApplications.find((a) => a.id === active.id)
    const targetStatus = over.id as JobApplication["status"]
    if (app && app.status !== targetStatus) {
      moveJobApplication(app.id, targetStatus)
      toast("Status Updated", `${app.title} moved to ${targetStatus}`, "success")
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div>
        <h1 className="text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">My Applications</span>
          </h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Drag jobs between columns to track your search pipeline — just like a recruiter would.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-4">
        {columns.map((col) => {
          const count = jobApplications.filter((a) => a.status === col.id).length
          return (
            <Card key={col.id} className="p-4 flex flex-col items-center">
              <span className={`text-[22px] font-extrabold ${
                col.id === "Offer" ? "text-sec-green" : col.id === "Archived" ? "text-txt-caption" : "text-txt-title"
              }`}>{count}</span>
              <span className="text-[11px] text-txt-caption font-semibold mt-0.5">{col.title}</span>
            </Card>
          )
        })}
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 custom-scrollbar-none min-h-[600px]">
          {columns.map((col) => (
            <JobColumn
              key={col.id}
              id={col.id}
              title={col.title}
              items={jobApplications.filter((a) => a.status === col.id)}
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
          {activeApp ? <JobCard application={activeApp} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
