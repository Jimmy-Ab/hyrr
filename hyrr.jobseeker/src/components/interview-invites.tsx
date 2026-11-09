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
  type InterviewInvite,
} from "hyrr.shared"
import { CalendarClock, Loader2, MapPin, Video } from "lucide-react"
import { useEffect, useState } from "react"

const OPEN_EVENT = "hyrr:pick-interview"

/** Opens the picker for one invite from anywhere (banner buttons, notifications). */
export const openInterviewPicker = (inviteId: string) =>
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: inviteId }))

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
const day = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

/** "Pick your interview time": opens by itself when an invite arrives live. Mounted once in App. */
export function InterviewPicker() {
  const invites = useJobStore((s) => s.interviewInvites)
  const liveEvent = useJobStore((s) => s.liveEvent)
  const bookInterviewSlot = useJobStore((s) => s.bookInterviewSlot)
  const { toast } = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [slotId, setSlotId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onOpen = (e: Event) => setOpenId((e as CustomEvent<string>).detail)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])
  useEffect(() => {
    if (liveEvent?.kind === "interview_invite") setOpenId(liveEvent.id)
  }, [liveEvent])

  const invite = invites.find((i) => i.id === openId && i.status === "OPEN")
  useEffect(() => {
    setSlotId(null)
    setError(null)
  }, [openId])

  const close = () => setOpenId(null)
  const book = async () => {
    if (!invite || !slotId) return
    setBusy(true)
    setError(null)
    try {
      await bookInterviewSlot(invite.id, slotId)
      const slot = invite.slots.find((s) => s.id === slotId)
      toast(
        "Interview booked",
        slot
          ? `${day(slot.startTime)}, ${time(slot.startTime)}. It's in your calendar.`
          : undefined,
        "success"
      )
      close()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Group the offered times by day.
  const byDay = new Map<string, InterviewInvite["slots"]>()
  for (const s of invite?.slots ?? []) {
    const key = day(s.startTime)
    byDay.set(key, [...(byDay.get(key) ?? []), s])
  }

  return (
    <Dialog open={!!invite} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        {invite && (
          <>
            <DialogHeader>
              <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <CalendarClock className="h-5 w-5" />
              </span>
              <DialogTitle>Pick your interview time</DialogTitle>
              <DialogDescription>
                {invite.companyName ?? "The hiring team"} invited you to "{invite.title}" for{" "}
                {invite.jobTitle} ({invite.durationMin} min). Times are shown in {tz}.
              </DialogDescription>
            </DialogHeader>
            <div
              className="mt-4 flex flex-col gap-4"
              role="radiogroup"
              aria-label="Interview times"
            >
              {[...byDay.entries()].map(([label, slots]) => (
                <div key={label}>
                  <p className="mb-2 text-[12.5px] font-semibold text-txt-heading">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={slotId === s.id}
                        onClick={() => setSlotId(s.id)}
                        className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors cursor-pointer ${
                          slotId === s.id
                            ? "border-primary bg-primary text-white"
                            : "border-bg-border bg-bg-secondary text-txt-heading hover:border-primary/40"
                        }`}
                      >
                        {time(s.startTime)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {(invite.location || invite.meetingUrl) && (
                <p className="flex items-center gap-2 text-[13px] text-txt-body">
                  {invite.meetingUrl ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {invite.location || "Video call (link in your calendar)"}
                </p>
              )}
              {invite.note && (
                <p className="whitespace-pre-line rounded-xl bg-bg-hover/60 p-3 text-[13px] text-txt-body">
                  {invite.note}
                </p>
              )}
              {error && (
                <p role="alert" className="text-[13px] font-medium text-sec-red">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Later
              </Button>
              <Button onClick={book} disabled={!slotId || busy} className="gap-1.5">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Book this time
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Banner listing invites still waiting for a time (Applications and Calendar pages). */
export function PendingInterviewInvites() {
  const invites = useJobStore((s) => s.interviewInvites).filter((i) => i.status === "OPEN")
  if (!invites.length) return null
  return (
    <div className="flex flex-col gap-2">
      {invites.map((i) => (
        <div
          key={i.id}
          className="tone-violet flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--tone-ring)] bg-[var(--tone-bg)] p-4"
        >
          <CalendarClock className="h-5 w-5 shrink-0 text-[var(--tone-fg)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-txt-heading">
              {i.companyName ?? "A hiring team"} wants to interview you
            </p>
            <p className="text-[12.5px] text-txt-body">
              {i.title} · {i.jobTitle} · {i.slots.length} time{i.slots.length === 1 ? "" : "s"}{" "}
              offered
            </p>
          </div>
          <Button size="sm" onClick={() => openInterviewPicker(i.id)}>
            Choose a time
          </Button>
        </div>
      ))}
    </div>
  )
}
