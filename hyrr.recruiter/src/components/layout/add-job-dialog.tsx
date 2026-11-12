import {
  apiFetch,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  emptySalaryRange,
  FieldError,
  fieldErrorsOf,
  Input,
  insufficientCreditsDetails,
  isSalaryRangeEmpty,
  JOB_TYPE_OPTIONS,
  jobBasicsSchema,
  RichTextEditor,
  SalaryRangeInput,
  salaryRangeSchema,
  scopeErrors,
  useToast,
  validate,
  type FieldErrors,
  type JobType,
  type SalaryRangeValue,
} from "hyrr.shared"
import { Briefcase, ChevronLeft, ChevronRight, FileText, Plus, Sparkles, X } from "lucide-react"
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
  toScreeningQuestions,
  type DraftQuestion,
} from "../jobs/screening-questions-editor"
import { useCompanySuspended } from "./company-status-banner"

interface Category {
  id: string
  name: string
  slug: string
}

const WORK_TYPES = JOB_TYPE_OPTIONS

const selectCls =
  "w-full h-11 px-3.5 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200 cursor-pointer"
const labelCls = "text-[12px] font-semibold text-txt-heading uppercase tracking-wider block mb-1.5"
const tagCls =
  "inline-flex items-center gap-1 text-[11.5px] font-bold px-2.5 py-1 rounded-full transition-colors"

export function TagInput({
  id,
  tags,
  onAdd,
  onRemove,
  placeholder,
  colorClass = "bg-primary-light text-primary border border-primary-border/30",
}: {
  id: string
  tags: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  placeholder: string
  colorClass?: string
}) {
  const [val, setVal] = useState("")
  const commit = () => {
    const trimmed = val.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed)
      setVal("")
    }
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {tags.map((t) => (
          <span key={t} className={`${tagCls} ${colorClass}`}>
            {t}
            <button
              type="button"
              onClick={() => onRemove(t)}
              aria-label={`Remove ${t}`}
              className="hover:opacity-70 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={placeholder}
          className="h-9 text-[12px]"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={commit}
          aria-label="Add"
          className="h-9 px-3 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function RequirementsList({
  id,
  items,
  onChange,
}: {
  id: string
  items: string[]
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const t = draft.trim()
    if (t) {
      onChange([...items, t])
      setDraft("")
    }
  }
  return (
    <div>
      <ul className="space-y-2 mb-2">
        {items.map((req, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] text-txt-body group">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-primary-light border border-primary-border/30 flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            </span>
            <span className="flex-1">{req}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label={`Remove requirement: ${req}`}
              className="text-txt-disabled hover:text-sec-red cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="e.g. 5+ years of React experience"
          className="h-9 text-[12px]"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={add}
          aria-label="Add requirement"
          className="h-9 px-3 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

const STEPS = [
  { label: "Basics", icon: Briefcase },
  { label: "Details", icon: FileText },
  { label: "Requirements", icon: Sparkles },
]

export function AddJobDialog() {
  const { isAddJobOpen, setAddJobOpen, addJob, saveJobQuestions } = useJobStore()
  const companySuspended = useCompanySuspended()
  const { toast } = useToast()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishError, setPublishError] = useState<JobPublishError | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  // Step 1 – Basics
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [type, setType] = useState<JobType>(JOB_TYPE_OPTIONS[0])
  const [salary, setSalary] = useState<SalaryRangeValue>(emptySalaryRange("USD"))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [categoryId, setCategoryId] = useState("")
  const [remote, setRemote] = useState(false)
  const [creditError, setCreditError] = useState<{ required: number; balance: number } | null>(null)

  // Step 2 – Description
  const [description, setDescription] = useState("")

  // Step 3 – Skills, Requirements, Benefits
  const [skills, setSkills] = useState<string[]>([])
  const [requirements, setRequirements] = useState<string[]>([])
  // Working languages; jobs default to English.
  const [languages, setLanguages] = useState<string[]>(["English"])
  const [benefits, setBenefits] = useState<string[]>([])
  const [questions, setQuestions] = useState<DraftQuestion[]>([])

  const loadCategories = async () => {
    setCategoriesLoading(true)
    setCategoriesError(null)
    try {
      const cats: Category[] = await apiFetch("/jobs/categories")
      setCategories(cats ?? [])
      setCategoryId((prev) => (cats?.some((c) => c.id === prev) ? prev : (cats?.[0]?.id ?? "")))
      if (!cats?.length) setCategoriesError("No job categories are configured.")
    } catch (err) {
      setCategoriesError(errorMessage(err, "Could not load job categories."))
    } finally {
      setCategoriesLoading(false)
    }
  }

  useEffect(() => {
    if (isAddJobOpen && (categories.length === 0 || categoriesError)) loadCategories()
  }, [isAddJobOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setStep(0)
    setTitle("")
    setLocation("")
    setType(JOB_TYPE_OPTIONS[0])
    setSalary(emptySalaryRange("USD"))
    setErrors({})
    setCategoryId(categories[0]?.id || "")
    setRemote(false)
    setCreditError(null)
    setDescription("")
    setSkills([])
    setLanguages(["English"])
    setRequirements([])
    setBenefits([])
    setQuestions([])
    setPublishError(null)
  }

  const handleClose = () => {
    reset()
    setAddJobOpen(false)
  }

  /** Inline field errors for the current step (same rules as the backend DTO). */
  const stepErrors = (which: number): FieldErrors => {
    if (which === 0)
      return {
        ...validate(jobBasicsSchema, { title, location: location || "Remote", categoryId }),
        ...validate(salaryRangeSchema, salary, "salary"),
      }
    if (which === 1) {
      const text = description
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .trim()
      return text.length < 20 ? { description: "Description must be at least 20 characters" } : {}
    }
    const out: FieldErrors = {}
    if (skills.length === 0) out.skills = "Add at least one required skill"
    if (requirements.length === 0) out.requirements = "Add at least one requirement"
    Object.assign(out, validate(jobBasicsSchema.pick({ languages: true }), { languages }))
    return out
  }

  const validateStep = () => {
    const found = stepErrors(step)
    setErrors(found)
    return Object.keys(found).length === 0
  }

  /** Server-side 400 VALIDATION_FAILED → the same inline errors, on the step that has them. */
  const showServerErrors = (err: unknown) => {
    const server = fieldErrorsOf(err)
    if (Object.keys(server).length === 0) return false
    const mapped: FieldErrors = {}
    for (const [key, message] of Object.entries(server)) {
      const salaryKey = /^salary(Min|Max|Currency|Period)$/.exec(key)
      mapped[salaryKey ? `salary.${salaryKey[1].toLowerCase()}` : key.split(".")[0]] = message
    }
    setErrors(mapped)
    const keys = Object.keys(mapped)
    if (
      keys.some(
        (k) => ["title", "location", "categoryId", "type"].includes(k) || k.startsWith("salary")
      )
    )
      setStep(0)
    else if (keys.includes("description")) setStep(1)
    else setStep(2)
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    setStep((s) => s + 1)
  }

  const jobInput = (): Parameters<typeof addJob>[0] => ({
    title,
    location: location || "Remote",
    type,
    ...(isSalaryRangeEmpty(salary)
      ? {}
      : {
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryCurrency: salary.currency || null,
          salaryPeriod: salary.period,
        }),
    description,
    requirements,
    skills,
    languages,
    benefits,
    categoryId,
    remote,
  })

  const publishCost = usePublishCost(
    {
      remote,
      salaryMax: isSalaryRangeEmpty(salary) ? null : salary.max,
      salaryCurrency: salary.currency || null,
      salaryPeriod: salary.period,
      categoryId: categoryId || undefined,
    },
    isAddJobOpen && !!categoryId
  )

  /** Creates the job, then saves its screening questions. false = questions failed (job exists). */
  const createJob = async (input: Parameters<typeof addJob>[0]) => {
    const created = await addJob(input)
    const payload = toScreeningQuestions(questions)
    if (payload.length === 0 || !created?.id) return true
    try {
      await saveJobQuestions(created.id, payload)
      return true
    } catch (err) {
      toast(
        "Job created, but questions weren't saved",
        `${errorMessage(err)} Add them from Edit job.`,
        "error"
      )
      return false
    }
  }

  /** Shows content-policy / unverified-email errors inline; anything else is a toast. */
  const handleError = (err: unknown, failTitle: string) => {
    const credits = insufficientCreditsDetails(err)
    if (credits) {
      setCreditError(credits)
      return
    }
    if (showServerErrors(err)) return
    const inline = jobPublishError(err)
    if (inline) setPublishError(inline)
    else toast(failTitle, errorMessage(err), "error")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateStep()) return
    setLoading(true)
    setPublishError(null)
    setCreditError(null)
    try {
      if (await createJob(jobInput())) {
        toast("Job published", `"${title}" is now live in your job board.`, "success")
      }
      handleClose()
    } catch (err) {
      handleError(err, "Could not create job")
    } finally {
      setLoading(false)
    }
  }

  // Drafts aren't visible to candidates, so they don't need a verified e-mail.
  const handleSaveDraft = async () => {
    setSavingDraft(true)
    setCreditError(null)
    try {
      const draft = { ...jobInput(), status: "DRAFT" as const }
      if (await createJob(draft)) {
        toast(
          "Draft saved",
          `"${title}" was saved as a draft. Publish it once you're verified.`,
          "success"
        )
      }
      handleClose()
    } catch (err) {
      handleError(err, "Could not save draft")
    } finally {
      setSavingDraft(false)
    }
  }

  const busy = loading || savingDraft

  if (companySuspended)
    return (
      <Dialog open={isAddJobOpen} onOpenChange={(open) => !open && setAddJobOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Posting is paused</DialogTitle>
            <DialogDescription>
              Your company is suspended by Hyrr, so new jobs can't be posted. Check your
              notifications for the reason, or contact support to restore access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddJobOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

  return (
    <Dialog open={isAddJobOpen} onOpenChange={(open) => !open && !busy && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Job Listing</DialogTitle>
          <DialogDescription>
            Fill in all details to post a new opening to your hiring board.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mt-2 mb-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={s.label} className="flex items-center flex-1">
                <div
                  className={`flex items-center gap-2 text-[12px] font-semibold transition-all ${active ? "text-primary" : done ? "text-sec-green" : "text-txt-disabled"}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${active ? "border-primary bg-primary-light" : done ? "border-sec-green bg-sec-green/10" : "border-bg-border bg-bg-primary"}`}
                  >
                    {done ? (
                      <svg
                        className="w-3.5 h-3.5 text-sec-green"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 transition-colors ${done ? "bg-sec-green" : "bg-bg-border"}`}
                  />
                )}
              </div>
            )
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Step 0: Basics ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="job-title" className={labelCls}>
                    Job Title *
                  </label>
                  <Input
                    id="job-title"
                    placeholder="e.g. Senior Frontend Developer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-invalid={!!errors.title || undefined}
                    aria-describedby={errors.title ? "job-title-error" : undefined}
                    className={errors.title ? "border-sec-red/70" : undefined}
                  />
                  <FieldError id="job-title-error" message={errors.title} />
                </div>
                <div>
                  <label htmlFor="job-location" className={labelCls}>
                    Location
                  </label>
                  <Input
                    id="job-location"
                    placeholder="e.g. San Francisco, CA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    aria-invalid={!!errors.location || undefined}
                    aria-describedby={errors.location ? "job-location-error" : undefined}
                  />
                  <FieldError id="job-location-error" message={errors.location} />
                </div>
                <div className="sm:col-span-2">
                  <SalaryRangeInput
                    id="job-salary"
                    label="Salary range (optional)"
                    value={salary}
                    onChange={setSalary}
                    errors={scopeErrors(errors, "salary")}
                  />
                </div>
                <div>
                  <label htmlFor="job-type" className={labelCls}>
                    Job Type
                  </label>
                  <select
                    id="job-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className={selectCls}
                  >
                    {WORK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="job-category" className={labelCls}>
                    Work Field / Category *
                  </label>
                  <select
                    id="job-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={categoriesLoading || !!categoriesError}
                    aria-invalid={!!categoriesError}
                    aria-describedby={categoriesError ? "job-category-error" : undefined}
                    className={`${selectCls} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {categoriesLoading && categories.length === 0 && (
                      <option value="">Loading…</option>
                    )}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FieldError id="job-category-field-error" message={errors.categoryId} />
                  {categoriesError && (
                    <p
                      id="job-category-error"
                      role="alert"
                      className="mt-1.5 text-[12px] text-sec-red flex items-center gap-2"
                    >
                      {categoriesError}
                      <button
                        type="button"
                        onClick={loadCategories}
                        className="font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Retry
                      </button>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                  <span className="text-[13px] font-medium text-txt-heading">Remote Friendly</span>
                </label>
              </div>
            </div>
          )}

          {/* ── Step 1: Description ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <span className={labelCls}>Job Description (Rich Text) *</span>
                <p className="text-[11.5px] text-txt-caption mb-2.5">
                  Use formatting tools below to add section headings, bullet lists, bold text, or
                  click <strong className="text-primary font-bold">✨ AI Template</strong> to
                  generate a structured job layout.
                </p>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="We are seeking an experienced Senior Software Developer to design, develop, and maintain..."
                  minHeight="240px"
                />
                <FieldError id="job-description-error" message={errors.description} />
              </div>
            </div>
          )}

          {/* ── Step 2: Skills, Requirements, Benefits ─────────────────────── */}
          {step === 2 && (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label htmlFor="job-skills" className={labelCls}>
                  Required Skills *
                </label>
                <p className="text-[11.5px] text-txt-caption mb-2">
                  Press Enter or click + to add. At least one required.
                </p>
                <TagInput
                  id="job-skills"
                  tags={skills}
                  onAdd={(v) => setSkills([...skills, v])}
                  onRemove={(v) => setSkills(skills.filter((s) => s !== v))}
                  placeholder="e.g. React, TypeScript…"
                />
                <FieldError id="job-skills-error" message={errors.skills} />
              </div>
              <div>
                <label htmlFor="job-languages" className={labelCls}>
                  Languages *
                </label>
                <p className="text-[11.5px] text-txt-caption mb-2">
                  Languages the job is done in (1–5). Seekers can filter by their own languages.
                </p>
                <TagInput
                  id="job-languages"
                  tags={languages}
                  onAdd={(v) =>
                    !languages.some((l) => l.toLowerCase() === v.toLowerCase()) &&
                    setLanguages([...languages, v])
                  }
                  onRemove={(v) => setLanguages(languages.filter((l) => l !== v))}
                  placeholder="e.g. English, Amharic…"
                />
                <FieldError id="job-languages-error" message={errors.languages} />
              </div>
              <div>
                <label htmlFor="job-requirements" className={labelCls}>
                  Requirements *
                </label>
                <p className="text-[11.5px] text-txt-caption mb-2">
                  Add hiring requirements one by one. At least one required.
                </p>
                <RequirementsList
                  id="job-requirements"
                  items={requirements}
                  onChange={setRequirements}
                />
                <FieldError id="job-requirements-error" message={errors.requirements} />
              </div>
              <div>
                <label htmlFor="job-benefits" className={labelCls}>
                  Benefits & Perks
                </label>
                <p className="text-[11.5px] text-txt-caption mb-2">
                  Optional — helps attract candidates.
                </p>
                <TagInput
                  id="job-benefits"
                  tags={benefits}
                  onAdd={(v) => setBenefits([...benefits, v])}
                  onRemove={(v) => setBenefits(benefits.filter((b) => b !== v))}
                  placeholder="e.g. Unlimited PTO, Equity…"
                  colorClass="bg-sec-green/10 text-sec-green border border-sec-green/20"
                />
              </div>
              <div>
                <span className={labelCls}>Screening questions</span>
                <p className="text-[11.5px] text-txt-caption mb-2">
                  Optional — up to 10 questions candidates answer when applying.
                </p>
                <ScreeningQuestionsEditor
                  idPrefix="add-job"
                  questions={questions}
                  onChange={setQuestions}
                />
              </div>
            </div>
          )}

          {step === STEPS.length - 1 && !creditError && (
            <div className="mt-4">
              <PublishCostNote
                quote={publishCost.quote}
                loading={publishCost.loading}
                error={publishCost.error}
                onRetry={publishCost.retry}
              />
            </div>
          )}

          {creditError && (
            <InsufficientCreditsNotice
              required={creditError.required}
              balance={creditError.balance}
              onBuy={handleClose}
              onSaveDraft={handleSaveDraft}
              savingDraft={savingDraft}
            />
          )}

          {publishError && (
            <JobPublishErrorNotice
              error={publishError}
              onSaveDraft={publishError.kind === "unverified" ? handleSaveDraft : undefined}
              savingDraft={savingDraft}
            />
          )}

          <DialogFooter className="mt-6 flex justify-between">
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  className="cursor-pointer gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={busy}
                className="cursor-pointer"
              >
                Cancel
              </Button>
            </div>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext} className="cursor-pointer gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={busy}
                className="cursor-pointer gap-1.5 min-w-[140px]"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Creating…
                  </>
                ) : publishCost.quote ? (
                  `Publish · ${publishCost.quote.cost} credits`
                ) : (
                  "Publish job"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
