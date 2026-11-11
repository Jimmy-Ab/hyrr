import type { StateCreator } from "zustand"
import { ApiError, apiFetch } from "../../lib/api"
import { toError } from "../mappers"
import type {
  BillingPayment,
  BillingPlan,
  CreditPackage,
  CreditTransaction,
  CreditTransactionType,
  JobState,
  PublishCost,
  Wallet,
} from "../types"

export type BillingSlice = Pick<
  JobState,
  | "wallet"
  | "creditPackages"
  | "plans"
  | "billingProviders"
  | "pricing"
  | "transactions"
  | "transactionsCursor"
  | "payments"
  | "fetchWallet"
  | "fetchBillingCatalog"
  | "fetchTransactions"
  | "fetchPayments"
  | "startCheckout"
  | "subscribeToPlan"
  | "openBillingPortal"
  | "confirmPayment"
  | "getPublishCost"
  | "featureJob"
>

// ─── Errors ───────────────────────────────────────────────────────────────────

/** 402 INSUFFICIENT_CREDITS from any spend endpoint. */
export function isInsufficientCredits(err: unknown): err is ApiError {
  return err instanceof ApiError && err.errorCode === "INSUFFICIENT_CREDITS"
}

/** `{ balance, required }` from an INSUFFICIENT_CREDITS error, null otherwise. */
export function insufficientCreditsDetails(
  err: unknown
): { balance: number; required: number } | null {
  if (!isInsufficientCredits(err)) return null
  const d = (err.details ?? {}) as { balance?: unknown; required?: unknown }
  return {
    balance: typeof d.balance === "number" ? d.balance : 0,
    required: typeof d.required === "number" ? d.required : 0,
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback

function mapPlan(p: any): BillingPlan {
  return {
    code: p?.code === "PRO" || p?.code === "ENTERPRISE" ? p.code : "STARTER",
    name: p?.name || "Starter",
    monthlyCredits: num(p?.monthlyCredits),
    seatLimit: typeof p?.seatLimit === "number" ? p.seatLimit : null,
    priceUsdCents: num(p?.priceUsdCents),
  }
}

function mapWallet(w: any): Wallet {
  const sub = w?.subscription
  return {
    balance: num(w?.balance),
    plan: mapPlan(w?.plan),
    subscription: sub
      ? {
          status: sub.status || "ACTIVE",
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
          provider: sub.provider ?? null,
        }
      : null,
    seats: {
      used: num(w?.seats?.used),
      limit: typeof w?.seats?.limit === "number" ? w.seats.limit : null,
    },
  }
}

function mapPackage(p: any): CreditPackage {
  const credits = num(p?.credits)
  const bonusCredits = num(p?.bonusCredits)
  return {
    id: p.id,
    code: p.code || "",
    name: p.name || "Credit pack",
    credits,
    bonusCredits,
    totalCredits: num(p?.totalCredits, credits + bonusCredits),
    prices: {
      usd: num(p?.prices?.usd),
      etb: typeof p?.prices?.etb === "number" && p.prices.etb > 0 ? p.prices.etb : null,
    },
  }
}

function mapTransaction(t: any): CreditTransaction {
  return {
    id: t.id,
    amount: num(t?.amount),
    type: (t?.type || "ADJUSTMENT") as CreditTransactionType,
    balanceAfter: num(t?.balanceAfter),
    referenceId: t?.referenceId ?? null,
    note: t?.note ?? null,
    actor: t?.actor?.id ? { id: t.actor.id, name: t.actor.name || "Team member" } : null,
    createdAt: t?.createdAt || new Date().toISOString(),
  }
}

function mapPayment(p: any): BillingPayment {
  return {
    id: p.id,
    provider: p?.provider === "CHAPA" ? "CHAPA" : "STRIPE",
    kind: p?.kind === "SUBSCRIPTION" ? "SUBSCRIPTION" : "CREDIT_PACK",
    description: p?.description || "",
    credits: num(p?.credits),
    amount: num(p?.amount),
    currency: (p?.currency || "USD").toUpperCase(),
    status: p?.status || "PENDING",
    createdAt: p?.createdAt || new Date().toISOString(),
    paidAt: p?.paidAt ?? null,
  }
}

/** Leaves the app for a hosted provider page. */
function redirectTo(data: any) {
  const url = typeof data?.url === "string" ? data.url : ""
  if (!url) throw new Error("The payment provider did not return a checkout page.")
  window.location.assign(url)
}

// ─── Slice ────────────────────────────────────────────────────────────────────

export const createBillingSlice: StateCreator<JobState, [], [], BillingSlice> = (set, get) => ({
  wallet: null,
  creditPackages: [],
  plans: [],
  billingProviders: null,
  pricing: null,
  transactions: [],
  transactionsCursor: null,
  payments: [],

  fetchWallet: async () => {
    const data = await apiFetch("/billing/wallet")
    set({ wallet: mapWallet(data) })
  },

  fetchBillingCatalog: async () => {
    // Seekers buy their own packs and have no plans.
    const seeker = get().user?.role === "SEEKER"
    const [packages, plans, providers, pricing] = await Promise.all([
      apiFetch(seeker ? "/billing/packages?audience=SEEKER" : "/billing/packages"),
      seeker ? Promise.resolve([]) : apiFetch("/billing/plans"),
      apiFetch("/billing/providers"),
      apiFetch("/billing/pricing"),
    ])
    set({
      creditPackages: (Array.isArray(packages) ? packages : []).map(mapPackage),
      plans: (Array.isArray(plans) ? plans : []).map(mapPlan),
      billingProviders: { stripe: !!providers?.stripe, chapa: !!providers?.chapa },
      // The server is the only source of prices: no client-side defaults.
      pricing: {
        publishBase: num(pricing?.publishBase),
        featureCost: num(pricing?.featureCost),
        featureDays: num(pricing?.featureDays),
        aiRerunCost: num(pricing?.aiRerunCost),
        applyCost: num(pricing?.applyCost),
        outreachCost: num(pricing?.outreachCost),
        externalApplyCost: num(pricing?.externalApplyCost),
        resumeTailorCost: num(pricing?.resumeTailorCost),
        mockInterviewCost: num(pricing?.mockInterviewCost),
        negotiationAdviceCost: num(pricing?.negotiationAdviceCost),
        features: {
          ai: pricing?.features?.ai !== false,
          webJobs: pricing?.features?.webJobs !== false,
        },
      },
    })
  },

  fetchTransactions: async (reset = false) => {
    const cursor = reset ? null : get().transactionsCursor
    // Nothing more to load.
    if (!reset && !cursor && get().transactions.length > 0) return
    const params = new URLSearchParams({ take: "50" })
    if (cursor) params.set("cursor", cursor)
    const data = await apiFetch(`/billing/transactions?${params}`)
    const items = (Array.isArray(data?.items) ? data.items : []).map(mapTransaction)
    set((state) => ({
      transactions: reset || !cursor ? items : [...state.transactions, ...items],
      transactionsCursor: data?.nextCursor ?? null,
    }))
  },

  fetchPayments: async () => {
    const data = await apiFetch("/billing/payments")
    set({ payments: (Array.isArray(data) ? data : []).map(mapPayment) })
  },

  startCheckout: async (packageId, provider) => {
    const data = await apiFetch("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ packageId, provider }),
    })
    redirectTo(data)
  },

  subscribeToPlan: async (planCode) => {
    const data = await apiFetch("/billing/subscribe", {
      method: "POST",
      body: JSON.stringify({ planCode }),
    })
    redirectTo(data)
  },

  openBillingPortal: async () => {
    const data = await apiFetch("/billing/portal", { method: "POST" })
    redirectTo(data)
  },

  confirmPayment: async (paymentId) => {
    const data = await apiFetch(`/billing/payments/${encodeURIComponent(paymentId)}/confirm`, {
      method: "POST",
    })
    const payment = mapPayment(data)
    set((state) => ({
      payments: state.payments.some((p) => p.id === payment.id)
        ? state.payments.map((p) => (p.id === payment.id ? payment : p))
        : [payment, ...state.payments],
    }))
    if (payment.status === "SUCCEEDED") {
      await get()
        .fetchWallet()
        .catch(() => {})
    }
    return payment
  },

  getPublishCost: async (input) => {
    const params = new URLSearchParams()
    if (input.remote !== undefined) params.set("remote", String(!!input.remote))
    if (input.salaryMax != null && input.salaryCurrency) {
      params.set("salaryMax", String(input.salaryMax))
      params.set("salaryCurrency", input.salaryCurrency)
      params.set("salaryPeriod", input.salaryPeriod ?? "YEAR")
    }
    if (input.categoryId) params.set("categoryId", input.categoryId)
    const data = await apiFetch(`/jobs/publish-cost?${params}`)
    const result: PublishCost = {
      cost: num(data?.cost),
      balance: num(data?.balance),
      breakdown: {
        base: num(data?.breakdown?.base),
        multipliers: Array.isArray(data?.breakdown?.multipliers)
          ? data.breakdown.multipliers.map((m: any) => ({
              name: String(m?.name ?? ""),
              factor: num(m?.factor, 1),
            }))
          : [],
      },
    }
    // The preview carries the live balance: keep the header chip in sync.
    set((state) => (state.wallet ? { wallet: { ...state.wallet, balance: result.balance } } : {}))
    return result
  },

  featureJob: async (jobId, days) => {
    try {
      const data = await apiFetch(`/jobs/${jobId}/feature`, {
        method: "POST",
        body: JSON.stringify({ days }),
      })
      const result = {
        featuredUntil: String(data?.featuredUntil ?? ""),
        balance: num(data?.balance),
      }
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId ? { ...j, featured: true, featuredUntil: result.featuredUntil } : j
        ),
        wallet: state.wallet ? { ...state.wallet, balance: result.balance } : state.wallet,
      }))
      return result
    } catch (err) {
      throw toError(err, "Could not feature the job")
    }
  },
})

/** Initial (and logged-out) billing state. */
export const emptyBillingState = {
  wallet: null,
  creditPackages: [] as CreditPackage[],
  plans: [] as BillingPlan[],
  billingProviders: null,
  pricing: null,
  transactions: [] as CreditTransaction[],
  transactionsCursor: null,
  payments: [] as BillingPayment[],
}
