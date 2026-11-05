import { Button, type PublishCost, type PublishCostInput } from "hyrr.shared"
import { Coins, Loader2, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { errorMessage, formatCredits } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"

/** Debounced publish-cost preview. Only queries while `enabled`. */
export function usePublishCost(input: PublishCostInput, enabled: boolean, delay = 400) {
  const getPublishCost = useJobStore((s) => s.getPublishCost)
  const [quote, setQuote] = useState<PublishCost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const { remote, salaryMax, salaryCurrency, salaryPeriod, categoryId } = input

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const result = await getPublishCost({
          remote,
          salaryMax,
          salaryCurrency,
          salaryPeriod,
          categoryId,
        })
        if (!cancelled) {
          setQuote(result)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Could not calculate the publishing cost."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, delay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    enabled,
    remote,
    salaryMax,
    salaryCurrency,
    salaryPeriod,
    categoryId,
    delay,
    getPublishCost,
    nonce,
  ])

  return { quote, loading, error, retry: () => setNonce((n) => n + 1) }
}

/** "Publishing costs N credits · balance B" line shown next to publish actions. */
export function PublishCostNote({
  quote,
  loading,
  error,
  onRetry,
}: {
  quote: PublishCost | null
  loading: boolean
  error: string | null
  onRetry?: () => void
}) {
  if (error && !quote) {
    return (
      <p role="alert" className="text-[12px] text-sec-red flex items-center gap-2">
        {error}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold text-primary hover:underline cursor-pointer"
          >
            Retry
          </button>
        )}
      </p>
    )
  }
  if (!quote) {
    return loading ? (
      <p className="text-[12px] text-txt-caption flex items-center gap-1.5" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        Calculating publishing cost…
      </p>
    ) : null
  }
  const short = quote.balance < quote.cost
  const factors = quote.breakdown.multipliers.filter((m) => m.factor !== 1)
  return (
    <p
      aria-live="polite"
      className={`text-[12.5px] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${
        short ? "text-sec-orange" : "text-txt-body"
      }`}
    >
      <Zap className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
      <span>
        Publishing costs <strong className="text-txt-heading">{formatCredits(quote.cost)}</strong>
      </span>
      <span className="text-txt-caption">· balance {quote.balance.toLocaleString()}</span>
      {factors.length > 0 && (
        <span className="text-txt-caption">
          ({factors.map((m) => `${m.name} ×${m.factor}`).join(", ")})
        </span>
      )}
      {loading && <Loader2 className="w-3 h-3 animate-spin text-txt-caption" aria-hidden="true" />}
    </p>
  )
}

interface InsufficientCreditsNoticeProps {
  required: number
  balance: number
  /** Called before navigating to Momentum (e.g. to close the dialog). */
  onBuy?: () => void
  onSaveDraft?: () => void
  savingDraft?: boolean
  className?: string
}

/** Inline 402 INSUFFICIENT_CREDITS panel with a path to buy credits. */
export function InsufficientCreditsNotice({
  required,
  balance,
  onBuy,
  onSaveDraft,
  savingDraft = false,
  className = "mt-4",
}: InsufficientCreditsNoticeProps) {
  const setActiveView = useJobStore((s) => s.setActiveView)
  return (
    <div
      role="alert"
      className={`${className} rounded-xl border border-sec-orange/30 bg-sec-orange/5 p-4 text-[13px] text-txt-body`}
    >
      <p className="flex items-center gap-2 font-semibold text-sec-orange">
        <Coins className="w-4 h-4 shrink-0" aria-hidden="true" />
        Not enough Momentum credits
      </p>
      <p className="mt-1 text-txt-caption">
        This needs {formatCredits(required)}; your balance is {balance.toLocaleString()}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onBuy?.()
            setActiveView("Momentum")
          }}
          className="gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" aria-hidden="true" />
          Buy credits
        </Button>
        {onSaveDraft && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onSaveDraft}
            disabled={savingDraft}
            className="gap-1.5"
          >
            {savingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save as draft
          </Button>
        )}
      </div>
    </div>
  )
}
