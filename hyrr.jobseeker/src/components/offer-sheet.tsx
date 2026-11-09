import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FieldError,
  Input,
  acceptOfferSchema,
  errorMessage,
  useJobStore,
  useToast,
  validate,
  type FieldErrors,
} from "hyrr.shared"
import { BadgeCheck, CalendarDays, Gift, Loader2, Wallet } from "lucide-react"
import { useEffect, useState } from "react"
import { OfferNegotiation } from "./negotiation"

const OPEN_EVENT = "hyrr:review-offer"
export const openOfferSheet = (offerId: string) =>
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: offerId }))

const PERIOD = { YEAR: "per year", MONTH: "per month", HOUR: "per hour" } as const
const money = (n: number, currency: string) =>
  new Intl.NumberFormat([], { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
const date = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

/** Offer review with typed-name acceptance. Opens by itself when an offer arrives. Mounted in App. */
export function OfferSheet() {
  const offers = useJobStore((s) => s.offers)
  const liveEvent = useJobStore((s) => s.liveEvent)
  const user = useJobStore((s) => s.user)
  const acceptOffer = useJobStore((s) => s.acceptOffer)
  const declineOffer = useJobStore((s) => s.declineOffer)
  const { toast } = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [signature, setSignature] = useState("")
  const [agree, setAgree] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)

  useEffect(() => {
    const onOpen = (e: Event) => setOpenId((e as CustomEvent<string>).detail)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])
  useEffect(() => {
    if (liveEvent?.kind === "offer") setOpenId(liveEvent.id)
  }, [liveEvent])
  useEffect(() => {
    setSignature("")
    setAgree(false)
    setDeclining(false)
    setReason("")
    setErrors({})
  }, [openId])

  const offer = offers.find((o) => o.id === openId)
  const close = () => setOpenId(null)

  const accept = async () => {
    if (!offer) return
    const found = validate(acceptOfferSchema, { signatureName: signature, agree })
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy("accept")
    try {
      await acceptOffer(offer.id, signature.trim())
      toast(
        "Offer accepted 🎉",
        `Congratulations on your new role at ${offer.companyName ?? "the company"}!`,
        "success"
      )
      close()
    } catch (err) {
      setErrors({ signatureName: errorMessage(err) })
    } finally {
      setBusy(null)
    }
  }
  const decline = async () => {
    if (!offer) return
    setBusy("decline")
    try {
      await declineOffer(offer.id, reason.trim() || undefined)
      toast("Offer declined", "The hiring team has been told.", "info")
      close()
    } catch (err) {
      toast("Could not decline", errorMessage(err), "error")
    } finally {
      setBusy(null)
    }
  }

  const open = offer?.status === "SENT"
  return (
    <Dialog open={!!offer} onOpenChange={(o) => !o && close()}>
      <DialogContent variant="sheet" className="max-w-lg overflow-y-auto">
        {offer && (
          <>
            <DialogHeader>
              <DialogTitle>
                {offer.status === "ACCEPTED"
                  ? "Offer accepted"
                  : `Offer from ${offer.companyName ?? "the hiring team"}`}
              </DialogTitle>
              <DialogDescription>{offer.jobTitle}</DialogDescription>
            </DialogHeader>

            <dl className="mt-5 grid grid-cols-1 gap-3 text-[13.5px]">
              <div className="flex items-start gap-3 rounded-xl bg-bg-hover/50 p-3">
                <Wallet className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <dt className="text-txt-caption">Base salary</dt>
                  <dd className="text-[18px] font-bold text-txt-heading">
                    {money(offer.baseSalary, offer.salaryCurrency)}{" "}
                    <span className="text-[13px] font-medium text-txt-caption">
                      {PERIOD[offer.salaryPeriod]}
                    </span>
                  </dd>
                  {(offer.bonusAmount || offer.equityPercentage) && (
                    <dd className="text-txt-body">
                      {offer.bonusAmount
                        ? `Bonus ${money(offer.bonusAmount, offer.salaryCurrency)}`
                        : ""}
                      {offer.bonusAmount && offer.equityPercentage ? " · " : ""}
                      {offer.equityPercentage ? `${offer.equityPercentage}% equity` : ""}
                    </dd>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 px-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-txt-caption" />
                <div>
                  <dt className="text-txt-caption">Start date</dt>
                  <dd className="font-semibold text-txt-heading">{date(offer.startDate)}</dd>
                  {open && (
                    <dd className="text-txt-caption">Please answer by {date(offer.expiresAt)}</dd>
                  )}
                </div>
              </div>
              {offer.benefits.length > 0 && (
                <div className="flex items-start gap-3 px-3">
                  <Gift className="mt-0.5 h-4 w-4 text-txt-caption" />
                  <div>
                    <dt className="text-txt-caption">Benefits</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {offer.benefits.map((b) => (
                        <span
                          key={b}
                          className="rounded-full bg-bg-hover px-2.5 py-1 text-[12px] text-txt-body"
                        >
                          {b}
                        </span>
                      ))}
                    </dd>
                  </div>
                </div>
              )}
              {offer.message && (
                <p className="whitespace-pre-line rounded-xl border border-bg-border p-3 text-txt-body">
                  {offer.message}
                </p>
              )}
            </dl>

            <OfferNegotiation offer={offer} />

            {offer.status === "ACCEPTED" && (
              <p className="mt-5 flex items-center gap-2 text-[13px] text-txt-body">
                <BadgeCheck className="h-4 w-4 text-sec-green" /> You signed as "
                {offer.signatureName}"
                {offer.signedAt ? ` on ${new Date(offer.signedAt).toLocaleString()}` : ""}.
              </p>
            )}
            {!open && offer.status !== "ACCEPTED" && (
              <p className="mt-5 text-[13px] text-txt-caption">
                This offer is {offer.status.toLowerCase()}.
              </p>
            )}

            {open && !declining && (
              <div className="mt-6 space-y-3 border-t border-bg-border/50 pt-5">
                <div>
                  <label
                    htmlFor="offer-signature"
                    className="text-[13px] font-semibold text-txt-heading"
                  >
                    Sign with your full name
                  </label>
                  <Input
                    id="offer-signature"
                    placeholder={user?.name || "Your full name"}
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    className="mt-1 font-serif text-[16px] italic"
                    aria-invalid={!!errors.signatureName || undefined}
                    aria-describedby={errors.signatureName ? "offer-signature-error" : undefined}
                  />
                  <FieldError id="offer-signature-error" message={errors.signatureName} />
                </div>
                <label className="flex items-start gap-2 text-[13px] text-txt-body cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 accent-[var(--color-primary)]"
                  />
                  <span>
                    I accept these terms. Hyrr records my typed name, the time and my IP address.
                  </span>
                </label>
                <FieldError id="offer-agree-error" message={errors.agree} />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeclining(true)}>
                    Decline
                  </Button>
                  <Button onClick={accept} disabled={!!busy} className="gap-1.5">
                    {busy === "accept" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Accept offer
                  </Button>
                </div>
              </div>
            )}

            {open && declining && (
              <div className="mt-6 space-y-3 border-t border-bg-border/50 pt-5">
                <label
                  htmlFor="offer-decline-reason"
                  className="text-[13px] font-semibold text-txt-heading"
                >
                  Decline the offer{" "}
                  <span className="font-normal text-txt-caption">(reason optional)</span>
                </label>
                <textarea
                  id="offer-decline-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-input border border-bg-border bg-bg-secondary px-3 py-2 text-[13px] text-txt-heading"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeclining(false)}>
                    Back
                  </Button>
                  <Button variant="danger" onClick={decline} disabled={!!busy} className="gap-1.5">
                    {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Decline offer
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
