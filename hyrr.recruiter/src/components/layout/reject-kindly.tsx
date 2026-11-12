import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  errorMessage,
  useJobStore,
  useToast,
  type Candidate,
} from "hyrr.shared"
import { HeartHandshake, Loader2 } from "lucide-react"
import { useState } from "react"

const template = (name: string, job: string, company: string) =>
  `Hi ${name.split(" ")[0]},

Thank you for applying for ${job} and for the time you put into it. After careful review we've decided to move forward with other candidates whose experience matches this role more closely.

This isn't a judgement on your potential. We'd be glad to see you apply for future openings at ${company}.

Best wishes,
The ${company} hiring team`

/** One-click polite rejection: editable message sent in the conversation, then archived. */
export function RejectKindly({ candidate, jobTitle }: { candidate: Candidate; jobTitle: string }) {
  const sendMessage = useJobStore((s) => s.sendMessage)
  const moveCandidate = useJobStore((s) => s.moveCandidate)
  const company = useJobStore((s) => s.workspaceName) || "our"
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  if (
    candidate.status === "Archived" ||
    candidate.status === "Withdrawn" ||
    candidate.status === "Reached out"
  )
    return null

  const send = async () => {
    if (text.trim().length < 20) return
    setBusy(true)
    try {
      await sendMessage(candidate.id, text.trim())
      await moveCandidate(candidate.id, "Archived")
      toast(
        "Candidate informed",
        `${candidate.name} received your message and was archived.`,
        "success"
      )
      setOpen(false)
    } catch (err) {
      toast("Could not send", errorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setText(template(candidate.name, jobTitle, company))
          setOpen(true)
        }}
        className="gap-1.5 text-txt-body"
      >
        <HeartHandshake className="h-4 w-4" /> Reject kindly
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Let {candidate.name.split(" ")[0]} know</DialogTitle>
            <DialogDescription>
              Candidates who hear back trust your company more. Edit the message, then send it; the
              candidate is moved to Archived.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="reject-message" className="sr-only">
            Message
          </label>
          <textarea
            id="reject-message"
            rows={11}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-4 w-full rounded-input border border-bg-border bg-bg-secondary px-3 py-2 text-[13px] text-txt-heading"
          />
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={send} disabled={busy || text.trim().length < 20} className="gap-1.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send and archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
