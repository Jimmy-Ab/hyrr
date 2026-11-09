import {
  Button,
  FieldError,
  TonePill,
  errorMessage,
  fieldErrorsOf,
  scorecardSchema,
  useJobStore,
  useToast,
  validate,
  type FieldErrors,
  type Scorecard,
  type ScorecardRecommendation,
  type ScorecardView,
  type Tone,
} from "hyrr.shared"
import { Loader2, Lock, Star } from "lucide-react"
import { useCallback, useEffect, useState, type FormEvent } from "react"

const RECOMMENDATIONS: { value: ScorecardRecommendation; label: string; tone: Tone }[] = [
  { value: "STRONG_YES", label: "Strong yes", tone: "emerald" },
  { value: "YES", label: "Yes", tone: "teal" },
  { value: "NEUTRAL", label: "Neutral", tone: "slate" },
  { value: "NO", label: "No", tone: "amber" },
  { value: "STRONG_NO", label: "Strong no", tone: "rose" },
]
const recommendation = (v: string) =>
  RECOMMENDATIONS.find((r) => r.value === v) ?? RECOMMENDATIONS[2]
const CONSENSUS: Record<string, { label: string; tone: Tone }> = {
  HIRE: { label: "Team leans hire", tone: "emerald" },
  NO_HIRE: { label: "Team leans no hire", tone: "rose" },
  MIXED: { label: "Mixed opinions", tone: "amber" },
}

function Stars({
  value,
  onChange,
  label,
}: {
  value: number
  onChange?: (v: number) => void
  label: string
}) {
  return (
    <div role={onChange ? "radiogroup" : undefined} aria-label={label} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            onClick={() => onChange(n)}
            className="p-0.5 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Star
              className={`h-5 w-5 ${n <= value ? "fill-sec-orange text-sec-orange" : "text-txt-disabled"}`}
            />
          </button>
        ) : (
          <Star
            key={n}
            aria-hidden="true"
            className={`h-4 w-4 ${n <= value ? "fill-sec-orange text-sec-orange" : "text-txt-disabled"}`}
          />
        )
      )}
    </div>
  )
}

function ScorecardCard({ card, title }: { card: Scorecard; title: string }) {
  const rec = recommendation(card.recommendation)
  return (
    <article className="rounded-xl border border-bg-border p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-txt-heading">{title}</p>
        <TonePill tone={rec.tone}>{rec.label}</TonePill>
      </div>
      <ul className="mt-2 space-y-1">
        {card.ratings.map((r) => (
          <li key={r.competency} className="flex items-center justify-between gap-2">
            <span className="text-txt-body">{r.competency}</span>
            <Stars value={r.score} label={`${r.competency}: ${r.score} of 5`} />
          </li>
        ))}
      </ul>
      <p className="mt-2 whitespace-pre-line text-txt-body">{card.overallNotes}</p>
    </article>
  )
}

/** Structured, blind interview feedback for one application (hiring team only). */
export function ScorecardsPanel({ applicationId }: { applicationId: string }) {
  const fetchScorecards = useJobStore((s) => s.fetchScorecards)
  const submitScorecard = useJobStore((s) => s.submitScorecard)
  const liveEvent = useJobStore((s) => s.liveEvent)
  const { toast } = useToast()
  const [view, setView] = useState<ScorecardView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [rec, setRec] = useState<ScorecardRecommendation | "">("")
  const [notes, setNotes] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const v = await fetchScorecards(applicationId)
      setView(v)
      if (v.mine) {
        setScores(Object.fromEntries(v.mine.ratings.map((r) => [r.competency, r.score])))
        setRec(v.mine.recommendation)
        setNotes(v.mine.overallNotes)
      }
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load scorecards."))
    }
  }, [applicationId, fetchScorecards])

  useEffect(() => {
    void load()
  }, [load])
  // A colleague submitted: refresh counts (content stays hidden until you submit).
  useEffect(() => {
    if (liveEvent?.kind === "scorecard" && liveEvent.applicationId === applicationId) void load()
  }, [liveEvent, applicationId, load])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!view) return
    const input = {
      recommendation: rec as ScorecardRecommendation,
      overallNotes: notes,
      ratings: view.competencies.map((competency) => ({
        competency,
        score: scores[competency] ?? 0,
      })),
    }
    const found = validate(scorecardSchema, input)
    view.competencies.forEach((c, i) => {
      if (found[`ratings.${i}.score`]) found[`score.${c}`] = found[`ratings.${i}.score`]
    })
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      setView(await submitScorecard(applicationId, input))
      setEditing(false)
      toast("Scorecard submitted", "You can now see your colleagues' feedback.", "success")
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast("Could not submit", errorMessage(err), "error")
    } finally {
      setSaving(false)
    }
  }

  if (loadError)
    return (
      <div role="alert" className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-[13px] text-sec-red">{loadError}</p>
        <Button size="sm" variant="secondary" onClick={load}>
          Retry
        </Button>
      </div>
    )
  if (!view)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    )

  const showForm = view.canSubmit && (!view.mine || editing)
  return (
    <div className="space-y-5">
      {view.debrief && view.submittedCount > 0 && (
        <section aria-label="Team debrief" className="rounded-xl bg-bg-hover/50 p-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-txt-heading">
              Debrief · {view.submittedCount} scorecard{view.submittedCount === 1 ? "" : "s"}
              {view.debrief.overallAverage != null && ` · ${view.debrief.overallAverage}/5 average`}
            </p>
            {view.debrief.consensus && (
              <TonePill tone={CONSENSUS[view.debrief.consensus].tone}>
                {CONSENSUS[view.debrief.consensus].label}
              </TonePill>
            )}
          </div>
          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
            {view.debrief.perCompetency.map((c) => (
              <li key={c.competency} className="flex justify-between gap-2">
                <span className="text-txt-body">{c.competency}</span>
                <span className="font-semibold tabular-nums text-txt-heading">
                  {c.average ?? "–"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.locked && (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-bg-border p-3 text-[13px] text-txt-body">
          <Lock className="h-4 w-4 shrink-0 text-txt-caption" />
          {view.submittedCount
            ? `${view.submittedCount} colleague${view.submittedCount === 1 ? " has" : "s have"} submitted. Their feedback unlocks when you submit yours, so nobody anchors on anyone else.`
            : "No scorecards yet. Feedback stays private until each interviewer submits their own."}
        </p>
      )}

      {showForm ? (
        <form onSubmit={submit} noValidate className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-semibold text-txt-heading">
              Rate each criterion
            </legend>
            {view.competencies.map((c) => (
              <div key={c}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-txt-body">{c}</span>
                  <Stars
                    value={scores[c] ?? 0}
                    label={c}
                    onChange={(v) => {
                      setScores((s) => ({ ...s, [c]: v }))
                      setErrors((e) => ({ ...e, [`score.${c}`]: "" }))
                    }}
                  />
                </div>
                <FieldError id={`score-${c}-error`} message={errors[`score.${c}`] || undefined} />
              </div>
            ))}
          </fieldset>
          <fieldset>
            <legend className="text-[13px] font-semibold text-txt-heading">Recommendation</legend>
            <div role="radiogroup" className="mt-2 flex flex-wrap gap-1.5">
              {RECOMMENDATIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={rec === r.value}
                  onClick={() => {
                    setRec(r.value)
                    setErrors((e) => ({ ...e, recommendation: "" }))
                  }}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold cursor-pointer transition-colors ${
                    rec === r.value
                      ? "border-primary bg-primary text-white"
                      : "border-bg-border text-txt-body hover:border-primary/40"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <FieldError id="scorecard-rec-error" message={errors.recommendation || undefined} />
          </fieldset>
          <div>
            <label htmlFor="scorecard-notes" className="text-[13px] font-semibold text-txt-heading">
              Overall feedback
            </label>
            <textarea
              id="scorecard-notes"
              rows={4}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setErrors((x) => ({ ...x, overallNotes: "" }))
              }}
              placeholder="Strengths, concerns, and what you'd probe next."
              aria-invalid={!!errors.overallNotes || undefined}
              className="mt-1 w-full rounded-input border border-bg-border bg-bg-secondary px-3 py-2 text-[13px] text-txt-heading"
            />
            <FieldError id="scorecard-notes-error" message={errors.overallNotes || undefined} />
          </div>
          <div className="flex justify-end gap-2">
            {view.mine && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {view.mine ? "Update scorecard" : "Submit scorecard"}
            </Button>
          </div>
        </form>
      ) : (
        view.mine && (
          <div className="space-y-2">
            <ScorecardCard card={view.mine} title="Your scorecard" />
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit my scorecard
            </Button>
          </div>
        )
      )}

      {!view.canSubmit && !view.mine && (
        <p className="text-[12.5px] text-txt-caption">Viewers can't submit scorecards.</p>
      )}

      {view.others.length > 0 && (
        <section className="space-y-2" aria-label="Colleagues' scorecards">
          <p className="text-[13px] font-semibold text-txt-heading">Colleagues</p>
          {view.others.map((c) => (
            <ScorecardCard key={c.id} card={c} title={c.interviewer.name} />
          ))}
        </section>
      )}
    </div>
  )
}
