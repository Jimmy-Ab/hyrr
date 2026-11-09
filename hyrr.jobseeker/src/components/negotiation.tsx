import {
  Button,
  errorMessage,
  useJobStore,
  type NegotiationAdvice,
  type Offer,
  type SalaryBenchmark,
} from "hyrr.shared"
import { Check, Copy, Loader2, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"

const money = (n: number, currency: string) =>
  new Intl.NumberFormat([], { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
const YEARLY = { YEAR: 1, MONTH: 12, HOUR: 2080 } as const

/** Offer sheet add-on: free market check from real postings + paid AI negotiation advice. */
export function OfferNegotiation({ offer }: { offer: Offer }) {
  const fetchSalaryBenchmark = useJobStore((s) => s.fetchSalaryBenchmark)
  const getNegotiationAdvice = useJobStore((s) => s.getNegotiationAdvice)
  const cost = useJobStore((s) => s.pricing?.negotiationAdviceCost ?? 1)
  const [bench, setBench] = useState<SalaryBenchmark | null>(null)
  const [advice, setAdvice] = useState<NegotiationAdvice["advice"] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void fetchSalaryBenchmark(offer.jobTitle, offer.salaryCurrency)
      .then(setBench)
      .catch(() => undefined)
  }, [offer.jobTitle, offer.salaryCurrency, fetchSalaryBenchmark])

  const yearlyOffer = offer.baseSalary * YEARLY[offer.salaryPeriod]
  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      setAdvice((await getNegotiationAdvice(offer.id)).advice)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-5 space-y-3 rounded-xl border border-bg-border p-4 text-[13px]">
      <p className="flex items-center gap-2 font-semibold text-txt-heading">
        <TrendingUp className="h-4 w-4 text-primary" /> Market check
      </p>
      {!bench ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : bench.enoughData ? (
        <p className="text-txt-body">
          {bench.samples} postings for similar roles in {bench.currency}: middle 50% earn{" "}
          <strong>
            {money(bench.p25!, bench.currency)} – {money(bench.p75!, bench.currency)}
          </strong>{" "}
          a year (median {money(bench.p50!, bench.currency)}). This offer is about{" "}
          <strong>{money(yearlyOffer, offer.salaryCurrency)}</strong> a year.
        </p>
      ) : (
        <p className="text-txt-caption">
          Not enough postings in {bench.currency} for this role yet ({bench.samples}), so there's no
          market range to compare. We don't guess.
        </p>
      )}

      {advice ? (
        <div className="space-y-2 border-t border-bg-border/50 pt-3">
          <p className="text-txt-body">{advice.assessment}</p>
          <p className="text-txt-heading">
            Suggested ask:{" "}
            <strong>{money(advice.counterOffer.baseSalary, offer.salaryCurrency)}</strong>{" "}
            <span className="text-txt-caption">per {offer.salaryPeriod.toLowerCase()}</span>
          </p>
          <p className="text-txt-caption">{advice.counterOffer.rationale}</p>
          {advice.talkingPoints.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-txt-body">
              {advice.talkingPoints.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div className="rounded-xl bg-bg-hover/60 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-txt-heading">E-mail draft</span>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(advice.emailDraft)
                    .then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    })
                    .catch(() => undefined)
                }
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="whitespace-pre-line text-txt-body">{advice.emailDraft}</p>
          </div>
        </div>
      ) : (
        offer.status === "SENT" && (
          <Button size="sm" variant="secondary" onClick={ask} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Negotiation advice · {cost} credit{cost === 1 ? "" : "s"}
          </Button>
        )
      )}
      {error && (
        <p role="alert" className="text-sec-red">
          {error}
        </p>
      )}
    </section>
  )
}
