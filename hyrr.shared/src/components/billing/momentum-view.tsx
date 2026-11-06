import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  History,
  Loader2,
  Receipt,
  RefreshCw,
  Users,
  Zap,
} from "lucide-react"
import * as React from "react"
import { errorMessage } from "../../lib/api"
import {
  CREDIT_TRANSACTION_LABEL,
  type BillingPlan,
  type CheckoutProvider,
  type CreditPackage,
  type PaymentStatus,
  type PlanCode,
} from "../../store/types"
import { useJobStore } from "../../store/useJobStore"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import { EmptyState } from "../ui/empty-state"
import { AnimatedNumber } from "../ui/motion"
import { Skeleton } from "../ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { useToast } from "../ui/toast"

/** "$49.00", "ETB 2,500.00" from minor units. */
export function formatMoney(minor: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100)
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`
  }
}

export function formatCredits(n: number): string {
  return `${n.toLocaleString()} credit${Math.abs(n) === 1 ? "" : "s"}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "medium" })
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Loading / error state for one store action; `run` doubles as Retry. */
function useLoader(fn: () => Promise<void>) {
  const [state, setState] = React.useState<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  })
  const run = React.useCallback(async () => {
    setState({ loading: true, error: null })
    try {
      await fn()
      setState({ loading: false, error: null })
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) })
    }
  }, [fn])
  return { ...state, run }
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertTriangle className="w-6 h-6 text-sec-red" aria-hidden="true" />
      <p className="text-[13px] text-txt-body">{message}</p>
      <Button size="sm" variant="secondary" onClick={onRetry} className="gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Retry
      </Button>
    </div>
  )
}

function SectionTitle({
  id,
  title,
  description,
  action,
}: {
  id: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
      <div>
        <h2 id={id} className="text-[16px] font-semibold text-txt-heading">
          {title}
        </h2>
        {description && <p className="text-[13px] text-txt-caption mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

const PLAN_RANK: Record<PlanCode, number> = { STARTER: 0, PRO: 1, ENTERPRISE: 2 }

const PAYMENT_STATUS: Record<
  PaymentStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" }
> = {
  SUCCEEDED: { label: "Paid", variant: "success" },
  PENDING: { label: "Pending", variant: "warning" },
  FAILED: { label: "Failed", variant: "destructive" },
  REFUNDED: { label: "Refunded", variant: "secondary" },
}

const PROVIDER_LABEL: Record<CheckoutProvider, string> = {
  stripe: "Card (Stripe)",
  chapa: "Chapa (ETB)",
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

// ─── Checkout return (?checkout=success&payment=<id>) ─────────────────────────

function useCheckoutReturn(onSettled: () => void) {
  const confirmPayment = useJobStore((s) => s.confirmPayment)
  const { toast } = useToast()
  const [confirming, setConfirming] = React.useState(false)
  const handled = React.useRef(false)
  const alive = React.useRef(true)

  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  React.useEffect(() => {
    if (handled.current) return
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get("checkout")
    if (!checkout) return
    handled.current = true
    // Strip the provider's query params so a reload doesn't re-run this.
    window.history.replaceState(null, "", window.location.pathname)

    if (checkout === "cancelled") {
      toast("Checkout cancelled", "No payment was taken.", "info")
      return
    }
    const paymentId = params.get("payment")
    if (checkout !== "success" || !paymentId) return

    void (async () => {
      setConfirming(true)
      let lastError: unknown = null
      try {
        // The webhook may lag: poll the provider for up to ~10 s.
        for (let attempt = 0; attempt < 6; attempt++) {
          if (attempt > 0) await sleep(2000)
          if (!alive.current) return
          try {
            const payment = await confirmPayment(paymentId)
            lastError = null
            if (payment.status === "SUCCEEDED") {
              toast(
                "Credits added",
                payment.credits
                  ? `${formatCredits(payment.credits)} were added to your balance.`
                  : "Your payment went through.",
                "success"
              )
              return
            }
            if (payment.status === "FAILED") {
              toast(
                "Payment failed",
                "The payment didn't go through. No credits were added.",
                "error"
              )
              return
            }
          } catch (err) {
            lastError = err
          }
        }
        if (lastError) {
          toast("Couldn't confirm the payment", errorMessage(lastError), "error")
        } else {
          toast(
            "Payment processing",
            "Credits will appear as soon as the provider confirms the payment.",
            "info"
          )
        }
      } finally {
        if (alive.current) {
          setConfirming(false)
          onSettled()
        }
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return confirming
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export type MomentumAudience = "recruiter" | "seeker"

/**
 * Momentum credits page: balance, credit packs (Stripe / Chapa), history and payments. Recruiters
 * also see plans and seats (company wallet); seekers have a personal wallet spent on applications.
 */
export function MomentumView({ audience = "recruiter" }: { audience?: MomentumAudience }) {
  const seeker = audience === "seeker"
  const {
    wallet,
    creditPackages,
    plans,
    billingProviders,
    pricing,
    transactions,
    transactionsCursor,
    payments,
    jobs,
    team,
    fetchWallet,
    fetchBillingCatalog,
    fetchTransactions,
    fetchPayments,
    fetchTeam,
    startCheckout,
    subscribeToPlan,
    openBillingPortal,
  } = useJobStore()
  const { toast } = useToast()
  const role = useJobStore((s) => s.team.find((m) => m.userId === s.user?.id)?.role)
  const isOwner = !seeker && role === "OWNER"
  const canBuy = seeker || !role || role === "OWNER" || role === "RECRUITER"

  const walletLoader = useLoader(fetchWallet)
  const catalogLoader = useLoader(fetchBillingCatalog)
  const loadFirstTransactions = React.useCallback(
    () => fetchTransactions(true),
    [fetchTransactions]
  )
  const txLoader = useLoader(loadFirstTransactions)
  const paymentsLoader = useLoader(fetchPayments)

  const [provider, setProvider] = React.useState<CheckoutProvider | null>(null)
  const [buyingId, setBuyingId] = React.useState<string | null>(null)
  const [planBusy, setPlanBusy] = React.useState<PlanCode | "portal" | null>(null)
  const [loadingMore, setLoadingMore] = React.useState(false)

  const refreshAll = () => {
    void walletLoader.run()
    void txLoader.run()
    void paymentsLoader.run()
  }
  const confirming = useCheckoutReturn(refreshAll)

  React.useEffect(() => {
    void walletLoader.run()
    void catalogLoader.run()
    void txLoader.run()
    void paymentsLoader.run()
    // The company role (owner-only plan actions) comes from the team list.
    if (!seeker && team.length === 0) fetchTeam().catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const availableProviders = React.useMemo(
    () =>
      (["stripe", "chapa"] as const).filter((p) =>
        billingProviders ? billingProviders[p] : false
      ),
    [billingProviders]
  )
  React.useEffect(() => {
    if (!provider || !availableProviders.includes(provider)) {
      setProvider(availableProviders[0] ?? null)
    }
  }, [availableProviders, provider])

  const hasStripeSubscription =
    !!wallet?.subscription &&
    wallet.subscription.provider === "STRIPE" &&
    wallet.subscription.status !== "CANCELED"

  const buy = async (pack: CreditPackage) => {
    if (!provider) return
    setBuyingId(pack.id)
    try {
      await startCheckout(pack.id, provider)
      // The browser is leaving for the provider's checkout page.
    } catch (err) {
      toast("Couldn't start checkout", errorMessage(err), "error")
      setBuyingId(null)
    }
  }

  const upgrade = async (plan: BillingPlan) => {
    setPlanBusy(plan.code)
    try {
      await subscribeToPlan(plan.code)
    } catch (err) {
      toast("Couldn't start the upgrade", errorMessage(err), "error")
      setPlanBusy(null)
    }
  }

  const manage = async () => {
    setPlanBusy("portal")
    try {
      await openBillingPortal()
    } catch (err) {
      toast("Couldn't open the billing portal", errorMessage(err), "error")
      setPlanBusy(null)
    }
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      await fetchTransactions()
    } catch (err) {
      toast("Couldn't load more transactions", errorMessage(err), "error")
    } finally {
      setLoadingMore(false)
    }
  }

  const jobTitle = (id: string | null) => (id ? jobs.find((j) => j.id === id)?.title : undefined)

  const manageButton = (
    <Button
      size="sm"
      variant="secondary"
      onClick={manage}
      disabled={planBusy !== null}
      className="gap-1.5"
    >
      {planBusy === "portal" ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      Manage subscription
    </Button>
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200 min-w-0">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-txt-title flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" aria-hidden="true" />
          Momentum
        </h1>
        <p className="text-[14px] text-txt-body mt-1">
          {seeker
            ? `Each job application uses ${formatCredits(pricing?.applyCost ?? 1)}. Credits never expire.`
            : "Credits power publishing, featured listings and AI re-runs."}
        </p>
      </div>

      {confirming && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-primary-border/40 bg-primary-light/60 p-3 text-[13px] text-txt-heading"
        >
          <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />
          Confirming your payment…
        </div>
      )}

      {/* ─── Balance ─── */}
      <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
        <section aria-labelledby="momentum-balance">
          <h2 id="momentum-balance" className="sr-only">
            Balance
          </h2>
          {walletLoader.error && !wallet ? (
            <SectionError message={walletLoader.error} onRetry={walletLoader.run} />
          ) : !wallet ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-txt-caption">
                  Available credits
                </p>
                <p className="mt-1 text-[44px] leading-none font-extrabold text-txt-title tabular-nums">
                  <AnimatedNumber value={wallet.balance} />
                </p>
              </div>
              {!seeker && (
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8 text-[13px]">
                  <div>
                    <dt className="text-txt-caption">Plan</dt>
                    <dd className="mt-0.5 font-semibold text-txt-heading flex items-center gap-2">
                      {wallet.plan.name}
                      {wallet.subscription?.status === "PAST_DUE" && (
                        <Badge variant="destructive">Past due</Badge>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-txt-caption">Seats</dt>
                    <dd className="mt-0.5 font-semibold text-txt-heading flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-txt-caption" aria-hidden="true" />
                      {wallet.seats.used} / {wallet.seats.limit ?? "Unlimited"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-txt-caption">
                      {wallet.subscription?.cancelAtPeriodEnd ? "Ends on" : "Renews on"}
                    </dt>
                    <dd className="mt-0.5 font-semibold text-txt-heading">
                      {formatDate(wallet.subscription?.currentPeriodEnd) || "—"}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </section>
      </Card>

      {/* ─── Buy credits ─── */}
      <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
        <section aria-labelledby="momentum-buy">
          <SectionTitle
            id="momentum-buy"
            title="Buy credits"
            description="One-off packs. Credits never expire."
          />
          {catalogLoader.error && creditPackages.length === 0 ? (
            <SectionError message={catalogLoader.error} onRetry={catalogLoader.run} />
          ) : catalogLoader.loading && creditPackages.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : creditPackages.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No credit packs available"
              description="Credit packs haven't been set up yet. Please check back later."
              className="min-h-[200px]"
            />
          ) : (
            <>
              {availableProviders.length === 0 ? (
                <p
                  role="status"
                  className="mb-4 rounded-xl border border-sec-orange/30 bg-sec-orange/5 p-3 text-[13px] text-txt-body"
                >
                  Online payments aren't configured on this server yet, so credits can't be bought
                  right now.
                </p>
              ) : (
                <fieldset className="mb-4">
                  <legend className="text-[12px] font-semibold uppercase tracking-wider text-txt-caption mb-2">
                    Pay with
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {availableProviders.map((p) => (
                      <label
                        key={p}
                        className={`flex items-center gap-2 h-9 px-3.5 rounded-full border text-[13px] font-medium cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary/30 ${
                          provider === p
                            ? "border-primary bg-primary-light text-primary"
                            : "border-bg-border text-txt-body hover:bg-bg-hover"
                        }`}
                      >
                        <input
                          type="radio"
                          name="momentum-provider"
                          value={p}
                          checked={provider === p}
                          onChange={() => setProvider(p)}
                          className="sr-only"
                        />
                        <CreditCard className="w-4 h-4" aria-hidden="true" />
                        {PROVIDER_LABEL[p]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {!canBuy && (
                <p className="mb-4 text-[13px] text-txt-caption">
                  Only company owners and recruiters can buy credits.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {creditPackages.map((pack) => (
                  <div
                    key={pack.id}
                    className="flex flex-col gap-3 rounded-2xl border border-bg-border bg-bg-secondary p-5"
                  >
                    <div>
                      <h3 className="text-[15px] font-semibold text-txt-heading">{pack.name}</h3>
                      <p className="mt-1 text-[26px] font-extrabold text-txt-title tabular-nums">
                        {pack.credits.toLocaleString()}
                        <span className="text-[13px] font-semibold text-txt-caption"> credits</span>
                      </p>
                      {pack.bonusCredits > 0 && (
                        <Badge variant="success" className="mt-1">
                          +{pack.bonusCredits.toLocaleString()} bonus
                        </Badge>
                      )}
                    </div>
                    <div className="text-[14px] text-txt-heading font-semibold">
                      {formatMoney(pack.prices.usd, "USD")}
                      {billingProviders?.chapa && pack.prices.etb != null && (
                        <span className="block text-[12px] font-medium text-txt-caption">
                          {formatMoney(pack.prices.etb, "ETB")} with Chapa
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => buy(pack)}
                      disabled={!provider || !canBuy || buyingId !== null}
                      className="mt-auto gap-1.5"
                      aria-label={`Buy ${pack.name}: ${formatCredits(pack.totalCredits)}`}
                    >
                      {buyingId === pack.id && <Loader2 className="w-4 h-4 animate-spin" />}
                      Buy
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </Card>

      {/* ─── Plans (recruiters only) ─── */}
      {!seeker && (
        <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
          <section aria-labelledby="momentum-plans">
            <SectionTitle
              id="momentum-plans"
              title="Plans"
              description="Plans add monthly credits and team seats."
              action={isOwner && hasStripeSubscription ? manageButton : undefined}
            />
            {catalogLoader.error && plans.length === 0 ? (
              <SectionError message={catalogLoader.error} onRetry={catalogLoader.run} />
            ) : catalogLoader.loading && plans.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-44 rounded-2xl" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No plans available"
                description="Subscription plans haven't been set up yet."
                className="min-h-[200px]"
              />
            ) : (
              <>
                {!isOwner && (
                  <p className="mb-4 text-[13px] text-txt-caption">
                    Only the company owner can change the plan.
                  </p>
                )}
                {isOwner && !billingProviders?.stripe && !hasStripeSubscription && (
                  <p className="mb-4 text-[13px] text-txt-caption">
                    Plan upgrades need card payments, which aren't configured on this server yet.
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const current = wallet?.plan.code === plan.code
                    const higher = PLAN_RANK[plan.code] > PLAN_RANK[wallet?.plan.code ?? "STARTER"]
                    return (
                      <div
                        key={plan.code}
                        className={`flex flex-col gap-3 rounded-2xl border p-5 ${
                          current
                            ? "border-primary ring-2 ring-primary/10 bg-primary-light/40"
                            : "border-bg-border bg-bg-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[15px] font-semibold text-txt-heading">
                            {plan.name}
                          </h3>
                          {current && <Badge variant="primary">Current plan</Badge>}
                        </div>
                        <p className="text-[24px] font-extrabold text-txt-title">
                          {plan.priceUsdCents > 0 ? formatMoney(plan.priceUsdCents, "USD") : "Free"}
                          {plan.priceUsdCents > 0 && (
                            <span className="text-[13px] font-semibold text-txt-caption">
                              {" "}
                              / month
                            </span>
                          )}
                        </p>
                        <ul className="text-[13px] text-txt-body space-y-1">
                          <li>{formatCredits(plan.monthlyCredits)} every month</li>
                          <li>
                            {plan.seatLimit == null
                              ? "Unlimited seats"
                              : `${plan.seatLimit} team seat${plan.seatLimit === 1 ? "" : "s"}`}
                          </li>
                        </ul>
                        {isOwner && higher && !hasStripeSubscription && (
                          <Button
                            onClick={() => upgrade(plan)}
                            disabled={!billingProviders?.stripe || planBusy !== null}
                            className="mt-auto gap-1.5"
                          >
                            {planBusy === plan.code && <Loader2 className="w-4 h-4 animate-spin" />}
                            Upgrade to {plan.name}
                          </Button>
                        )}
                        {isOwner && current && hasStripeSubscription && (
                          <div className="mt-auto">{manageButton}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </Card>
      )}

      {/* ─── Transactions ─── */}
      <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
        <section aria-labelledby="momentum-transactions">
          <SectionTitle
            id="momentum-transactions"
            title="Credit history"
            description="Every credit added to or spent from your balance."
          />
          {txLoader.error && transactions.length === 0 ? (
            <SectionError message={txLoader.error} onRetry={txLoader.run} />
          ) : txLoader.loading && transactions.length === 0 ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={History}
              title="No credit activity yet"
              description="Buy credits or publish a job to see activity here."
              className="min-h-[200px]"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const title = jobTitle(t.referenceId)
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-[13px]">
                          {formatDateTime(t.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px] text-txt-heading">
                          {CREDIT_TRANSACTION_LABEL[t.type] ?? t.type}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold tabular-nums text-[13px] ${
                            t.amount > 0 ? "text-sec-green" : t.amount < 0 ? "text-sec-red" : ""
                          }`}
                        >
                          {t.amount > 0
                            ? `+${t.amount.toLocaleString()}`
                            : t.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-[13px]">
                          {t.balanceAfter.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[13px] max-w-[220px]">
                          <span className="block truncate" title={t.note || t.referenceId || ""}>
                            {title || t.note || t.referenceId || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px]">
                          {t.actor?.name || "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {transactionsCursor && (
                <div className="mt-4 flex justify-center">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="gap-1.5"
                  >
                    {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </Card>

      {/* ─── Payments ─── */}
      <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
        <section aria-labelledby="momentum-payments">
          <SectionTitle id="momentum-payments" title="Payments" />
          {paymentsLoader.error && payments.length === 0 ? (
            <SectionError message={paymentsLoader.error} onRetry={paymentsLoader.run} />
          ) : paymentsLoader.loading && payments.length === 0 ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payments yet"
              description="Your credit pack and subscription payments will be listed here."
              className="min-h-[200px]"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const status = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PENDING
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-[13px]">
                        {formatDateTime(p.paidAt || p.createdAt)}
                      </TableCell>
                      <TableCell className="text-[13px] text-txt-heading">
                        {p.description ||
                          (p.kind === "SUBSCRIPTION" ? "Subscription" : "Credit pack")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[13px]">
                        {p.provider === "CHAPA" ? "Chapa" : "Card"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-[13px]">
                        {p.credits ? p.credits.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums text-[13px]">
                        {formatMoney(p.amount, p.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </Card>
    </div>
  )
}
