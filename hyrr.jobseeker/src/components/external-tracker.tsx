import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldError,
  Input,
  errorMessage,
  externalApplicationSchema,
  fieldErrorsOf,
  useJobStore,
  useToast,
  validate,
  type ExternalApplication,
  type ExternalStage,
  type FieldErrors,
} from "hyrr.shared"
import { ExternalLink, Globe, Loader2, Plus, Trash2 } from "lucide-react"
import { useState, type FormEvent } from "react"

const STAGES: { id: ExternalStage; label: string }[] = [
  { id: "BOOKMARKED", label: "Bookmarked" },
  { id: "APPLIED", label: "Applied" },
  { id: "INTERVIEWING", label: "Interviewing" },
  { id: "OFFER", label: "Offer" },
  { id: "REJECTED", label: "Rejected" },
]

function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useJobStore((s) => s.addExternalApplication)
  const { toast } = useToast()
  const [company, setCompany] = useState("")
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [location, setLocation] = useState("")
  const [stage, setStage] = useState<ExternalStage>("APPLIED")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = { company, title, url: url || undefined, location: location || undefined }
    const found = validate(externalApplicationSchema, body)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      await add({
        ...body,
        stage,
        appliedAt: stage === "BOOKMARKED" ? undefined : new Date().toISOString(),
      })
      toast("Added to your tracker", `${title} at ${company}`, "success")
      setCompany("")
      setTitle("")
      setUrl("")
      setLocation("")
      onClose()
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast("Could not add", errorMessage(err), "error")
    } finally {
      setSaving(false)
    }
  }

  const field = "text-[12.5px] font-medium text-txt-heading"
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Track a job from elsewhere</DialogTitle>
            <DialogDescription>
              Applied on LinkedIn or a company site? Keep it next to your Hyrr applications.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="ext-company" className={field}>
                Company
              </label>
              <Input
                id="ext-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <FieldError id="ext-company-error" message={errors.company} />
            </div>
            <div>
              <label htmlFor="ext-title" className={field}>
                Job title
              </label>
              <Input id="ext-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <FieldError id="ext-title-error" message={errors.title} />
            </div>
            <div>
              <label htmlFor="ext-url" className={field}>
                Link <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <Input
                id="ext-url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <FieldError id="ext-url-error" message={errors.url} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ext-location" className={field}>
                  Location <span className="font-normal text-txt-caption">(optional)</span>
                </label>
                <Input
                  id="ext-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ext-stage" className={field}>
                  Stage
                </label>
                <select
                  id="ext-stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value as ExternalStage)}
                  className="h-11 w-full rounded-input border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-heading"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TrackedCard({ item, onRemove }: { item: ExternalApplication; onRemove: () => void }) {
  const update = useJobStore((s) => s.updateExternalApplication)
  const { toast } = useToast()
  return (
    <li className="rounded-xl border border-bg-border/60 bg-bg-secondary p-3 text-[13px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-txt-heading">{item.title}</p>
          <p className="truncate text-txt-body">
            {item.company}
            {item.location ? ` · ${item.location}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-bg-hover px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-txt-caption">
          External
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="sr-only" htmlFor={`ext-stage-${item.id}`}>
          Stage for {item.title}
        </label>
        <select
          id={`ext-stage-${item.id}`}
          value={item.stage}
          onChange={(e) =>
            update(item.id, { stage: e.target.value as ExternalStage }).catch((err) =>
              toast("Could not update", errorMessage(err), "error")
            )
          }
          className="h-8 flex-1 rounded-lg border border-bg-border bg-bg-primary px-2 text-[12.5px] text-txt-heading"
        >
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open the posting for ${item.title}`}
            className="rounded-full p-1.5 text-txt-caption hover:bg-bg-hover hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title}`}
          className="rounded-full p-1.5 text-txt-caption hover:bg-sec-red/10 hover:text-sec-red cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}

/** Jobs tracked outside Hyrr, grouped by stage (Applications page). */
export function ExternalTracker() {
  const items = useJobStore((s) => s.externalApplications)
  const remove = useJobStore((s) => s.removeExternalApplication)
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<ExternalApplication | null>(null)

  return (
    <section aria-labelledby="external-tracker" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="external-tracker"
          className="flex items-center gap-2 text-[16px] font-semibold text-txt-heading"
        >
          <Globe className="h-4 w-4 text-primary" /> Jobs you applied to elsewhere
          <span className="text-[13px] font-normal text-txt-caption">({items.length})</span>
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Track a job
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bg-border p-4 text-[13px] text-txt-caption">
          Keep every application in one place: add jobs you found on LinkedIn, Indeed or company
          sites. Only you can see them.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {STAGES.map((stage) => {
            const list = items.filter((i) => i.stage === stage.id)
            return (
              <div key={stage.id} className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-txt-caption">
                  {stage.label} · {list.length}
                </p>
                <ul className="flex flex-col gap-2">
                  {list.map((item) => (
                    <TrackedCard
                      key={item.id}
                      item={item}
                      onRemove={() => setPendingRemove(item)}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
      <AddDialog open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(o) => !o && setPendingRemove(null)}
        title="Remove from your tracker?"
        description={`${pendingRemove?.title ?? "This job"} at ${pendingRemove?.company ?? ""} will be removed.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!pendingRemove) return
          try {
            await remove(pendingRemove.id)
          } catch (err) {
            toast("Could not remove", errorMessage(err), "error")
            throw err
          }
        }}
      />
    </section>
  )
}
