import { Button, Card, Input, Skeleton, useToast, type CandidateLabel } from "hyrr.shared"
import { Check, Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { DEFAULT_LABEL_COLOR, errorMessage, LABEL_COLORS } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { LabelDot } from "../labels/labels"
import { ConfirmDialog } from "../layout/confirm-dialog"

function ColorPicker({
  value,
  onChange,
  labelledBy,
}: {
  value: string
  onChange: (color: string) => void
  labelledBy: string
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => {
        const selected = value.toLowerCase() === c.value
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.value)}
            className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              selected ? "border-txt-heading scale-110" : "border-transparent hover:scale-110"
            }`}
            style={{ backgroundColor: c.value }}
          >
            {selected && <Check className="w-3 h-3 text-white" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

function LabelRow({ label, onDelete }: { label: CandidateLabel; onDelete: () => void }) {
  const updateLabel = useJobStore((s) => s.updateLabel)
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(label.name)
  const [color, setColor] = useState(label.color)
  const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await updateLabel(label.id, { name: trimmed, color })
      toast("Label updated", `"${trimmed}" was saved.`, "success")
      setEditing(false)
    } catch (err) {
      toast("Could not update label", errorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    const colorId = `label-color-${label.id}`
    return (
      <li className="py-3">
        <form onSubmit={save} className="space-y-2.5">
          <label htmlFor={`label-name-${label.id}`} className="sr-only">
            Label name
          </label>
          <Input
            id={`label-name-${label.id}`}
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            className="h-9 text-[13px] max-w-xs"
            autoFocus
          />
          <span id={colorId} className="sr-only">
            Label colour
          </span>
          <ColorPicker value={color} onChange={setColor} labelledBy={colorId} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !name.trim()} className="gap-1.5">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false)
                setName(label.name)
                setColor(label.color)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-3 py-2.5">
      <LabelDot color={label.color} className="w-3 h-3" />
      <span className="flex-1 min-w-0 truncate text-[14px] font-medium text-txt-heading">
        {label.name}
      </span>
      <span className="text-[12px] text-txt-caption shrink-0">
        {label.count ?? 0} candidate{label.count === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit label ${label.name}`}
          className="p-1.5 rounded-lg text-txt-caption hover:text-txt-heading hover:bg-bg-hover cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete label ${label.name}`}
          className="p-1.5 rounded-lg text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  )
}

export function LabelsManager() {
  const { labels, fetchLabels, createLabel, deleteLabel } = useJobStore()
  const { toast } = useToast()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>(DEFAULT_LABEL_COLOR)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CandidateLabel | null>(null)

  const load = async () => {
    setError(null)
    try {
      await fetchLabels()
      setLoaded(true)
    } catch (err) {
      setError(errorMessage(err, "Could not load labels."))
    }
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      await createLabel(trimmed, color)
      toast("Label created", `"${trimmed}" is ready to use.`, "success")
      setName("")
    } catch (err) {
      toast("Could not create label", errorMessage(err), "error")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteLabel(pendingDelete.id)
      toast("Label deleted", `"${pendingDelete.name}" was removed.`, "success")
    } catch (err) {
      toast("Could not delete label", errorMessage(err), "error")
      throw err
    }
  }

  const deleteCount = pendingDelete?.count ?? 0

  return (
    <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
      <section aria-labelledby="settings-labels">
        <h2 id="settings-labels" className="text-[16px] font-semibold text-txt-heading">
          Labels
        </h2>
        <p className="text-[13px] text-txt-caption mt-1">
          Tag candidates across all of your company's jobs.
        </p>

        <form onSubmit={handleCreate} className="mt-4 space-y-2.5">
          <div className="flex gap-2 max-w-sm">
            <label htmlFor="settings-new-label" className="sr-only">
              New label name
            </label>
            <Input
              id="settings-new-label"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Strong referral"
              className="h-9 text-[13px]"
            />
            <Button
              type="submit"
              size="sm"
              disabled={creating || !name.trim()}
              className="h-9 shrink-0 gap-1"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add label
            </Button>
          </div>
          <span id="settings-new-label-color" className="sr-only">
            New label colour
          </span>
          <ColorPicker value={color} onChange={setColor} labelledBy="settings-new-label-color" />
        </form>

        <div className="mt-5">
          {error ? (
            <div role="alert" className="text-[13px] text-sec-red flex items-center gap-2">
              {error}
              <button
                type="button"
                onClick={load}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : !loaded && labels.length === 0 ? (
            <div className="space-y-2" role="status" aria-label="Loading labels">
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
          ) : labels.length === 0 ? (
            <div className="flex items-center gap-2 text-[13px] text-txt-caption py-2">
              <Tag className="w-4 h-4" /> No labels yet. Add your first one above.
            </div>
          ) : (
            <ul className="divide-y divide-bg-border/50">
              {labels.map((label) => (
                <LabelRow key={label.id} label={label} onDelete={() => setPendingDelete(label)} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.name ?? "label"}"?`}
        description={
          deleteCount > 0
            ? `It will be removed from ${deleteCount} candidate${deleteCount === 1 ? "" : "s"}. This can't be undone.`
            : "No candidates use this label. This can't be undone."
        }
        onConfirm={handleDelete}
      />
    </Card>
  )
}
