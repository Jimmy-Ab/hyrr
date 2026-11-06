import {
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
  type BulkAction,
  type Candidate,
} from "hyrr.shared"
import {
  Archive,
  ArrowRightLeft,
  Bookmark,
  MapPin,
  MessageSquare,
  Search,
  StickyNote,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AiScoreChips } from "../components/ai/ai-score"
import { BulkActionDialog } from "../components/candidates/bulk-action-dialog"
import { LabelChips, LabelFilterSelect, matchesLabel } from "../components/labels/labels"
import { ConfirmDialog } from "../components/layout/confirm-dialog"
import {
  avatarFallback,
  errorMessage,
  PIPELINE_STATUSES,
  statusBadgeVariant,
  WITHDRAWN_STATUS,
} from "../lib/recruiter"
import { useJobStore } from "../store/useJobStore"

const STATUS_FILTERS = ["All", ...PIPELINE_STATUSES, WITHDRAWN_STATUS] as const

export function Candidates() {
  const {
    candidates,
    jobs,
    toggleBookmark,
    deleteCandidate,
    searchQuery,
    setSearchQuery,
    setSelectedCandidateId,
    openConversation,
    setActiveView,
    labelFilter,
  } = useJobStore()
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [pendingDelete, setPendingDelete] = useState<Candidate | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [bulkTargets, setBulkTargets] = useState<Candidate[]>([])

  const query = searchQuery.trim().toLowerCase()
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      (c.title || "").toLowerCase().includes(query) ||
      (c.location || "").toLowerCase().includes(query)
    const matchesStatus = statusFilter === "All" || c.status === statusFilter
    return matchesSearch && matchesStatus && matchesLabel(c, labelFilter)
  })

  // Selection only ever covers visible rows: drop ids hidden by filters or deleted.
  const visibleKey = filteredCandidates.map((c) => c.id).join(",")
  const visibleIds = useMemo(() => new Set(visibleKey ? visibleKey.split(",") : []), [visibleKey])
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleIds])

  const selectedCount = selected.size
  const allSelected = filteredCandidates.length > 0 && selectedCount === filteredCandidates.length
  const someSelected = selectedCount > 0 && !allSelected
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filteredCandidates.map((c) => c.id)))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const startBulk = (action: BulkAction) => {
    setBulkTargets(filteredCandidates.filter((c) => selected.has(c.id)))
    setBulkAction(action)
  }

  const jobTitle = (jobId: string) => jobs.find((j) => j.id === jobId)?.title

  const handleBookmark = async (c: Candidate) => {
    try {
      await toggleBookmark(c.id)
    } catch (err) {
      toast("Could not update bookmark", errorMessage(err), "error")
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteCandidate(pendingDelete.id)
      toast("Candidate deleted", `${pendingDelete.name} was removed.`, "success")
    } catch (err) {
      toast("Could not delete candidate", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 relative min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight">
          <span className="premium-gradient-text text-glow">Candidates Directory</span>
        </h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Detailed list of all applicants in your workspace.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-3 xl:items-center min-w-0">
        <div className="relative flex-1">
          <label htmlFor="candidates-search" className="sr-only">
            Search candidates
          </label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
          <input
            id="candidates-search"
            type="search"
            placeholder="Search candidates by name, role, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-input border border-bg-border bg-bg-secondary text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          />
        </div>
        <LabelFilterSelect id="candidates-label-filter" />
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap gap-1.5 bg-bg-secondary p-1 border border-bg-border rounded-[14px] shrink-0 self-start"
        >
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-[10px] text-caption font-semibold cursor-pointer transition-all ${
                statusFilter === status
                  ? "bg-primary text-white"
                  : "text-txt-body hover:bg-bg-hover hover:text-txt-heading"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden border border-bg-border/60 shadow-card min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={filteredCandidates.length === 0}
                  aria-label="Select all visible candidates"
                  className="w-4 h-4 accent-primary rounded cursor-pointer align-middle"
                />
              </TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Applied Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Pipeline Status</TableHead>
              <TableHead>AI Match</TableHead>
              <TableHead>Action Date</TableHead>
              <TableHead className="pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCandidates.map((c) => (
              <TableRow
                key={c.id}
                className="group"
                data-state={selected.has(c.id) ? "selected" : undefined}
              >
                <TableCell className="pl-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                    aria-label={`Select ${c.name}`}
                    className="w-4 h-4 accent-primary rounded cursor-pointer align-middle"
                  />
                </TableCell>
                <TableCell className="py-4">
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateId(c.id)}
                    className="flex items-center gap-3 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <img
                      src={c.avatar || avatarFallback(c.name)}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-bg-border/40 shrink-0"
                    />
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-txt-heading text-[15px] hover:text-primary hover:underline whitespace-nowrap">
                          {c.name}
                        </span>
                        {c.notesCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-txt-caption"
                            title={`${c.notesCount} note${c.notesCount === 1 ? "" : "s"}`}
                          >
                            <StickyNote className="w-3.5 h-3.5" aria-hidden="true" />
                            {c.notesCount}
                            <span className="sr-only"> notes</span>
                          </span>
                        )}
                      </span>
                      <LabelChips labels={c.labels} />
                    </span>
                  </button>
                </TableCell>
                <TableCell className="py-4 font-semibold text-txt-body">
                  {jobTitle(c.jobId) || c.title || "—"}
                </TableCell>
                <TableCell className="py-4">
                  {c.location ? (
                    <div className="flex items-center gap-1 text-[13px] text-txt-body font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-txt-caption" />
                      <span>{c.location}</span>
                    </div>
                  ) : (
                    <span className="text-txt-caption">—</span>
                  )}
                </TableCell>
                <TableCell className="py-4">
                  <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                </TableCell>
                <TableCell className="py-4 whitespace-nowrap">
                  <AiScoreChips candidate={c} />
                </TableCell>
                <TableCell className="py-4 text-[13px] text-txt-caption font-semibold whitespace-nowrap">
                  {c.dateText}
                </TableCell>
                <TableCell className="pr-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleBookmark(c)}
                      aria-label={
                        c.bookmarked ? `Remove bookmark for ${c.name}` : `Bookmark ${c.name}`
                      }
                      aria-pressed={c.bookmarked}
                      className={`cursor-pointer p-1.5 rounded-full hover:bg-bg-hover transition-colors ${
                        c.bookmarked ? "text-primary" : "text-txt-caption"
                      }`}
                    >
                      <Bookmark className="w-4 h-4" fill={c.bookmarked ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView("Messages")
                        openConversation(c.id).catch((err: unknown) =>
                          toast("Could not open conversation", errorMessage(err), "error")
                        )
                      }}
                      aria-label={`Message ${c.name}`}
                      title="Send Message"
                      className="cursor-pointer p-1.5 rounded-full text-txt-caption hover:text-primary hover:bg-bg-hover transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(c)}
                      aria-label={`Delete ${c.name}`}
                      title="Delete candidate"
                      className="cursor-pointer p-1.5 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredCandidates.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-txt-caption font-semibold">
                  No candidates match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {selectedCount > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-bg-border bg-bg-card p-3 shadow-floating"
        >
          <span className="text-[13px] font-semibold text-txt-heading px-1" aria-live="polite">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="p-1.5 rounded-lg text-txt-caption hover:text-txt-heading hover:bg-bg-hover cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" variant="secondary" onClick={() => startBulk("MOVE")}>
              <ArrowRightLeft className="w-3.5 h-3.5" /> Move to stage
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startBulk("ADD_LABEL")}>
              <Tag className="w-3.5 h-3.5" /> Add label
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startBulk("REMOVE_LABEL")}>
              <Tag className="w-3.5 h-3.5" /> Remove label
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startBulk("MESSAGE")}>
              <MessageSquare className="w-3.5 h-3.5" /> Message
            </Button>
            <Button size="sm" variant="danger" onClick={() => startBulk("ARCHIVE")}>
              <Archive className="w-3.5 h-3.5" /> Archive
            </Button>
          </div>
        </div>
      )}

      <BulkActionDialog
        action={bulkAction}
        candidates={bulkTargets}
        onOpenChange={(o) => !o && setBulkAction(null)}
        onDone={(ok) => setSelected((prev) => new Set([...prev].filter((id) => !ok.includes(id))))}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete candidate?"
        description={`${pendingDelete?.name ?? "This candidate"}'s application and its history will be permanently deleted.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
