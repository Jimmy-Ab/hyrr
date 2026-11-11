import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  creditSuffix,
  errorMessage,
  useJobStore,
  useToast,
  type CvTailoring,
} from "hyrr.shared"
import { Check, Copy, Loader2, RefreshCw, Wand2 } from "lucide-react"
import { useEffect, useState } from "react"
import { AI_UNAVAILABLE_MESSAGE, useAiAvailable } from "../lib/ai-availability"
import { AiUnavailableNote } from "./ai-unavailable"

function ScoreRing({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "var(--color-sec-green)"
      : score >= 50
        ? "var(--color-sec-orange)"
        : "var(--color-sec-red)"
  return (
    <div
      role="img"
      aria-label={`Match score ${score} out of 100`}
      className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${tone} ${score * 3.6}deg, var(--color-bg-border) 0)` }}
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-bg-secondary text-[20px] font-extrabold text-txt-heading">
        {score}
      </span>
    </div>
  )
}

/** "Tailor my CV" for one Hyrr job: ATS match, missing keywords, gaps and rewritten bullets. */
export function CvTailorButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const fetchCvTailoring = useJobStore((s) => s.fetchCvTailoring)
  const tailorCv = useJobStore((s) => s.tailorCv)
  const cost = useJobStore((s) => s.pricing?.resumeTailorCost)
  const aiOn = useAiAvailable()
  const { toast } = useToast()
  const [saved, setSaved] = useState<CvTailoring | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  useEffect(() => {
    setSaved(null)
    void fetchCvTailoring(jobId)
      .then(setSaved)
      .catch(() => undefined)
  }, [jobId, fetchCvTailoring])

  const run = async (rerun = false) => {
    setBusy(true)
    setError(null)
    setOpen(true)
    try {
      const res = await tailorCv(jobId, rerun)
      setSaved(res)
      if (res.charged) toast("CV analysed", `${res.charged} credits used.`, "success")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(i)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // clipboard blocked: the text stays selectable
    }
  }

  const r = saved?.result
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => (saved ? setOpen(true) : run())}
        disabled={!saved && !aiOn}
        title={!saved && !aiOn ? AI_UNAVAILABLE_MESSAGE : undefined}
        className="h-11 gap-1.5 px-4 cursor-pointer"
      >
        <Wand2 className="h-4 w-4" />
        {saved ? `CV match ${saved.result.matchScore}%` : `Tailor my CV${creditSuffix(cost)}`}
      </Button>
      {/* Rendered inside the job's action row (flex-wrap): takes its own line. */}
      {!saved && !aiOn && (
        <div className="basis-full">
          <AiUnavailableNote />
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent variant="sheet" className="max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tailor your CV</DialogTitle>
            <DialogDescription>{jobTitle}</DialogDescription>
          </DialogHeader>
          {busy ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[13px] text-txt-caption">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Comparing your CV with the job…
            </div>
          ) : error ? (
            <p role="alert" className="mt-6 text-[13px] text-sec-red">
              {error}
            </p>
          ) : (
            r && (
              <div className="mt-5 space-y-5 text-[13.5px]">
                <div className="flex items-center gap-4">
                  <ScoreRing score={r.matchScore} />
                  <p className="text-txt-body">{r.summary}</p>
                </div>
                {!saved?.cvUsed && (
                  <p className="rounded-xl bg-bg-hover/60 p-3 text-[12.5px] text-txt-body">
                    Based on your profile only. Upload your CV in Documents for a sharper analysis.
                  </p>
                )}
                {r.missingKeywords.length > 0 && (
                  <section>
                    <p className="mb-2 font-semibold text-txt-heading">Missing keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.missingKeywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-sec-orange/10 px-2.5 py-1 text-[12px] font-semibold text-sec-orange"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
                {r.strengths.length > 0 && (
                  <section>
                    <p className="mb-1 font-semibold text-txt-heading">Strengths</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-txt-body">
                      {r.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {r.skillGaps.length > 0 && (
                  <section>
                    <p className="mb-1 font-semibold text-txt-heading">Gaps to address</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-txt-body">
                      {r.skillGaps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {r.bulletSuggestions.length > 0 && (
                  <section>
                    <p className="mb-2 font-semibold text-txt-heading">Stronger CV bullets</p>
                    <ul className="space-y-2">
                      {r.bulletSuggestions.map((b, i) => (
                        <li key={i} className="rounded-xl border border-bg-border p-3">
                          {b.original && (
                            <p className="mb-1 text-[12.5px] text-txt-caption line-through">
                              {b.original}
                            </p>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-txt-heading">{b.improved}</p>
                            <button
                              type="button"
                              onClick={() => copy(b.improved, i)}
                              aria-label="Copy this bullet"
                              className="shrink-0 rounded-full p-1.5 text-txt-caption hover:bg-bg-hover hover:text-primary cursor-pointer"
                            >
                              {copied === i ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-bg-border/50 pt-4">
                  {aiOn ? (
                    <span className="text-[12px] text-txt-caption">
                      Updated your CV? Run it again to see the new score.
                    </span>
                  ) : (
                    <AiUnavailableNote />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(true)}
                    disabled={!aiOn}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Re-run{creditSuffix(cost)}
                  </Button>
                </div>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
