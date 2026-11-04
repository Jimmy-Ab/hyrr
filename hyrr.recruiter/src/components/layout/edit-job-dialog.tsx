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
  insufficientCreditsDetails,
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
import {
  InsufficientCreditsNotice,
  PublishCostNote,
  usePublishCost,
} from "../billing/momentum-cost"
import { JobPublishErrorNotice } from "../jobs/job-publish-error"
import {
  ScreeningQuestionsEditor,
  toDraftQuestions,
  toScreeningQuestions,
  type DraftQuestion,
} from "../jobs/screening-questions-editor"

const labelCls = "text-[12px] font-semibold text-txt-heading uppercase tracking-wider block mb-1.5"
const selectCls =
  "w-full h-11 px-3.5 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 cursor-pointer"

interface EditJobDialogProps {
  job: Job | null
  onOpenChange: (open: boolean) => void
}

export function EditJobDialog({ job, onOpenChange }: EditJobDialogProps) {
  const { updateJob, fetchJobQuestions, saveJobQuestions } = useJobStore()
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
  const [publishing, setPublishing] = useState(false)
  const [creditError, setCreditError] = useState<{ required: number; balance: number } | null>(null)
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const [questionsDirty, setQuestionsDirty] = useState(false)

  const loadQuestions = async (jobId: string) => {
    setQuestionsLoading(true)
    setQuestionsError(null)
    try {
      setQuestions(toDraftQuestions(await fetchJobQuestions(jobId)))
    } catch (err) {
      setQuestionsError(errorMessage(err, "Could not load screening questions."))
    } finally {
      setQuestionsLoading(false)
    }
  }

  useEffect(() => {
    if (job) {
      setQuestions([])
      setQuestionsDirty(false)
      loadQuestions(job.id)
    }
  }, [job?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setCreditError(null)
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

  /** Saves the questions only when they were loaded and changed (never wipes on a load error). */
  const persistQuestions = async (jobId: string) => {
    if (!questionsDirty || questionsError) return true
    try {
      setQuestions(toDraftQuestions(await saveJobQuestions(jobId, toScreeningQuestions(questions))))
      setQuestionsDirty(false)
      return true
    } catch (err) {
      toast("Job saved, but questions weren't", errorMessage(err), "error")
      return false
    }
  }

  /** Content-policy / unverified-email errors stay inline in the dialog; others toast. */
  const handleError = (err: unknown) => {
    const credits = insufficientCreditsDetails(err)
    if (credits) {
      setCreditError(credits)
      return
    }
    const inline = jobPublishError(err)
    if (inline) setPublishError(inline)
    else toast("Could not update job", errorMessage(err), "error")
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void saveChanges()
  }

  const saveChanges = async () => {
    if (!job) return
    if (!title.trim()) {
      toast("Missing title", "Job title is required.", "error")
      return
    }
    setSaving(true)
    setPublishError(null)
    try {
      await updateJob(job.id, patch())
      if (!(await persistQuestions(job.id))) return
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
      if (!(await persistQuestions(job.id))) return
      toast("Draft saved", `"${title.trim()}" was saved as a draft.`, "success")
      onOpenChange(false)
    } catch (err) {
      handleError(err)
    } finally {
      setSavingDraft(false)
    }
  }

  // Drafts that were never published cost credits to publish; republishing is free.
  const isDraft = job?.status === "Draft"
  const chargesOnPublish = isDraft && !job?.publishedAt
  const publishCost = usePublishCost(
    { remote: job?.remote, salary: job?.salary || undefined, categoryId: job?.categoryId },
    !!job && chargesOnPublish
  )

  const handlePublish = async () => {
    if (!job) return
    if (!title.trim()) {
      toast("Missing title", "Job title is required.", "error")
      return
    }
    setPublishing(true)
    setPublishError(null)
    setCreditError(null)
    try {
      await updateJob(job.id, { ...patch(), status: "ACTIVE" })
      if (!(await persistQuestions(job.id))) return
      toast("Job published", `"${title.trim()}" is now accepting applications.`, "success")
      onOpenChange(false)
    } catch (err) {
      handleError(err)
    } finally {
      setPublishing(false)
    }
  }

  const busy = saving || savingDraft || publishing

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

          <div>
            <span className={labelCls}>Screening questions</span>
            <ScreeningQuestionsEditor
              idPrefix="edit-job"
              questions={questions}
              onChange={(q) => {
                setQuestions(q)
                setQuestionsDirty(true)
              }}
              loading={questionsLoading}
              error={questionsError}
              onRetry={job ? () => loadQuestions(job.id) : undefined}
            />
          </div>

          {isDraft && !creditError && (
            <div className="pt-1">
              {chargesOnPublish ? (
                <PublishCostNote
                  quote={publishCost.quote}
                  loading={publishCost.loading}
                  error={publishCost.error}
                  onRetry={publishCost.retry}
                />
              ) : (
                <p className="text-[12.5px] text-txt-caption">
                  This job was published before, so publishing it again is free.
                </p>
              )}
            </div>
          )}

          {creditError && (
            <InsufficientCreditsNotice
              required={creditError.required}
              balance={creditError.balance}
              onBuy={() => onOpenChange(false)}
              onSaveDraft={() => {
                setCreditError(null)
                void saveChanges()
              }}
              savingDraft={saving}
            />
          )}

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
            <Button
              type="submit"
              variant={isDraft ? "secondary" : "primary"}
              disabled={busy}
              className="gap-1.5"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isDraft ? "Save draft" : "Save changes"}
            </Button>
            {isDraft && (
              <Button type="button" onClick={handlePublish} disabled={busy} className="gap-1.5">
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                {chargesOnPublish && publishCost.quote
                  ? `Publish · ${publishCost.quote.cost} credits`
                  : "Publish"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
