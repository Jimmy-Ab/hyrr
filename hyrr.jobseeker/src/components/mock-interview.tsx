import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FieldError,
  TonePill,
  creditSuffix,
  errorMessage,
  useJobStore,
  type MockInterview,
} from "hyrr.shared"
import { Check, GraduationCap, Loader2, Mic, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useAiAvailable } from "../lib/ai-availability"
import { AiUnavailableNote } from "./ai-unavailable"

const STAR = ["situation", "task", "action", "result"] as const
const READINESS = {
  ready: { label: "Interview-ready", tone: "emerald" },
  almost: { label: "Almost there", tone: "amber" },
  needs_practice: { label: "Needs practice", tone: "rose" },
} as const

function Feedback({ a }: { a: MockInterview["answers"][number] }) {
  return (
    <div className="space-y-2 rounded-xl bg-bg-hover/50 p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-txt-heading">{a.score}/5</span>
        {STAR.map((k) => (
          <span
            key={k}
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize ${
              a.star[k] ? "bg-sec-green/10 text-sec-green" : "bg-bg-border/60 text-txt-caption"
            }`}
          >
            {a.star[k] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {k}
          </span>
        ))}
      </div>
      <p className="text-txt-body">{a.feedback}</p>
      <details>
        <summary className="cursor-pointer text-[12.5px] font-semibold text-primary">
          A stronger answer
        </summary>
        <p className="mt-1 whitespace-pre-line text-txt-body">{a.betterAnswer}</p>
      </details>
    </div>
  )
}

/** AI practice interview for one job: 5 questions, STAR feedback per answer, readiness summary. */
export function MockInterviewButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const fetchMockInterviews = useJobStore((s) => s.fetchMockInterviews)
  const startMockInterview = useJobStore((s) => s.startMockInterview)
  const answerMockQuestion = useJobStore((s) => s.answerMockQuestion)
  const cost = useJobStore((s) => s.pricing?.mockInterviewCost)
  const aiOn = useAiAvailable()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<MockInterview | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetchMockInterviews()
      .then((list) => setSession(list.find((m) => m.jobId === jobId) ?? null))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [open, jobId, fetchMockInterviews])

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      setSession(await startMockInterview(jobId))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const current =
    session?.questions.findIndex((_, i) => !session.answers.some((a) => a.index === i)) ?? -1
  const submit = async () => {
    if (!session || current < 0) return
    if (draft.trim().length < 20)
      return setError("Write at least a few sentences (20+ characters).")
    setBusy(true)
    setError(null)
    try {
      setSession(await answerMockQuestion(session.id, current, draft.trim()))
      setDraft("")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <GraduationCap className="h-4 w-4" /> Practice interview
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent variant="sheet" className="max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Practice interview</DialogTitle>
            <DialogDescription>{jobTitle}</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4 text-[13.5px]">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : !session || (session.status === "COMPLETED" && busy) ? (
              <div className="space-y-3">
                <p className="text-txt-body">
                  Five questions written for this job: three about the role and two behavioural.
                  Answer in writing and get feedback on each one using the STAR method (Situation,
                  Task, Action, Result), then a readiness summary.
                </p>
                <Button onClick={start} disabled={busy || !aiOn} className="gap-1.5">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  Start{creditSuffix(cost)}
                </Button>
                {!aiOn && <AiUnavailableNote />}
              </div>
            ) : (
              <>
                <p className="text-[12.5px] text-txt-caption">
                  {session.answers.length} of {session.questions.length} answered
                </p>
                {session.questions.map((q, i) => {
                  const a = session.answers.find((x) => x.index === i)
                  if (!a && i !== current) return null
                  return (
                    <section key={i} className="space-y-2 rounded-xl border border-bg-border p-3">
                      <div className="flex items-center gap-2">
                        <TonePill tone={q.kind === "technical" ? "blue" : "violet"}>
                          {q.kind === "technical" ? "Role" : "Behavioural"}
                        </TonePill>
                        <span className="text-[12px] text-txt-caption">Question {i + 1}</span>
                      </div>
                      <p className="font-semibold text-txt-heading">{q.question}</p>
                      {a ? (
                        <>
                          <p className="whitespace-pre-line text-txt-body">{a.answer}</p>
                          <Feedback a={a} />
                        </>
                      ) : (
                        <>
                          <p className="text-[12.5px] text-txt-caption">Tip: {q.tip}</p>
                          <label htmlFor="mock-answer" className="sr-only">
                            Your answer
                          </label>
                          <textarea
                            id="mock-answer"
                            rows={6}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Situation… Task… Action… Result…"
                            className="w-full rounded-input border border-bg-border bg-bg-secondary px-3 py-2 text-[13px] text-txt-heading"
                          />
                          <div className="flex flex-col items-end gap-1.5">
                            <Button onClick={submit} disabled={busy || !aiOn} className="gap-1.5">
                              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                              Get feedback
                            </Button>
                            {!aiOn && <AiUnavailableNote />}
                          </div>
                        </>
                      )}
                    </section>
                  )
                })}
                {session.summary && (
                  <section className="space-y-2 rounded-xl bg-bg-hover/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-txt-heading">
                        Overall {session.summary.overall}/5
                      </p>
                      <TonePill tone={READINESS[session.summary.readiness].tone}>
                        {READINESS[session.summary.readiness].label}
                      </TonePill>
                    </div>
                    {session.summary.strengths.length > 0 && (
                      <p className="text-txt-body">
                        Strengths: {session.summary.strengths.join("; ")}
                      </p>
                    )}
                    {session.summary.improvements.length > 0 && (
                      <p className="text-txt-body">
                        Work on: {session.summary.improvements.join("; ")}
                      </p>
                    )}
                    <Button size="sm" variant="secondary" onClick={start} disabled={busy || !aiOn}>
                      New practice{creditSuffix(cost)}
                    </Button>
                    {!aiOn && <AiUnavailableNote />}
                  </section>
                )}
              </>
            )}
            <FieldError id="mock-error" message={error ?? undefined} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
