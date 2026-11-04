import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  employmentTypeCode,
  Input,
  JOB_TYPE_OPTIONS,
  RichTextEditor,
  useToast,
  type Job,
  type JobType,
} from "hyrr.shared"
import { Loader2, Plus, X } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { errorMessage, jobPublishError, type JobPublishError } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { JobPublishErrorNotice } from "../jobs/job-publish-error"

const labelCls = "text-[12px] font-semibold text-txt-heading uppercase tracking-wider block mb-1.5"
const selectCls =
  "w-full h-11 px-3.5 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 cursor-pointer"

interface EditJobDialogProps {
  job: Job | null
  onOpenChange: (open: boolean) => void
}

export function EditJobDialog({ job, onOpenChange }: EditJobDialogProps) {
  const { updateJob } = useJobStore()
  const { toast } = useToast()

  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [type, setType] = useState<JobType>(JOB_TYPE_OPTIONS[0])
  const [description, setDescription] = useState("")
  const [requirements, setRequirements] = useState<string[]>([])
  const [draftReq, setDraftReq] = useState("")
  const [saving, setSaving] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishError, setPublishError] = useState<JobPublishError | null>(null)

  useEffect(() => {
    if (job) {
      setTitle(job.title)
      setLocation(job.location)
      setType(
        (JOB_TYPE_OPTIONS as string[]).includes(job.type)
          ? (job.type as JobType)
          : JOB_TYPE_OPTIONS[0]
      )
      setDescription(job.description)
      setRequirements(job.requirements ?? [])
      setDraftReq("")
      setPublishError(null)
    }
  }, [job])

  const addRequirement = () => {
    const t = draftReq.trim()
    if (t) {
      setRequirements((r) => [...r, t])
      setDraftReq("")
    }
  }

  const patch = () => ({
    title: title.trim(),
    location: location.trim() || "Remote",
    employmentType: employmentTypeCode(type),
    description,
    requirements,
  })

  /** Content-policy / unverified-email errors stay inline in the dialog; others toast. */
  const handleError = (err: unknown) => {
    const inline = jobPublishError(err)
    if (inline) setPublishError(inline)
    else toast("Could not update job", errorMessage(err), "error")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!job) return
    if (!title.trim()) {
      toast("Missing title", "Job title is required.", "error")
      return
    }
    setSaving(true)
    setPublishError(null)
    try {
      await updateJob(job.id, patch())
      toast("Job updated", `"${title.trim()}" was saved.`, "success")
      onOpenChange(false)
    } catch (err) {
      handleError(err)
    } finally {
      setSaving(false)
    }
  }

  // Unpublishing keeps the edits without requiring a verified e-mail.
  const handleSaveDraft = async () => {
    if (!job) return
    setSavingDraft(true)
    try {
      await updateJob(job.id, { ...patch(), status: "DRAFT" })
      toast("Draft saved", `"${title.trim()}" was saved as a draft.`, "success")
      onOpenChange(false)
    } catch (err) {
      handleError(err)
    } finally {
      setSavingDraft(false)
    }
  }

  const busy = saving || savingDraft

  return (
    <Dialog open={!!job} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>Update the details candidates see for this listing.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label htmlFor="edit-job-title" className={labelCls}>
              Job Title *
            </label>
            <Input
              id="edit-job-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-job-location" className={labelCls}>
                Location
              </label>
              <Input
                id="edit-job-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-job-type" className={labelCls}>
                Job Type
              </label>
              <select
                id="edit-job-type"
                value={type}
                onChange={(e) => setType(e.target.value as JobType)}
                className={selectCls}
              >
                {JOB_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className={labelCls}>Description</span>
            <RichTextEditor value={description} onChange={setDescription} minHeight="200px" />
          </div>
          <div>
            <label htmlFor="edit-job-requirement" className={labelCls}>
              Requirements
            </label>
            <ul className="space-y-2 mb-2">
              {requirements.map((req, i) => (
                <li
                  key={`${i}-${req}`}
                  className="flex items-start gap-2 text-[12.5px] text-txt-body"
                >
                  <span className="flex-1">{req}</span>
                  <button
                    type="button"
                    onClick={() => setRequirements((r) => r.filter((_, idx) => idx !== i))}
                    aria-label={`Remove requirement: ${req}`}
                    className="text-txt-caption hover:text-sec-red cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                id="edit-job-requirement"
                value={draftReq}
                onChange={(e) => setDraftReq(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addRequirement()
                  }
                }}
                placeholder="e.g. 5+ years of React experience"
                className="h-9 text-[12px]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addRequirement}
                aria-label="Add requirement"
                className="h-9 px-3 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {publishError && (
            <JobPublishErrorNotice
              error={publishError}
              onSaveDraft={publishError.kind === "unverified" ? handleSaveDraft : undefined}
              savingDraft={savingDraft}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
