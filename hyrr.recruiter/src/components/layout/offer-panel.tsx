import {
  Button,
  CURRENCIES,
  FieldError,
  Input,
  TonePill,
  errorMessage,
  fieldErrorsOf,
  offerSchema,
  useJobStore,
  useToast,
  validate,
  type Candidate,
  type FieldErrors,
  type Offer,
  type Tone,
} from "hyrr.shared"
import { BadgeCheck, Loader2, Send } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

const STATUS: Record<Offer["status"], { label: string; tone: Tone }> = {
  SENT: { label: "Waiting for answer", tone: "amber" },
  ACCEPTED: { label: "Accepted", tone: "emerald" },
  DECLINED: { label: "Declined", tone: "rose" },
  WITHDRAWN: { label: "Withdrawn", tone: "slate" },
  EXPIRED: { label: "Expired", tone: "slate" },
}
const PERIOD = { YEAR: "year", MONTH: "month", HOUR: "hour" } as const

export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat([], { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount
  )
const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

function OfferSummary({ offer, onWithdraw }: { offer: Offer; onWithdraw: () => void }) {
  const s = STATUS[offer.status]
  return (
    <div className="rounded-xl border border-bg-border p-3 text-[13px] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-txt-heading">{offer.jobTitle}</p>
        <TonePill tone={s.tone}>{s.label}</TonePill>
      </div>
      <p className="text-txt-body">
        {formatMoney(offer.baseSalary, offer.salaryCurrency)} / {PERIOD[offer.salaryPeriod]}
        {offer.bonusAmount
          ? ` · bonus ${formatMoney(offer.bonusAmount, offer.salaryCurrency)}`
          : ""}
        {offer.equityPercentage ? ` · ${offer.equityPercentage}% equity` : ""}
      </p>
      <p className="text-txt-caption">
        Starts {dateOnly(offer.startDate)} · answer by {dateOnly(offer.expiresAt)}
      </p>
      {offer.status === "ACCEPTED" && offer.signedAt && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-txt-body">
          <BadgeCheck className="h-4 w-4 text-sec-green" />
          Signed by "{offer.signatureName}" on {new Date(offer.signedAt).toLocaleString()}
        </p>
      )}
      {offer.status === "DECLINED" && offer.declineReason && (
        <p className="text-[12.5px] text-txt-body">Reason: {offer.declineReason}</p>
      )}
      {offer.status === "SENT" && (
        <Button size="sm" variant="ghost" className="text-sec-red" onClick={onWithdraw}>
          Withdraw offer
        </Button>
      )}
    </div>
  )
}

/** Send a formal offer; the candidate accepts in the Careers app with a typed signature. */
export function OfferPanel({ candidate, jobTitle }: { candidate: Candidate; jobTitle: string }) {
  const offers = useJobStore((s) => s.offers)
  const fetchOffers = useJobStore((s) => s.fetchOffers)
  const sendOffer = useJobStore((s) => s.sendOffer)
  const withdrawOffer = useJobStore((s) => s.withdrawOffer)
  const { toast } = useToast()
  const hasAccount = candidate.source === "DIRECT"
  const mine = offers
    .filter((o) => o.applicationId === candidate.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const latest = mine[0]

  const [open, setOpen] = useState(false)
  const [baseSalary, setBaseSalary] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [period, setPeriod] = useState<"YEAR" | "MONTH" | "HOUR">("YEAR")
  const [bonus, setBonus] = useState("")
  const [equity, setEquity] = useState("")
  const [startDate, setStartDate] = useState(inDays(30))
  const [expiresAt, setExpiresAt] = useState(inDays(7))
  const [benefits, setBenefits] = useState("")
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)

  useEffect(() => {
    void fetchOffers(candidate.id).catch(() => undefined)
  }, [candidate.id, fetchOffers])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v))
    const body = {
      baseSalary: num(baseSalary) as number,
      salaryCurrency: currency,
      salaryPeriod: period,
      bonusAmount: num(bonus),
      equityPercentage: num(equity),
      // End of the chosen day, local time.
      startDate: new Date(`${startDate}T09:00`).toISOString(),
      expiresAt: new Date(`${expiresAt}T23:59`).toISOString(),
      benefits: benefits
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
      message: message.trim() || undefined,
    }
    const found = validate(offerSchema, body as any)
    setErrors(found)
    if (Object.keys(found).length) return
    setSending(true)
    try {
      await sendOffer({ applicationId: candidate.id, jobTitle, ...body })
      toast("Offer sent", `${candidate.name} can review and accept it in the Hyrr app.`, "success")
      setOpen(false)
    } catch (err) {
      setErrors(fieldErrorsOf(err))
      toast("Could not send the offer", errorMessage(err), "error")
    } finally {
      setSending(false)
    }
  }

  const withdraw = async (id: string) => {
    try {
      await withdrawOffer(id)
      toast("Offer withdrawn", undefined, "success")
    } catch (err) {
      toast("Could not withdraw", errorMessage(err), "error")
    }
  }

  const field = "text-[12.5px] font-medium text-txt-heading"
  const select =
    "h-11 w-full rounded-input border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-heading"

  return (
    <div className="space-y-4">
      {latest && !open && <OfferSummary offer={latest} onWithdraw={() => withdraw(latest.id)} />}
      {!hasAccount && (
        <p className="text-[12.5px] text-txt-caption">
          This candidate has no Hyrr account, so send the offer by e-mail instead.
        </p>
      )}
      {hasAccount && !open && latest?.status !== "ACCEPTED" && (
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Send className="h-4 w-4" />{" "}
          {latest?.status === "SENT" ? "Send a revised offer" : "Make an offer"}
        </Button>
      )}

      {open && (
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <div>
              <label htmlFor="offer-base" className={field}>
                Base salary
              </label>
              <Input
                id="offer-base"
                inputMode="numeric"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value.replace(/[^\d]/g, ""))}
                aria-invalid={!!errors.baseSalary || undefined}
              />
              <FieldError id="offer-base-error" message={errors.baseSalary} />
            </div>
            <div>
              <label htmlFor="offer-currency" className={field}>
                Currency
              </label>
              <select
                id="offer-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={select}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="offer-period" className={field}>
                Per
              </label>
              <select
                id="offer-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as "YEAR" | "MONTH" | "HOUR")}
                className={select}
              >
                <option value="YEAR">Year</option>
                <option value="MONTH">Month</option>
                <option value="HOUR">Hour</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="offer-bonus" className={field}>
                Bonus <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <Input
                id="offer-bonus"
                inputMode="numeric"
                value={bonus}
                onChange={(e) => setBonus(e.target.value.replace(/[^\d]/g, ""))}
              />
              <FieldError id="offer-bonus-error" message={errors.bonusAmount} />
            </div>
            <div>
              <label htmlFor="offer-equity" className={field}>
                Equity % <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <Input
                id="offer-equity"
                inputMode="decimal"
                value={equity}
                onChange={(e) => setEquity(e.target.value.replace(/[^\d.]/g, ""))}
              />
              <FieldError id="offer-equity-error" message={errors.equityPercentage} />
            </div>
            <div>
              <label htmlFor="offer-start" className={field}>
                Start date
              </label>
              <Input
                id="offer-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <FieldError id="offer-start-error" message={errors.startDate} />
            </div>
            <div>
              <label htmlFor="offer-expires" className={field}>
                Answer by
              </label>
              <Input
                id="offer-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                aria-invalid={!!errors.expiresAt || undefined}
              />
              <FieldError id="offer-expires-error" message={errors.expiresAt} />
            </div>
          </div>
          <div>
            <label htmlFor="offer-benefits" className={field}>
              Benefits <span className="font-normal text-txt-caption">(comma-separated)</span>
            </label>
            <Input
              id="offer-benefits"
              placeholder="Health insurance, 30 days leave, Remote budget"
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="offer-message" className={field}>
              Message <span className="font-normal text-txt-caption">(optional)</span>
            </label>
            <textarea
              id="offer-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-input border border-bg-border bg-bg-secondary px-3 py-2 text-[13px] text-txt-heading"
            />
          </div>
          <p className="text-[12px] text-txt-caption">
            The candidate accepts by typing their name; Hyrr records the time and IP address. This
            is an in-app acceptance, not a qualified e-signature.
          </p>
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
              Send offer
            </Button>
          </div>
        </form>
      )}

      {mine.length > 1 && (
        <details className="text-[12.5px] text-txt-caption">
          <summary className="cursor-pointer">Earlier offers ({mine.length - 1})</summary>
          <ul className="mt-2 space-y-1">
            {mine.slice(1).map((o) => (
              <li key={o.id}>
                {formatMoney(o.baseSalary, o.salaryCurrency)} / {PERIOD[o.salaryPeriod]} ·{" "}
                {STATUS[o.status].label} · {dateOnly(o.createdAt)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
