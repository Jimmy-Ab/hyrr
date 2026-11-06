import { MailWarning } from "lucide-react"
import * as React from "react"
import { errorMessage, isApiError } from "../../lib/api"
import { useJobStore } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { useToast } from "../ui/toast"

const RESEND_COOLDOWN_S = 60

/** Seconds-based countdown; `start()` restarts it. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCooldown(seconds = RESEND_COOLDOWN_S) {
  const [left, setLeft] = React.useState(0)
  React.useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return { left, start: React.useCallback(() => setLeft(seconds), [seconds]) }
}

/** Shown while the signed-in user's e-mail address is unverified. */
export function EmailVerificationBanner() {
  const user = useJobStore((s) => s.user)
  const resendVerification = useJobStore((s) => s.resendVerification)
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  const cooldown = useCooldown()

  if (!user || user.emailVerified) return null

  const onResend = async () => {
    setBusy(true)
    try {
      await resendVerification()
      cooldown.start()
      toast(
        "Verification e-mail sent",
        `Check ${user.email || "your inbox"} for the link.`,
        "success"
      )
    } catch (err) {
      if (isApiError(err) && err.errorCode === "TOO_MANY_REQUESTS") {
        cooldown.start()
        toast("Please wait", "You can request another e-mail in a minute.", "error")
      } else {
        toast("Couldn't send e-mail", errorMessage(err), "error")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 border-b border-sec-orange/30 bg-sec-orange/10 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-[13px] text-txt-heading">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-sec-orange" aria-hidden="true" />
        <span>
          Please verify your e-mail address{user.email ? ` (${user.email})` : ""}. Some actions,
          like applying or publishing jobs, need a verified address.
        </span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={onResend}
        disabled={busy || cooldown.left > 0}
        className="shrink-0 self-start sm:self-auto"
      >
        {busy ? "Sending…" : cooldown.left > 0 ? `Resend in ${cooldown.left}s` : "Resend e-mail"}
      </Button>
    </div>
  )
}
