import { Button, Input, useToast, type Candidate } from "hyrr.shared"
import { Check, Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { errorMessage, LABEL_COLORS } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { LabelDot, useCompanyLabels } from "../labels/labels"

/** Toggle company labels on one candidate; create a new label inline. */
export function CandidateLabelsEditor({ candidate }: { candidate: Candidate }) {
  const labels = useCompanyLabels()
  const { setCandidateLabels, createLabel } = useJobStore()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  const selected = new Set((candidate.labels ?? []).map((l) => l.id))

  const save = async (ids: string[]) => {
    setBusy(true)
    try {
      await setCandidateLabels(candidate.id, ids)
    } catch (err) {
      toast("Could not update labels", errorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    save([...next])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      toast("Label exists", `"${name}" is already a label. Select it above.`, "error")
      return
    }
    setCreating(true)
    try {
      const color = LABEL_COLORS[labels.length % LABEL_COLORS.length]!.value
      const created = await createLabel(name, color)
      setNewName("")
      await save([...selected, created.id])
      toast("Label created", `"${name}" was added.`, "success")
    } catch (err) {
      toast("Could not create label", errorMessage(err), "error")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      {labels.length === 0 ? (
        <p className="text-[12.5px] text-txt-caption">
          No labels yet. Create one below to tag candidates.
        </p>
      ) : (
        <div role="group" aria-label="Candidate labels" className="flex flex-wrap gap-1.5">
          {labels.map((label) => {
            const on = selected.has(label.id)
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => toggle(label.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold transition-colors cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  on
                    ? "border-primary bg-primary-light text-primary"
                    : "border-bg-border bg-bg-secondary text-txt-body hover:bg-bg-hover"
                }`}
              >
                <LabelDot color={label.color} />
                {label.name}
                {on && <Check className="w-3 h-3" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
      <form onSubmit={handleCreate} className="flex gap-2 max-w-sm">
        <label htmlFor={`new-label-${candidate.id}`} className="sr-only">
          New label name
        </label>
        <Input
          id={`new-label-${candidate.id}`}
          value={newName}
          maxLength={30}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New label…"
          className="h-9 text-[12px]"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={creating || !newName.trim()}
          className="h-9 px-3 shrink-0 gap-1"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create
        </Button>
      </form>
    </div>
  )
}
