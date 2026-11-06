import { Button, useToast } from "hyrr.shared"
import { AlertTriangle, Loader2, MailWarning } from "lucide-react"
import { useState } from "react"
import { errorMessage, type JobPublishError } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"

interface JobPublishErrorNoticeProps {
  error: JobPublishError
  /** Offered when the e-mail isn't verified: drafts don't require verification. */
  onSaveDraft?: () => void
  savingDraft?: boolean
}

/** Inline explanation for JOB_CONTENT_REJECTED / EMAIL_NOT_VERIFIED, shown above the submit row. */
export function JobPublishErrorNotice({
  error,
  onSaveDraft,
  savingDraft = false,
}: JobPublishErrorNoticeProps) {
  const resendVerification = useJobStore((s) => s.resendVerification)
  const { toast } = useToast()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const resend = async () => {
    setResending(true)
    try {
      await resendVerification()
      setResent(true)
      toast("Verification e-mail sent", "Check your inbox for the confirmation link.", "success")
    } catch (err) {
      toast("Could not resend e-mail", errorMessage(err), "error")
    } finally {
      setResending(false)
    }
  }

  if (error.kind === "content") {
    return (
      <div
        role="alert"
        className="mt-4 rounded-xl border border-sec-red/30 bg-sec-red/5 p-4 text-[13px] text-txt-body"
      >
        <p className="flex items-center gap-2 font-semibold text-sec-red">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          This listing can't be published as written
        </p>
        <p className="mt-1 text-txt-caption">
          {error.details.length
            ? "Please edit the following and try again:"
            : error.message || "Some content goes against our job posting policy."}
        </p>
        {error.details.length > 0 && (
          <ul className="mt-2 list-disc pl-5 space-y-1 text-txt-heading">
            {error.details.map((d, i) => (
              <li key={`${i}-${d}`}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="mt-4 rounded-xl border border-sec-orange/30 bg-sec-orange/5 p-4 text-[13px] text-txt-body"
    >
      <p className="flex items-center gap-2 font-semibold text-sec-orange">
        <MailWarning className="w-4 h-4 shrink-0" aria-hidden="true" />
        Verify your e-mail to publish jobs
      </p>
      <p className="mt-1 text-txt-caption">
        {resent
          ? "We sent a new link. Open it, then publish again."
          : "Confirm your e-mail address using the link we sent you. You can save this job as a draft in the meantime."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={resend}
          disabled={resending}
          className="gap-1.5"
        >
          {resending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Resend verification
        </Button>
        {onSaveDraft && (
          <Button
            type="button"
            size="sm"
            onClick={onSaveDraft}
            disabled={savingDraft}
            className="gap-1.5"
          >
            {savingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save as draft
          </Button>
        )}
      </div>
    </div>
  )
}
