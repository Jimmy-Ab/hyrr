import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldError,
  Input,
  useToast,
} from "hyrr.shared"
import { Loader2 } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { errorMessage, MOVABLE_STATUSES } from "../../lib/recruiter"
import { useJobStore, type Candidate } from "../../store/useJobStore"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const labelCls = "text-[13px] font-semibold text-txt-heading block mb-1.5"
const selectCls =
  "w-full h-11 px-3.5 rounded-input border border-bg-border bg-bg-secondary text-[13px] text-txt-heading focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 cursor-pointer"

export function AddCandidateDialog() {
  const {
    isAddCandidateOpen,
    addCandidateColumn,
    setAddCandidateOpen,
    addCandidate,
    selectedJobId,
    jobs,
  } = useJobStore()
  const { toast } = useToast()

  const [jobId, setJobId] = useState("")
  const [status, setStatus] = useState<Candidate["status"]>("Applied")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (isAddCandidateOpen) {
      setJobId(selectedJobId || jobs[0]?.id || "")
      setStatus(
        (MOVABLE_STATUSES as readonly string[]).includes(addCandidateColumn)
          ? addCandidateColumn
          : "Applied"
      )
      setName("")
      setEmail("")
      setPhone("")
      setTitle("")
      setLocation("")
      setEmailError(null)
    }
  }, [isAddCandidateOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const [nameError, setNameError] = useState<string | null>(null)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!jobId) {
      toast("No job selected", "Create a job before adding candidates.", "error")
      return
    }
    if (name.trim().length < 2) {
      setNameError("Enter the candidate's full name")
      document.getElementById("add-candidate-name")?.focus()
      return
    }
    setNameError(null)
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter a valid email address.")
      return
    }
    setEmailError(null)
    setSubmitting(true)
    try {
      await addCandidate(jobId, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        title: title.trim() || undefined,
        location: location.trim() || undefined,
        status,
      })
      toast("Candidate added", `${name.trim()} was added to the pipeline.`, "success")
      setAddCandidateOpen(false)
    } catch (err) {
      toast("Could not add candidate", errorMessage(err), "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={isAddCandidateOpen}
      onOpenChange={(open) => !submitting && setAddCandidateOpen(open, addCandidateColumn)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
          <DialogDescription>Add a candidate to a job's hiring pipeline.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-5" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-candidate-job" className={labelCls}>
                Job *
              </label>
              <select
                id="add-candidate-job"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className={selectCls}
                required
              >
                {jobs.length === 0 && <option value="">No jobs available</option>}
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-candidate-stage" className={labelCls}>
                Stage
              </label>
              <select
                id="add-candidate-stage"
                value={status}
                onChange={(e) => setStatus(e.target.value as Candidate["status"])}
                className={selectCls}
              >
                {MOVABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="add-candidate-name" className={labelCls}>
              Full name *
            </label>
            <Input
              id="add-candidate-name"
              placeholder="e.g. Emily Carter"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
              aria-invalid={!!nameError || undefined}
              aria-describedby={nameError ? "add-candidate-name-error" : undefined}
              required
              autoComplete="off"
            />
            <FieldError id="add-candidate-name-error" message={nameError ?? undefined} />
          </div>
          <div>
            <label htmlFor="add-candidate-email" className={labelCls}>
              Email *
            </label>
            <Input
              id="add-candidate-email"
              type="email"
              placeholder="emily@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) setEmailError(null)
              }}
              required
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "add-candidate-email-error" : undefined}
              autoComplete="off"
            />
            {emailError && (
              <p id="add-candidate-email-error" className="text-[12px] text-sec-red mt-1">
                {emailError}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-candidate-phone" className={labelCls}>
                Phone
              </label>
              <Input
                id="add-candidate-phone"
                type="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="add-candidate-location" className={labelCls}>
                Location
              </label>
              <Input
                id="add-candidate-location"
                placeholder="e.g. San Francisco, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="add-candidate-title" className={labelCls}>
              Current title
            </label>
            <Input
              id="add-candidate-title"
              placeholder="e.g. Senior Frontend Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddCandidateOpen(false)}
              disabled={submitting}
              className="cursor-pointer font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || jobs.length === 0}
              className="cursor-pointer font-semibold gap-1.5"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
