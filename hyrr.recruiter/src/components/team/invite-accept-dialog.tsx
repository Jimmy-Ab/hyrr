import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  clearInviteToken,
  errorMessage,
  pendingInviteToken,
  useJobStore,
  useToast,
  type InvitePreview,
} from "hyrr.shared"
import { Loader2, Users } from "lucide-react"
import { useEffect, useState } from "react"

/** Signed-in recruiter opened a team invite link: join that company, or decline. */
export function InviteAcceptDialog() {
  const previewInvite = useJobStore((s) => s.previewInvite)
  const acceptInvite = useJobStore((s) => s.acceptInvite)
  const declineInvite = useJobStore((s) => s.declineInvite)
  const { toast } = useToast()
  const [token, setToken] = useState(() => pendingInviteToken())
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    previewInvite(token)
      .then((p) => alive && setPreview(p))
      .catch((err) => alive && setError(errorMessage(err, "This invite link is no longer valid.")))
    return () => {
      alive = false
    }
  }, [token, previewInvite])

  const close = () => {
    clearInviteToken()
    setToken(null)
  }

  const run = async (kind: "accept" | "decline") => {
    if (!token) return
    setBusy(kind)
    setError(null)
    try {
      if (kind === "accept") {
        await acceptInvite(token)
        toast("Welcome aboard", `You joined ${preview?.company.name ?? "the team"}.`, "success")
      } else {
        await declineInvite(token)
        toast("Invite declined", undefined, "success")
      }
      close()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (!token) return null
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </span>
          <DialogTitle>
            {preview
              ? `Join ${preview.company.name}?`
              : error
                ? "Invite unavailable"
                : "Team invite"}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? `${preview.invitedBy ?? "A teammate"} invited you as ${preview.roleLabel}. You'll share the company's jobs, candidates and calendar.`
              : error
                ? "Ask your team owner for a new link."
                : "Loading the invite…"}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-[13px] font-medium text-sec-red">
            {error}
          </p>
        )}
        <DialogFooter>
          {preview ? (
            <>
              <Button variant="ghost" onClick={() => run("decline")} disabled={!!busy}>
                {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" />}
                Decline
              </Button>
              <Button onClick={() => run("accept")} disabled={!!busy}>
                {busy === "accept" && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept and join
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
