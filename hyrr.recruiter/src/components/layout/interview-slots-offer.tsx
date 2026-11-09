import {
  Button,
  FieldError,
  INTERVIEW_DURATIONS,
  Input,
  TonePill,
  errorMessage,
  fieldErrorsOf,
  interviewInviteSchema,
  useJobStore,
  useToast,
  validate,
  type Candidate,
  type FieldErrors,
  type InterviewInvite,
} from "hyrr.shared"
import { CalendarClock, Loader2, Plus, Send, X } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/** `datetime-local` value one day ahead at the given hour (local time). */
const tomorrowAt = (hour: number, dayOffset = 1) => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

function InviteStatus({ invite, onWithdraw }: { invite: InterviewInvite; onWithdraw: () => void }) {
  if (invite.status === "BOOKED") {
    const slot = invite.slots.find((s) => s.booked)
    return (
      <div className="rounded-xl border border-bg-border bg-bg-hover/40 p-3 text-[13px]">
        <TonePill tone="emerald">Booked</TonePill>
        <p className="mt-2 font-semibold text-txt-heading">
          {invite.title}
          {slot ? ` · ${fmt(slot.startTime)}` : ""}
        </p>
        <p className="text-txt-caption">It's in both calendars, with an .ics invite by e-mail.</p>
      </div>
    )
  }
  if (invite.status !== "OPEN") return null
  return (
    <div className="rounded-xl border border-bg-border bg-bg-hover/40 p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <TonePill tone="amber">Waiting for {invite.candidateName || "the candidate"}</TonePill>
        <Button size="sm" variant="ghost" onClick={onWithdraw} className="text-sec-red">
          Withdraw times
        </Button>
      </div>
      <p className="mt-2 font-semibold text-txt-heading">{invite.title}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {invite.slots.map((s) => (
          <li
            key={s.id}
            className="rounded-full bg-bg-secondary px-2.5 py-1 text-[12px] text-txt-body"
          >
            {fmt(s.startTime)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "Let the candidate pick a time": the recruiter offers 1–10 times; the seeker books one. */
export function InterviewSlotsOffer({ candidate }: { candidate: Candidate }) {
  const invites = useJobStore((s) => s.interviewInvites)
  const fetchInterviewInvites = useJobStore((s) => s.fetchInterviewInvites)
  const createInterviewInvite = useJobStore((s) => s.createInterviewInvite)
  const cancelInterviewInvite = useJobStore((s) => s.cancelInterviewInvite)
  const { toast } = useToast()
  const hasAccount = candidate.source === "DIRECT"

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("Interview")
  const [durationMin, setDurationMin] = useState(45)
  const [slots, setSlots] = useState<string[]>([tomorrowAt(10), tomorrowAt(14), tomorrowAt(10, 2)])
  const [meetingUrl, setMeetingUrl] = useState("")
  const [location, setLocation] = useState("")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (hasAccount) void fetchInterviewInvites(candidate.id).catch(() => undefined)
  }, [candidate.id, hasAccount, fetchInterviewInvites])

  const latest = invites
    .filter(
      (i) => i.applicationId === candidate.id && (i.status === "OPEN" || i.status === "BOOKED")
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const iso = slots.filter(Boolean).map((v) => new Date(v).toISOString())
    const body = {
      title,
      durationMin,
      slots: iso,
      location: location || undefined,
      meetingUrl: meetingUrl || undefined,
      note: note || undefined,
    }
    const found = validate(interviewInviteSchema, body)
    setErrors(found)
    if (Object.keys(found).length) return
    setSending(true)
    try {
      await createInterviewInvite({ applicationId: candidate.id, ...body })
      toast("Times sent", `${candidate.name} can now pick one in the Hyrr app.`, "success")
      setOpen(false)
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast("Could not send the times", errorMessage(err), "error")
    } finally {
      setSending(false)
    }
  }

  const withdraw = async (id: string) => {
    try {
      await cancelInterviewInvite(id)
      toast("Times withdrawn", undefined, "success")
    } catch (err) {
      toast("Could not withdraw", errorMessage(err), "error")
    }
  }

  const slotError = (i: number) => errors[`slots.${i}`] || (i === 0 ? errors.slots : undefined)

  return (
    <section className="space-y-3" aria-labelledby="slots-offer-title">
      <div className="flex items-center justify-between gap-2">
        <h3
          id="slots-offer-title"
          className="flex items-center gap-2 text-[14px] font-semibold text-txt-heading"
        >
          <CalendarClock className="h-4 w-4 text-primary" /> Let {candidate.name.split(" ")[0]} pick
          a time
        </h3>
        {hasAccount && !open && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {latest?.status === "OPEN" ? "Offer new times" : "Offer times"}
          </Button>
        )}
      </div>

      {!hasAccount ? (
        <p className="text-[12.5px] text-txt-caption">
          This candidate has no Hyrr account, so book a fixed time below instead.
        </p>
      ) : (
        latest && !open && <InviteStatus invite={latest} onWithdraw={() => withdraw(latest.id)} />
      )}

      {open && (
        <form
          onSubmit={submit}
          noValidate
          className="space-y-3 rounded-xl border border-bg-border p-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <div>
              <label htmlFor="slots-title" className="text-[12.5px] font-medium text-txt-heading">
                Title
              </label>
              <Input
                id="slots-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={!!errors.title || undefined}
                aria-describedby={errors.title ? "slots-title-error" : undefined}
              />
              <FieldError id="slots-title-error" message={errors.title} />
            </div>
            <div>
              <label
                htmlFor="slots-duration"
                className="text-[12.5px] font-medium text-txt-heading"
              >
                Length
              </label>
              <select
                id="slots-duration"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="h-11 w-full rounded-input border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-heading"
              >
                {INTERVIEW_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[12.5px] font-medium text-txt-heading">
              Times you're free <span className="font-normal text-txt-caption">({tz})</span>
            </legend>
            {slots.map((value, i) => (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    aria-label={`Time ${i + 1}`}
                    value={value}
                    onChange={(e) =>
                      setSlots((list) => list.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    aria-invalid={!!slotError(i) || undefined}
                  />
                  {slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSlots((list) => list.filter((_, j) => j !== i))}
                      aria-label={`Remove time ${i + 1}`}
                      className="rounded-full p-1.5 text-txt-caption hover:bg-bg-hover hover:text-sec-red cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <FieldError id={`slots-${i}-error`} message={slotError(i)} />
              </div>
            ))}
            {slots.length < 10 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSlots((list) => [...list, tomorrowAt(16, list.length)])}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add a time
              </Button>
            )}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="slots-url" className="text-[12.5px] font-medium text-txt-heading">
                Meeting link <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <Input
                id="slots-url"
                placeholder="https://meet.google.com/…"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                aria-invalid={!!errors.meetingUrl || undefined}
              />
              <FieldError id="slots-url-error" message={errors.meetingUrl} />
            </div>
            <div>
              <label
                htmlFor="slots-location"
                className="text-[12.5px] font-medium text-txt-heading"
              >
                Location <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <Input
                id="slots-location"
                placeholder="Office or video call"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <FieldError id="slots-location-error" message={errors.location} />
            </div>
          </div>
          <div>
            <label htmlFor="slots-note" className="text-[12.5px] font-medium text-txt-heading">
              Note for the candidate{" "}
              <span className="font-normal text-txt-caption">(optional)</span>
            </label>
            <textarea
              id="slots-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-input border border-bg-border bg-bg-secondary px-3 py-2 text-[13px] text-txt-heading"
            />
            <FieldError id="slots-note-error" message={errors.note} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending} className="gap-1.5">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send times
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
