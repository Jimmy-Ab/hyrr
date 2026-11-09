import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import { CompanyMemberRole, Payment, Prisma } from "@prisma/client"
import { randomUUID } from "crypto"
import { Actor } from "../core/access/access.service"
import { requireCompanyWriter, resolveCompanyMembership } from "../core/access/company-membership"
import { EmailService } from "../core/delivery/email.service"
import { appUrl, paymentReceipt } from "../core/delivery/templates"
import {
  AppException,
  ForbiddenAppException,
  NotFoundAppException,
} from "../core/exceptions/app-exception"
import { RealtimeService } from "../core/realtime/realtime.service"
import { PrismaService } from "../prisma/prisma.service"
import { PricingService } from "./pricing.service"
import { ChapaProvider } from "./providers/chapa.provider"
import { StripeProvider } from "./providers/stripe.provider"
import { effectivePlanCode, seatUsage } from "./seats"
import { ownerWhere, WalletOwner, WalletService } from "./wallet.service"

const trimSlash = (v: string) => v.replace(/\/+$/, "")
const recruiterAppUrl = () => trimSlash(process.env.RECRUITER_APP_URL || "http://localhost:5173")
const publicApiUrl = () =>
  trimSlash(process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`)

export const CHAPA_TX_PREFIX = "hyrr-"

const PAYMENT_FIELDS = {
  id: true,
  provider: true,
  kind: true,
  description: true,
  credits: true,
  amount: true,
  currency: true,
  status: true,
  createdAt: true,
  paidAt: true,
} as const

const STRIPE_STATUS: Record<string, "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED"> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  incomplete: "PAST_DUE",
  paused: "PAST_DUE",
  canceled: "CANCELED",
  incomplete_expired: "CANCELED",
}

const unavailable = (provider: string) =>
  new AppException(
    `${provider} payments are not configured on this server`,
    HttpStatus.SERVICE_UNAVAILABLE,
    "PAYMENTS_UNAVAILABLE"
  )

const fromUnix = (value: unknown): Date | null =>
  typeof value === "number" && value > 0 ? new Date(value * 1000) : null

const idOf = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? ((value as any).id ?? null)
      : null

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService,
    private readonly stripe: StripeProvider,
    private readonly chapa: ChapaProvider,
    private readonly email: EmailService,
    @Optional() private readonly realtime?: RealtimeService
  ) {}

  // ─── Reads ──────────────────────────────────────────────────────────────────

  private async member(actor: Actor) {
    return resolveCompanyMembership(this.prisma, actor)
  }

  private async owner(actor: Actor) {
    const membership = await this.member(actor)
    if (membership.role !== CompanyMemberRole.OWNER)
      throw new ForbiddenAppException("Only the company owner can manage the subscription")
    return membership
  }

  /** Seekers own a personal wallet; everyone else spends their company's. */
  private async walletOwner(actor: Actor): Promise<WalletOwner> {
    if (actor.role === "SEEKER") return { userId: actor.userId }
    const { companyId } = await this.member(actor)
    return { companyId }
  }

  async getWallet(actor: Actor) {
    if (actor.role === "SEEKER") {
      const wallet = await this.wallet.ensureOwnerWallet({ userId: actor.userId })
      return { balance: wallet.balance, plan: null, subscription: null, seats: null }
    }
    const { companyId } = await this.member(actor)
    const [wallet, subscription, seats] = await Promise.all([
      this.wallet.ensureWallet(companyId),
      this.prisma.subscription.findUnique({ where: { companyId } }),
      seatUsage(this.prisma, companyId),
    ])
    const plan = await this.prisma.plan.findUnique({ where: { code: seats.planCode } })
    return {
      balance: wallet.balance,
      plan: plan
        ? {
            code: plan.code,
            name: plan.name,
            monthlyCredits: plan.monthlyCredits,
            seatLimit: plan.seatLimit,
            priceUsdCents: plan.priceUsdCents,
          }
        : {
            code: seats.planCode,
            name: seats.planCode,
            monthlyCredits: 0,
            seatLimit: seats.limit,
            priceUsdCents: 0,
          },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            provider: subscription.provider,
          }
        : null,
      seats: { used: seats.used, limit: seats.limit },
    }
  }

  async listTransactions(actor: Actor, take = 50, cursor?: string) {
    const owner = ownerWhere(await this.walletOwner(actor))
    const size = Math.min(Math.max(take || 50, 1), 200)
    const rows = await this.prisma.creditTransaction.findMany({
      where: owner,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: size + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const page = rows.slice(0, size)
    const actorIds = Array.from(new Set(page.map((r) => r.actorId).filter(Boolean))) as string[]
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : []
    const byId = new Map(users.map((u) => [u.id, u]))
    return {
      items: page.map((r) => ({
        id: r.id,
        amount: r.amount,
        type: r.type,
        balanceAfter: r.balanceAfter,
        referenceId: r.referenceId,
        note: r.note,
        actor: r.actorId ? (byId.get(r.actorId) ?? null) : null,
        createdAt: r.createdAt,
      })),
      nextCursor: rows.length > size ? page[page.length - 1].id : null,
    }
  }

  async listPayments(actor: Actor) {
    const owner = await this.walletOwner(actor)
    return this.prisma.payment.findMany({
      where: owner.companyId
        ? { companyId: owner.companyId }
        : { userId: owner.userId, companyId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: PAYMENT_FIELDS,
    })
  }

  async listPackages(audience: "RECRUITER" | "SEEKER" = "RECRUITER") {
    const rows = await this.prisma.creditPackage.findMany({
      where: { active: true, audience },
      orderBy: [{ sortOrder: "asc" }, { credits: "asc" }],
    })
    return rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      audience: p.audience,
      credits: p.credits,
      bonusCredits: p.bonusCredits,
      totalCredits: p.credits + p.bonusCredits,
      prices: { usd: p.priceUsdCents, etb: p.priceEtbCents > 0 ? p.priceEtbCents : null },
    }))
  }

  async listPlans() {
    const rows = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { priceUsdCents: "asc" }],
    })
    return rows.map((p) => ({
      code: p.code,
      name: p.name,
      monthlyCredits: p.monthlyCredits,
      seatLimit: p.seatLimit,
      priceUsdCents: p.priceUsdCents,
    }))
  }

  async getPricing() {
    const c = await this.pricing.getConfig()
    return {
      publishBase: c.publishBase,
      featureCost: c.featureCost,
      featureDays: c.featureDays,
      aiRerunCost: c.aiRerunCost,
      applyCost: c.applyCost,
      outreachCost: c.outreachCost,
      externalApplyCost: c.externalApplyCost,
      resumeTailorCost: c.resumeTailorCost,
      mockInterviewCost: c.mockInterviewCost,
      negotiationAdviceCost: c.negotiationAdviceCost,
    }
  }

  providers() {
    return { stripe: this.stripe.isConfigured(), chapa: this.chapa.isConfigured() }
  }

  // ─── Checkout ───────────────────────────────────────────────────────────────

  async checkout(actor: Actor, packageId: string, provider: "stripe" | "chapa") {
    const isSeeker = actor.role === "SEEKER"
    const companyId = isSeeker ? null : (await requireCompanyWriter(this.prisma, actor)).companyId
    if (provider === "stripe" && !this.stripe.isConfigured()) throw unavailable("Stripe")
    if (provider === "chapa" && !this.chapa.isConfigured()) throw unavailable("Chapa")

    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: packageId } })
    if (!pkg || !pkg.active || pkg.audience !== (isSeeker ? "SEEKER" : "RECRUITER"))
      throw new NotFoundAppException("Credit package not found", "PACKAGE_NOT_FOUND")
    if (provider === "chapa" && !(pkg.priceEtbCents > 0))
      throw new AppException(
        "This package has no ETB price",
        HttpStatus.BAD_REQUEST,
        "CURRENCY_UNAVAILABLE"
      )
    const credits = pkg.credits + pkg.bonusCredits
    const description = `${pkg.name}: ${credits} Momentum credits`
    const paymentId = randomUUID()
    const momentumUrl = isSeeker ? appUrl("SEEKER", "/momentum") : `${recruiterAppUrl()}/momentum`
    const returnUrl = `${momentumUrl}?checkout=success&payment=${paymentId}`
    const cancelUrl = `${momentumUrl}?checkout=cancelled`
    const isStripe = provider === "stripe"

    await this.prisma.payment.create({
      data: {
        id: paymentId,
        companyId,
        userId: actor.userId,
        provider: isStripe ? "STRIPE" : "CHAPA",
        providerRef: `${CHAPA_TX_PREFIX}${paymentId}`,
        kind: "CREDIT_PACK",
        packageId: pkg.id,
        credits,
        amount: isStripe ? pkg.priceUsdCents : pkg.priceEtbCents,
        currency: isStripe ? "USD" : "ETB",
        status: "PENDING",
        description,
      },
    })

    try {
      if (isStripe) {
        const session = await this.stripe.createCheckoutSession({
          mode: "payment",
          client_reference_id: paymentId,
          customer_email: actor.email || undefined,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: pkg.priceUsdCents,
                product_data: { name: pkg.name, description: `${credits} Momentum credits` },
              },
            },
          ],
          metadata: {
            paymentId,
            companyId: companyId ?? "",
            userId: actor.userId,
            packageId: pkg.id,
          },
          payment_intent_data: {
            metadata: {
              paymentId,
              companyId: companyId ?? "",
              userId: actor.userId,
              packageId: pkg.id,
            },
          },
          success_url: returnUrl,
          cancel_url: cancelUrl,
        })
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { providerRef: session.id },
        })
        if (!session.url) throw new Error("Stripe returned no checkout URL")
        return { url: session.url, paymentId }
      }

      const user = await this.prisma.user.findUnique({
        where: { id: actor.userId },
        select: { name: true, email: true },
      })
      const [firstName, ...rest] = (user?.name || "").trim().split(/\s+/)
      const { checkoutUrl } = await this.chapa.initialize({
        amount: (pkg.priceEtbCents / 100).toFixed(2),
        currency: "ETB",
        email: user?.email || actor.email,
        firstName: firstName || undefined,
        lastName: rest.join(" ") || undefined,
        txRef: `${CHAPA_TX_PREFIX}${paymentId}`,
        callbackUrl: `${publicApiUrl()}/api/billing/webhooks/chapa`,
        returnUrl,
        title: "Hyrr credits",
        description: `${credits} Momentum credits`,
      })
      return { url: checkoutUrl, paymentId }
    } catch (err: any) {
      this.logger.error(`${provider} checkout failed: ${err?.message || err}`)
      await this.prisma.payment
        .updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "FAILED" } })
        .catch(() => undefined)
      throw new AppException(
        "The payment provider could not start the checkout. Please try again.",
        HttpStatus.BAD_GATEWAY,
        "PAYMENT_PROVIDER_ERROR"
      )
    }
  }

  async subscribe(actor: Actor, planCode: "PRO" | "ENTERPRISE") {
    const { companyId } = await this.owner(actor)
    if (!this.stripe.isConfigured()) throw unavailable("Stripe")
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } })
    if (!plan || !plan.active || plan.priceUsdCents <= 0)
      throw new NotFoundAppException("Plan not found", "PLAN_NOT_FOUND")
    const existing = await this.prisma.subscription.findUnique({ where: { companyId } })
    if (
      existing?.providerSubscriptionId &&
      existing.status !== "CANCELED" &&
      existing.plan !== "STARTER"
    )
      throw new AppException(
        "You already have an active subscription. Manage or cancel it in the billing portal.",
        HttpStatus.CONFLICT,
        "SUBSCRIPTION_EXISTS"
      )

    const metadata = { companyId, planCode: plan.code, userId: actor.userId }
    try {
      const session = await this.stripe.createCheckoutSession({
        mode: "subscription",
        client_reference_id: companyId,
        ...(existing?.providerCustomerId && existing.provider === "STRIPE"
          ? { customer: existing.providerCustomerId }
          : { customer_email: actor.email || undefined }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: plan.priceUsdCents,
              recurring: { interval: "month" },
              product_data: {
                name: `Hyrr ${plan.name}`,
                description: `${plan.monthlyCredits} Momentum credits every month`,
              },
            },
          },
        ],
        metadata,
        subscription_data: { metadata },
        success_url: `${recruiterAppUrl()}/momentum?checkout=success&plan=${plan.code}`,
        cancel_url: `${recruiterAppUrl()}/momentum?checkout=cancelled`,
      })
      if (!session.url) throw new Error("Stripe returned no checkout URL")
      return { url: session.url }
    } catch (err: any) {
      this.logger.error(`Stripe subscription checkout failed: ${err?.message || err}`)
      throw new AppException(
        "The payment provider could not start the checkout. Please try again.",
        HttpStatus.BAD_GATEWAY,
        "PAYMENT_PROVIDER_ERROR"
      )
    }
  }

  async portal(actor: Actor) {
    const { companyId } = await this.owner(actor)
    if (!this.stripe.isConfigured()) throw unavailable("Stripe")
    const sub = await this.prisma.subscription.findUnique({ where: { companyId } })
    if (!sub?.providerCustomerId || sub.provider !== "STRIPE")
      throw new NotFoundAppException("No billing account exists yet", "NO_BILLING_CUSTOMER")
    try {
      const session = await this.stripe.createPortalSession(
        sub.providerCustomerId,
        `${recruiterAppUrl()}/momentum`
      )
      return { url: session.url }
    } catch (err: any) {
      this.logger.error(`Stripe portal failed: ${err?.message || err}`)
      throw new AppException(
        "The billing portal is unavailable right now.",
        HttpStatus.BAD_GATEWAY,
        "PAYMENT_PROVIDER_ERROR"
      )
    }
  }

  // ─── Confirmation & fulfilment ──────────────────────────────────────────────

  /** Re-checks a PENDING payment with its provider (success page) and fulfils it when paid. */
  async confirm(actor: Actor, paymentId: string) {
    const owner = await this.walletOwner(actor)
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    const mine = owner.companyId
      ? payment?.companyId === owner.companyId
      : !payment?.companyId && payment?.userId === owner.userId
    if (!payment || !mine) throw new NotFoundAppException("Payment not found", "PAYMENT_NOT_FOUND")
    if (payment.status === "PENDING") {
      try {
        if (payment.provider === "STRIPE" && this.stripe.isConfigured()) {
          if (!payment.providerRef.startsWith(CHAPA_TX_PREFIX)) {
            const session = await this.stripe.retrieveCheckoutSession(payment.providerRef)
            if (session.payment_status === "paid") await this.fulfil(payment.id)
          }
        } else if (payment.provider === "CHAPA" && this.chapa.isConfigured()) {
          await this.verifyChapaAndFulfil(payment)
        }
      } catch (err: any) {
        this.logger.warn(`Confirm ${paymentId} failed: ${err?.message || err}`)
      }
    }
    return this.prisma.payment.findUnique({ where: { id: paymentId }, select: PAYMENT_FIELDS })
  }

  /**
   * Idempotent: flips PENDING → SUCCEEDED and credits the wallet in one transaction; a replay
   * (count 0) is a no-op. Returns true when this call fulfilled the payment.
   */
  async fulfil(paymentId: string): Promise<boolean> {
    const paidAt = new Date()
    const result = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: { status: "SUCCEEDED", paidAt },
      })
      if (flipped.count !== 1) return null
      const payment = await tx.payment.findUnique({ where: { id: paymentId } })
      if (!payment) return null
      if (!payment.companyId && !payment.userId)
        throw new Error(`Payment ${paymentId} has no owner`)
      const { balanceAfter } = await this.wallet.credit(
        {
          ...(payment.companyId ? { companyId: payment.companyId } : { userId: payment.userId! }),
          amount: payment.credits,
          type: "PURCHASE",
          referenceId: payment.id,
          actorId: payment.userId,
          note: payment.description,
        },
        tx
      )
      return { payment, balanceAfter }
    })
    if (!result) return false
    this.realtime?.adminMetric("payment", { provider: result.payment.provider })
    this.sendReceipt(result.payment, result.balanceAfter).catch(() => undefined)
    return true
  }

  private async sendReceipt(payment: Payment, balanceAfter?: number) {
    if (!payment.userId) return
    const user = await this.prisma.user.findUnique({
      where: { id: payment.userId },
      select: { name: true, email: true },
    })
    if (!user?.email) return
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: payment.currency,
    }).format(payment.amount / 100)
    const mail = paymentReceipt({
      name: user.name,
      amount,
      description: payment.description,
      date: payment.paidAt ?? new Date(),
      credits: payment.credits,
      balance: balanceAfter,
      reference: payment.id,
      provider: payment.provider === "STRIPE" ? "Stripe" : "Chapa",
      url: appUrl(payment.companyId ? "RECRUITER" : "SEEKER", "/momentum"),
    })
    await this.email.send({ to: user.email, ...mail })
  }

  // ─── Chapa ──────────────────────────────────────────────────────────────────

  private async verifyChapaAndFulfil(payment: Payment): Promise<boolean> {
    const v = await this.chapa.verify(payment.providerRef)
    if (v.status !== "success") return false
    if (v.amount !== payment.amount || (v.currency || "").toUpperCase() !== payment.currency) {
      this.logger.warn(
        `Chapa ${payment.providerRef}: amount/currency mismatch (got ${v.amount} ${v.currency}, expected ${payment.amount} ${payment.currency})`
      )
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "FAILED",
          metadata: { reason: "AMOUNT_MISMATCH", amount: v.amount, currency: v.currency },
        },
      })
      return false
    }
    if (v.reference)
      await this.prisma.payment
        .updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { metadata: { chapaReference: v.reference } },
        })
        .catch(() => undefined)
    return this.fulfil(payment.id)
  }

  async handleChapaWebhook(
    rawBody: Buffer | undefined,
    body: any,
    signatures: (string | undefined)[]
  ) {
    if (!this.chapa.isConfigured()) throw unavailable("Chapa")
    if (this.chapa.webhookSecret()) {
      if (!rawBody || !this.chapa.verifySignature(rawBody, signatures))
        throw new AppException(
          "Invalid Chapa signature",
          HttpStatus.BAD_REQUEST,
          "INVALID_SIGNATURE"
        )
    }
    const txRef = body?.tx_ref || body?.trx_ref || body?.data?.tx_ref
    return this.processChapaRef(typeof txRef === "string" ? txRef : null)
  }

  /** GET callback (`?trx_ref=…&status=success`): never trusted, always verified server-side. */
  async handleChapaCallback(txRef: string | undefined) {
    if (!this.chapa.isConfigured()) throw unavailable("Chapa")
    return this.processChapaRef(txRef || null)
  }

  private async processChapaRef(txRef: string | null) {
    if (!txRef) return { received: true, fulfilled: false }
    const payment = await this.prisma.payment.findUnique({ where: { providerRef: txRef } })
    if (!payment || payment.provider !== "CHAPA") return { received: true, fulfilled: false }
    if (payment.status !== "PENDING") return { received: true, fulfilled: false }
    try {
      return { received: true, fulfilled: await this.verifyChapaAndFulfil(payment) }
    } catch (err: any) {
      this.logger.warn(`Chapa verify for ${txRef} failed: ${err?.message || err}`)
      return { received: true, fulfilled: false }
    }
  }

  // ─── Stripe webhooks ───────────────────────────────────────────────────────

  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.stripe.webhookSecret()
    if (!secret) throw unavailable("Stripe")
    let event: any
    try {
      if (!rawBody || !signature) throw new Error("missing body or signature")
      event = this.stripe.constructEvent(rawBody, signature, secret)
    } catch (err: any) {
      throw new AppException(
        `Invalid Stripe signature: ${err?.message || "verification failed"}`,
        HttpStatus.BAD_REQUEST,
        "INVALID_SIGNATURE"
      )
    }
    const object = event.data?.object ?? {}
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await this.onCheckoutCompleted(object)
        break
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const paymentId = object.metadata?.paymentId || object.client_reference_id
        if (object.mode === "payment" && paymentId)
          await this.prisma.payment.updateMany({
            where: { id: paymentId, status: "PENDING" },
            data: { status: "FAILED" },
          })
        break
      }
      case "invoice.paid":
        await this.onInvoicePaid(object)
        break
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.onSubscriptionChanged(object, false)
        break
      case "customer.subscription.deleted":
        await this.onSubscriptionChanged(object, true)
        break
      default:
        break
    }
    return { received: true }
  }

  private async onCheckoutCompleted(session: any) {
    if (session.mode === "subscription") {
      const companyId = session.metadata?.companyId || session.client_reference_id
      const planCode = session.metadata?.planCode
      if (!companyId || !planCode) return
      await this.syncSubscription(companyId, planCode, {
        status: "ACTIVE",
        customerId: idOf(session.customer),
        subscriptionId: idOf(session.subscription),
      })
      return
    }
    const paymentId = session.metadata?.paymentId || session.client_reference_id
    if (!paymentId) return
    if (session.payment_status !== "paid") return // async methods arrive later as *_succeeded
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment || payment.provider !== "STRIPE") return
    if (typeof session.amount_total === "number" && session.amount_total !== payment.amount) {
      this.logger.warn(`Stripe session ${session.id}: amount mismatch for payment ${paymentId}`)
      return
    }
    await this.fulfil(paymentId)
  }

  /** Upserts Subscription and keeps Company.plan (the plan *name*) in sync. */
  private async syncSubscription(
    companyId: string,
    planCode: string,
    data: {
      status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED"
      customerId?: string | null
      subscriptionId?: string | null
      currentPeriodEnd?: Date | null
      cancelAtPeriodEnd?: boolean
    }
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    })
    if (!company) return
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } })
    const fields: Prisma.SubscriptionUncheckedUpdateInput = {
      plan: planCode,
      status: data.status,
      provider: "STRIPE",
      ...(data.customerId ? { providerCustomerId: data.customerId } : {}),
      ...(data.subscriptionId ? { providerSubscriptionId: data.subscriptionId } : {}),
      ...(data.currentPeriodEnd ? { currentPeriodEnd: data.currentPeriodEnd } : {}),
      ...(data.cancelAtPeriodEnd !== undefined
        ? { cancelAtPeriodEnd: data.cancelAtPeriodEnd }
        : {}),
    }
    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { companyId },
        create: { companyId, ...(fields as any) },
        update: fields,
      }),
      this.prisma.company.update({
        where: { id: companyId },
        data: { plan: plan?.name ?? planCode.charAt(0) + planCode.slice(1).toLowerCase() },
      }),
    ])
  }

  private subscriptionIdOfInvoice(invoice: any): string | null {
    return (
      idOf(invoice.parent?.subscription_details?.subscription) ??
      idOf(invoice.subscription) ??
      idOf(invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription) ??
      idOf(invoice.lines?.data?.[0]?.subscription) ??
      null
    )
  }

  private async onInvoicePaid(invoice: any) {
    const subscriptionId = this.subscriptionIdOfInvoice(invoice)
    if (!subscriptionId || !invoice.id) return
    let meta: Record<string, string> | null =
      invoice.parent?.subscription_details?.metadata ??
      invoice.subscription_details?.metadata ??
      null
    let existing = await this.prisma.subscription.findUnique({
      where: { providerSubscriptionId: subscriptionId },
    })
    let companyId = existing?.companyId ?? meta?.companyId ?? null
    let planCode = meta?.planCode ?? existing?.plan ?? null
    if ((!companyId || !planCode) && this.stripe.isConfigured()) {
      const sub: any = await this.stripe.retrieveSubscription(subscriptionId)
      meta = sub?.metadata ?? null
      companyId = companyId ?? meta?.companyId ?? null
      planCode = planCode ?? meta?.planCode ?? null
    }
    if (!companyId || !planCode) {
      this.logger.warn(`invoice.paid ${invoice.id}: cannot resolve company/plan`)
      return
    }
    const line = invoice.lines?.data?.find((l: any) => l?.period?.end) ?? null
    const periodEnd = fromUnix(line?.period?.end) ?? fromUnix(invoice.period_end)
    await this.syncSubscription(companyId, planCode, {
      status: "ACTIVE",
      customerId: idOf(invoice.customer),
      subscriptionId,
      currentPeriodEnd: periodEnd,
    })

    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } })
    const credits = plan?.monthlyCredits ?? 0
    const buyer = meta?.userId
      ? await this.prisma.user.findUnique({ where: { id: meta.userId }, select: { id: true } })
      : null
    try {
      await this.prisma.$transaction(async (tx) => {
        // providerRef is unique: a replayed invoice id fails here and nothing is granted twice.
        await tx.payment.create({
          data: {
            companyId,
            userId: buyer?.id ?? null,
            provider: "STRIPE",
            providerRef: invoice.id,
            kind: "SUBSCRIPTION",
            credits,
            amount:
              typeof invoice.amount_paid === "number"
                ? invoice.amount_paid
                : (plan?.priceUsdCents ?? 0),
            currency: String(invoice.currency || "usd").toUpperCase(),
            status: "SUCCEEDED",
            description: `${plan?.name ?? planCode} plan: ${credits} monthly Momentum credits`,
            paidAt: new Date(),
          },
        })
        if (credits > 0)
          await this.wallet.credit(
            {
              companyId: companyId!,
              amount: credits,
              type: "PLAN_GRANT",
              referenceId: invoice.id,
              note: `${plan?.name ?? planCode} monthly credits`,
            },
            tx
          )
      })
    } catch (err: any) {
      if (err?.code === "P2002") return // already granted for this invoice
      throw err
    }
  }

  private async onSubscriptionChanged(sub: any, deleted: boolean) {
    const subscriptionId = idOf(sub)
    if (!subscriptionId) return
    const existing = await this.prisma.subscription.findUnique({
      where: { providerSubscriptionId: subscriptionId },
    })
    const companyId = existing?.companyId ?? sub.metadata?.companyId
    if (!companyId) return
    if (!existing) {
      // Ignore events for an older subscription once the company has moved to a newer one.
      const current = await this.prisma.subscription.findUnique({ where: { companyId } })
      if (
        current?.providerSubscriptionId &&
        current.providerSubscriptionId !== subscriptionId &&
        current.status !== "CANCELED"
      )
        return
    }
    if (deleted) {
      await this.syncSubscription(companyId, "STARTER", {
        status: "CANCELED",
        cancelAtPeriodEnd: false,
      })
      return
    }
    const planCode =
      sub.metadata?.planCode ?? existing?.plan ?? (await effectivePlanCode(this.prisma, companyId))
    const periodEnd =
      fromUnix(sub.current_period_end) ?? fromUnix(sub.items?.data?.[0]?.current_period_end)
    const status = STRIPE_STATUS[String(sub.status)] ?? "ACTIVE"
    await this.syncSubscription(companyId, status === "CANCELED" ? "STARTER" : planCode, {
      status,
      customerId: idOf(sub.customer),
      subscriptionId,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    })
  }
}
