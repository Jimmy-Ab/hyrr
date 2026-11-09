import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  errorMessage,
  useJobStore,
  useToast,
  type SkillOverviewItem,
  type SkillTest,
  type SkillTestResult,
} from "hyrr.shared"
import { BadgeCheck, Clock, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

function Countdown({ until, onEnd }: { until: string; onEnd: () => void }) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => {
      const ms = new Date(until).getTime() - Date.now()
      setLeft(ms)
      if (ms <= 0) {
        clearInterval(t)
        onEnd()
      }
    }, 1000)
    return () => clearInterval(t)
  }, [until, onEnd])
  const s = Math.max(0, Math.floor(left / 1000))
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold tabular-nums ${s < 60 ? "text-sec-red" : "text-txt-heading"}`}
    >
      <Clock className="h-4 w-4" /> {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  )
}

/** Profile: timed skill tests; passing earns a "Verified" badge recruiters see in talent search. */
export function VerifiedSkills() {
  const fetchSkillOverview = useJobStore((s) => s.fetchSkillOverview)
  const startSkillTest = useJobStore((s) => s.startSkillTest)
  const submitSkillTest = useJobStore((s) => s.submitSkillTest)
  const { toast } = useToast()
  const [items, setItems] = useState<SkillOverviewItem[]>([])
  const [test, setTest] = useState<SkillTest | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<SkillTestResult | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    void fetchSkillOverview()
      .then(setItems)
      .catch(() => undefined)
  }, [fetchSkillOverview])
  useEffect(load, [load])

  const start = async (skill: string) => {
    setBusy(skill)
    try {
      const t = await startSkillTest(skill)
      setTest(t)
      setAnswers(Array(t.questions.length).fill(-1))
      setResult(null)
    } catch (err) {
      toast("Can't start the test", errorMessage(err), "error")
    } finally {
      setBusy(null)
    }
  }

  const submit = useCallback(async () => {
    if (!test) return
    setBusy("submit")
    try {
      setResult(await submitSkillTest(test.id, answers))
      load()
    } catch (err) {
      toast("Could not submit", errorMessage(err), "error")
    } finally {
      setBusy(null)
    }
  }, [test, answers, submitSkillTest, load, toast])

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-txt-heading">Verified skills</h2>
        <p className="text-[12.5px] text-txt-caption">
          A 10-question, 10-minute test per skill. Score 80% or more for a Verified badge (valid 12
          months) that recruiters see, and you rank higher in their talent search. Free.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.skill}
            className="flex items-center justify-between gap-2 rounded-xl border border-bg-border/60 px-3 py-2 text-[13px]"
          >
            <span className="flex items-center gap-1.5 font-medium text-txt-heading">
              {it.verified && (
                <BadgeCheck className="h-4 w-4 text-sec-green" aria-label="Verified" />
              )}
              {it.skill}
            </span>
            {it.verified ? (
              <span className="text-[12px] text-sec-green">
                Verified until {new Date(it.validUntil!).toLocaleDateString()}
              </span>
            ) : it.retryAt ? (
              <span className="text-[12px] text-txt-caption">
                {it.lastScore}% · retake {new Date(it.retryAt).toLocaleDateString()}
              </span>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={!!busy}
                onClick={() => start(it.skill)}
              >
                {busy === it.skill && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Take test
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={!!test} onOpenChange={(o) => !o && !busy && setTest(null)}>
        <DialogContent variant="sheet" className="max-w-xl overflow-y-auto">
          {test && (
            <>
              <DialogHeader>
                <DialogTitle>{test.skill} test</DialogTitle>
                <DialogDescription>
                  {result
                    ? "Your result"
                    : `Pass with ${test.passPercent}%. Answers are checked when you submit.`}
                </DialogDescription>
              </DialogHeader>
              {result ? (
                <div className="mt-6 space-y-3 text-[14px]">
                  <p className="text-[28px] font-extrabold text-txt-title">{result.score}%</p>
                  <p className="text-txt-body">
                    {result.correct} of {result.total} correct.{" "}
                    {result.late
                      ? "Time ran out before you submitted."
                      : result.passed
                        ? `You're verified in ${result.skill}!`
                        : "Not quite. You can retake it in 7 days."}
                  </p>
                  <Button onClick={() => setTest(null)}>Done</Button>
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  <div className="flex justify-end">
                    <Countdown until={test.expiresAt} onEnd={submit} />
                  </div>
                  {test.questions.map((q, i) => (
                    <fieldset key={q.id} className="space-y-2">
                      <legend className="text-[13.5px] font-semibold text-txt-heading">
                        {i + 1}. {q.question}
                      </legend>
                      {q.options.map((o, j) => (
                        <label
                          key={j}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-bg-border/60 px-3 py-2 text-[13px] text-txt-body hover:bg-bg-hover/50"
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[i] === j}
                            onChange={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))}
                            className="mt-0.5"
                          />
                          {o}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-txt-caption">
                      {answers.filter((a) => a >= 0).length} of {test.questions.length} answered
                    </span>
                    <Button onClick={submit} disabled={busy === "submit"} className="gap-1.5">
                      {busy === "submit" && <Loader2 className="h-4 w-4 animate-spin" />}
                      Submit answers
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
