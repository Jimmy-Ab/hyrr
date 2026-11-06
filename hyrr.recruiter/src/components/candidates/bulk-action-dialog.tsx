import {
  applicationStatusCode,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
  type BulkAction,
  type BulkResult,
  type Candidate,
} from "hyrr.shared"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { errorMessage, PIPELINE_STATUSES } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { useCompanyLabels } from "../labels/labels"

const MOVE_TARGETS = PIPELINE_STATUSES.filter((s) => s !== "Archived")
const MAX_MESSAGE_LENGTH = 5000

const ACTION_COPY: Record<BulkAction, { title: string; confirm: string; danger?: boolean }> = {
  MOVE: { title: "Move to stage", confirm: "Move" },
  ADD_LABEL: { title: "Add label", confirm: "Add label" },
  REMOVE_LABEL: { title: "Remove label", confirm: "Remove label" },
  ARCHIVE: { title: "Archive candidates", confirm: "Archive", danger: true },
  MESSAGE: { title: "Message candidates", confirm: "Send message" },
}

const selectCls =
  "w-full h-10 px-3 rounded-xl border border-bg-border bg-bg-secondary text-[13px] text-txt-heading cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
const fieldLabelCls = "text-[12px] font-semibold text-txt-heading block mb-1.5"

interface BulkActionDialogProps {
  action: BulkAction | null
  candidates: Candidate[]
  onOpenChange: (open: boolean) => void
  /** Called with the ids that succeeded so the caller can update its selection. */
  onDone: (succeededIds: string[]) => void
}

export function BulkActionDialog({
  action,
  candidates,
  onOpenChange,
  onDone,
}: BulkActionDialogProps) {
  const bulkUpdateCandidates = useJobStore((s) => s.bulkUpdateCandidates)
  const labels = useCompanyLabels()
  const { toast } = useToast()

  const [status, setStatus] = useState<string>(MOVE_TARGETS[1] ?? "In Process")
  const [labelId, setLabelId] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<BulkResult[] | null>(null)

  useEffect(() => {
    if (action) {
      setResults(null)
      setMessage("")
      setLabelId((prev) => (labels.some((l) => l.id === prev) ? prev : (labels[0]?.id ?? "")))
    }
  }, [action]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!action) return null
  const copy = ACTION_COPY[action]
  const count = candidates.length
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.name ?? "Unknown candidate"
  const needsLabel = action === "ADD_LABEL" || action === "REMOVE_LABEL"
  const invalid =
    (needsLabel && !labelId) || (action === "MESSAGE" && !message.trim()) || count === 0

  const describe = () => {
    const who = `${count} candidate${count === 1 ? "" : "s"}`
    switch (action) {
      case "MOVE":
        return `Move ${who} to the selected stage. Candidates are notified as usual.`
      case "ADD_LABEL":
        return `Add a label to ${who}.`
      case "REMOVE_LABEL":
        return `Remove a label from ${who}.`
      case "ARCHIVE":
        return `Archive ${who}. Withdrawn applications are skipped.`
      case "MESSAGE":
        return `Send the same message to ${who}. Each one gets it in their own conversation.`
    }
  }

  const run = async () => {
    setBusy(true)
    try {
      const res = await bulkUpdateCandidates({
        applicationIds: candidates.map((c) => c.id),
        action,
        ...(action === "MOVE" ? { status: applicationStatusCode(status) } : {}),
        ...(needsLabel ? { labelId } : {}),
        ...(action === "MESSAGE" ? { message: message.trim() } : {}),
      })
      setResults(res)
      onDone(res.filter((r) => r.ok).map((r) => r.applicationId))
    } catch (err) {
      toast("Bulk action failed", errorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  const succeeded = results?.filter((r) => r.ok).length ?? 0
  const failures = results?.filter((r) => !r.ok) ?? []

  return (
    <Dialog open={!!action} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        {results ? (
          <>
            <DialogHeader>
              <DialogTitle>{copy.title}: done</DialogTitle>
              <DialogDescription>
                {succeeded} of {results.length} succeeded
                {failures.length > 0 ? `, ${failures.length} failed` : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-3">
              {succeeded > 0 && (
                <p className="flex items-center gap-2 text-[13px] text-sec-green font-semibold">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {succeeded} candidate{succeeded === 1 ? "" : "s"} updated
                </p>
              )}
              {failures.length > 0 && (
                <div>
                  <p className="flex items-center gap-2 text-[13px] text-sec-red font-semibold">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    {failures.length} failed
                  </p>
                  <ul className="mt-2 max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-bg-border bg-bg-secondary p-3">
                    {failures.map((f) => (
                      <li key={f.applicationId} className="text-[12.5px]">
                        <span className="font-semibold text-txt-heading">
                          {nameOf(f.applicationId)}
                        </span>
                        <span className="text-txt-caption">: {f.error || "Unknown error"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{describe()}</DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-3">
              {action === "MOVE" && (
                <div>
                  <label htmlFor="bulk-status" className={fieldLabelCls}>
                    Stage
                  </label>
                  <select
                    id="bulk-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={selectCls}
                  >
                    {MOVE_TARGETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {needsLabel &&
                (labels.length === 0 ? (
                  <p className="text-[13px] text-txt-caption">
                    No labels yet. Create labels in Settings first.
                  </p>
                ) : (
                  <div>
                    <label htmlFor="bulk-label" className={fieldLabelCls}>
                      Label
                    </label>
                    <select
                      id="bulk-label"
                      value={labelId}
                      onChange={(e) => setLabelId(e.target.value)}
                      className={selectCls}
                    >
                      {labels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              {action === "MESSAGE" && (
                <div>
                  <label htmlFor="bulk-message" className={fieldLabelCls}>
                    Message
                  </label>
                  <textarea
                    id="bulk-message"
                    value={message}
                    maxLength={MAX_MESSAGE_LENGTH}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hi! Thanks for applying…"
                    className="w-full min-h-[120px] px-3.5 py-2.5 rounded-xl border border-bg-border bg-bg-secondary text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 resize-y"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={copy.danger ? "danger" : "primary"}
                onClick={run}
                disabled={busy || invalid}
                className="gap-1.5"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {copy.confirm}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
