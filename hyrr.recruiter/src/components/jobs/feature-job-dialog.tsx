import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  insufficientCreditsDetails,
  Skeleton,
  useToast,
  type Job,
} from "hyrr.shared"
import { Loader2, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { errorMessage, formatCredits, formatDate, isFeaturedNow } from "../../lib/recruiter"
import { useJobStore } from "../../store/useJobStore"
import { InsufficientCreditsNotice } from "../billing/momentum-cost"

const DAY_OPTIONS = [7, 14, 30] as const

interface FeatureJobDialogProps {
  job: Job | null
  onOpenChange: (open: boolean) => void
}

/** Buys (or extends) a featured window for an active job. */
export function FeatureJobDialog({ job, onOpenChange }: FeatureJobDialogProps) {
  const { pricing, wallet, fetchBillingCatalog, featureJob } = useJobStore()
  const { toast } = useToast()
  const [days, setDays] = useState<number>(14)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creditError, setCreditError] = useState<{ required: number; balance: number } | null>(null)

  const load = async () => {
    setLoadError(null)
    try {
      await fetchBillingCatalog()
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load Momentum pricing."))
    }
  }

  useEffect(() => {
    if (!job) return
    setCreditError(null)
    const preset = pricing?.featureDays
    setDays(preset === 7 || preset === 30 ? preset : 14)
    if (!pricing) void load()
  }, [job?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const costFor = (d: number) =>
    pricing
      ? Math.max(1, Math.round((pricing.featureCost * d) / (pricing.featureDays || 14)))
      : null
  const cost = costFor(days)
  const extending = !!job && isFeaturedNow(job)

  const submit = async () => {
    if (!job) return
    setBusy(true)
    setCreditError(null)
    try {
      const result = await featureJob(job.id, days)
      toast(
        extending ? "Feature extended" : "Job featured",
        `"${job.title}" is featured until ${formatDate(result.featuredUntil)}.`,
        "success"
      )
      onOpenChange(false)
    } catch (err) {
      const credits = insufficientCreditsDetails(err)
      if (credits) setCreditError(credits)
      else toast("Could not feature job", errorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!job} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{extending ? "Extend featured listing" : "Feature this job"}</DialogTitle>
          <DialogDescription>
            Featured jobs appear first in job search for candidates.
            {extending && job?.featuredUntil && (
              <> Currently featured until {formatDate(job.featuredUntil)}; days are added on top.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {loadError && !pricing ? (
          <div role="alert" className="mt-4 flex flex-col items-start gap-2 text-[13px]">
            <p className="text-sec-red">{loadError}</p>
            <Button size="sm" variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        ) : !pricing ? (
          <div className="mt-4 grid grid-cols-3 gap-2" aria-busy="true">
            {DAY_OPTIONS.map((d) => (
              <Skeleton key={d} className="h-[72px] rounded-xl" />
            ))}
          </div>
        ) : (
          <fieldset className="mt-4">
            <legend className="sr-only">Duration</legend>
            <div className="grid grid-cols-3 gap-2">
              {DAY_OPTIONS.map((d) => {
                const selected = d === days
                return (
                  <label
                    key={d}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary/30 ${
                      selected
                        ? "border-primary bg-primary-light"
                        : "border-bg-border hover:bg-bg-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="feature-days"
                      value={d}
                      checked={selected}
                      onChange={() => setDays(d)}
                      className="sr-only"
                    />
                    <span className="text-[15px] font-semibold text-txt-heading">{d} days</span>
                    <span className="text-[12px] text-txt-caption">
                      {formatCredits(costFor(d) ?? 0)}
                    </span>
                  </label>
                )
              })}
            </div>
            {wallet && (
              <p className="mt-3 text-[12.5px] text-txt-caption">
                Balance: {wallet.balance.toLocaleString()} credits
              </p>
            )}
          </fieldset>
        )}

        {creditError && (
          <InsufficientCreditsNotice
            required={creditError.required}
            balance={creditError.balance}
            onBuy={() => onOpenChange(false)}
          />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || cost == null} className="gap-1.5">
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Star className="w-4 h-4" aria-hidden="true" />
            )}
            {extending ? "Extend" : "Feature"}
            {cost != null && ` · ${cost} credits`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
