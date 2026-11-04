import Stripe = require("stripe")
import { createHmac } from "crypto"
import { BillingService } from "./billing.service"
import { PricingService } from "./pricing.service"
import { ChapaProvider } from "./providers/chapa.provider"
import { StripeProvider } from "./providers/stripe.provider"
import { assertSeatAvailable } from "./seats"
import { fakeBillingDb } from "./testing/fake-billing-db"
import { WalletService } from "./wallet.service"

const WHSEC = "whsec_test_unit_secret"
const PKG = "11111111-1111-4111-8111-111111111111"
const owner = { userId: "u1", role: "RECRUITER", email: "owner@acme.io", companyId: "co-1" }
const signer = new Stripe("sk_test_signer_placeholder_key")

function signed(event: any) {
  const payload = JSON.stringify(event)
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: WHSEC })
  return { raw: Buffer.from(payload), header }
}

describe("BillingService", () => {
  const env = { ...process.env }
  let db: any
  let stripe: StripeProvider
  let chapa: ChapaProvider
  let email: { send: jest.Mock }
  let service: BillingService
  let memberRole: string

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_unit_key_0123456789"
    process.env.STRIPE_WEBHOOK_SECRET = WHSEC
    process.env.CHAPA_SECRET_KEY = "CHASECK_TEST-unit"
    delete process.env.CHAPA_WEBHOOK_SECRET
    process.env.RECRUITER_APP_URL = "https://recruit.hyrr.test"
    process.env.PUBLIC_API_URL = "https://api.hyrr.test"

    db = fakeBillingDb()
    memberRole = "OWNER"
    db.companyMember.findUnique = jest.fn(async () => ({
      companyId: "co-1",
      userId: "u1",
      role: memberRole,
    }))
    db.company.rows.push({ id: "co-1", plan: "Starter" })
    db.user.rows.push({ id: "u1", name: "Ada Lovelace", email: "owner@acme.io", companyId: "co-1" })
    db.creditWallet.rows.push({ id: "w1", companyId: "co-1", balance: 20 })
    db.creditPackage.rows.push({
      id: PKG,
      code: "STARTER",
      name: "Starter Bundle",
      credits: 100,
      bonusCredits: 10,
      priceUsdCents: 1999,
      priceEtbCents: 299900,
      active: true,
      sortOrder: 1,
    })
    db.plan.rows.push(
      {
        code: "STARTER",
        name: "Starter",
        monthlyCredits: 0,
        seatLimit: 3,
        priceUsdCents: 0,
        active: true,
      },
      {
        code: "PRO",
        name: "Pro",
        monthlyCredits: 300,
        seatLimit: 10,
        priceUsdCents: 9900,
        active: true,
      },
      {
        code: "ENTERPRISE",
        name: "Enterprise",
        monthlyCredits: 1200,
        seatLimit: null,
        priceUsdCents: 29900,
        active: true,
      }
    )

    stripe = new StripeProvider()
    chapa = new ChapaProvider()
    email = { send: jest.fn().mockResolvedValue({ delivered: false }) }
    const wallet = new WalletService(db)
    service = new BillingService(db, wallet, new PricingService(db), stripe, chapa, email as any)
  })

  afterEach(() => {
    process.env = { ...env }
    jest.restoreAllMocks()
  })

  const balance = () => db.creditWallet.rows.find((w: any) => w.companyId === "co-1").balance

  describe("checkout", () => {
    it("creates a PENDING payment and a Stripe Checkout session (payment mode, USD)", async () => {
      const create = jest
        .spyOn(stripe, "createCheckoutSession")
        .mockResolvedValue({
          id: "cs_test_1",
          url: "https://checkout.stripe.com/c/cs_test_1",
        } as any)
      const res = await service.checkout(owner, PKG, "stripe")
      expect(res.url).toBe("https://checkout.stripe.com/c/cs_test_1")
      const params: any = create.mock.calls[0][0]
      expect(params.mode).toBe("payment")
      expect(params.client_reference_id).toBe(res.paymentId)
      expect(params.metadata).toEqual({
        paymentId: res.paymentId,
        companyId: "co-1",
        packageId: PKG,
      })
      expect(params.line_items[0].price_data).toEqual(
        expect.objectContaining({ currency: "usd", unit_amount: 1999 })
      )
      expect(params.success_url).toBe(
        `https://recruit.hyrr.test/momentum?checkout=success&payment=${res.paymentId}`
      )
      expect(params.cancel_url).toBe("https://recruit.hyrr.test/momentum?checkout=cancelled")
      expect(db.payment.rows[0]).toEqual(
        expect.objectContaining({
          id: res.paymentId,
          status: "PENDING",
          providerRef: "cs_test_1",
          credits: 110,
          amount: 1999,
          currency: "USD",
          provider: "STRIPE",
          userId: "u1",
        })
      )
    })

    it("initialises a Chapa transaction in ETB with tx_ref hyrr-<paymentId>", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          data: { checkout_url: "https://checkout.chapa.co/x" },
        }),
      } as any)
      const res = await service.checkout(owner, PKG, "chapa")
      expect(res.url).toBe("https://checkout.chapa.co/x")
      const [url, init] = fetchMock.mock.calls[0] as any
      expect(url).toBe("https://api.chapa.co/v1/transaction/initialize")
      expect(init.headers.Authorization).toBe("Bearer CHASECK_TEST-unit")
      const body = JSON.parse(init.body)
      expect(body).toEqual(
        expect.objectContaining({
          amount: "2999.00",
          currency: "ETB",
          tx_ref: `hyrr-${res.paymentId}`,
          callback_url: "https://api.hyrr.test/api/billing/webhooks/chapa",
          return_url: `https://recruit.hyrr.test/momentum?checkout=success&payment=${res.paymentId}`,
          email: "owner@acme.io",
          first_name: "Ada",
          last_name: "Lovelace",
        })
      )
      expect(db.payment.rows[0]).toEqual(
        expect.objectContaining({
          provider: "CHAPA",
          amount: 299900,
          currency: "ETB",
          status: "PENDING",
        })
      )
    })

    it("returns 503 PAYMENTS_UNAVAILABLE when a provider is not configured", async () => {
      delete process.env.STRIPE_SECRET_KEY
      delete process.env.CHAPA_SECRET_KEY
      for (const provider of ["stripe", "chapa"] as const)
        await expect(service.checkout(owner, PKG, provider)).rejects.toMatchObject({
          status: 503,
          errorCode: "PAYMENTS_UNAVAILABLE",
        })
      expect(db.payment.rows).toHaveLength(0)
      expect(service.providers()).toEqual({ stripe: false, chapa: false })
    })

    it("marks the payment FAILED and returns 502 when the provider errors", async () => {
      jest.spyOn(stripe, "createCheckoutSession").mockRejectedValue(new Error("boom"))
      await expect(service.checkout(owner, PKG, "stripe")).rejects.toMatchObject({
        status: 502,
        errorCode: "PAYMENT_PROVIDER_ERROR",
      })
      expect(db.payment.rows[0].status).toBe("FAILED")
    })

    it("only OWNER/RECRUITER members may buy", async () => {
      memberRole = "VIEWER"
      await expect(service.checkout(owner, PKG, "stripe")).rejects.toMatchObject({ status: 403 })
    })

    it("subscribe uses subscription mode with monthly recurring price_data (OWNER only)", async () => {
      const create = jest
        .spyOn(stripe, "createCheckoutSession")
        .mockResolvedValue({ id: "cs_sub", url: "https://checkout.stripe.com/sub" } as any)
      expect(await service.subscribe(owner, "PRO")).toEqual({
        url: "https://checkout.stripe.com/sub",
      })
      const params: any = create.mock.calls[0][0]
      expect(params.mode).toBe("subscription")
      expect(params.line_items[0].price_data).toEqual(
        expect.objectContaining({
          currency: "usd",
          unit_amount: 9900,
          recurring: { interval: "month" },
        })
      )
      expect(params.subscription_data.metadata).toEqual({
        companyId: "co-1",
        planCode: "PRO",
        userId: "u1",
      })
      memberRole = "RECRUITER"
      await expect(service.subscribe(owner, "PRO")).rejects.toMatchObject({ status: 403 })
    })
  })

  describe("Stripe webhooks", () => {
    const pending = (over: any = {}) =>
      db.payment.rows.push({
        id: "pay-1",
        companyId: "co-1",
        userId: "u1",
        provider: "STRIPE",
        providerRef: "cs_1",
        kind: "CREDIT_PACK",
        credits: 110,
        amount: 1999,
        currency: "USD",
        status: "PENDING",
        description: "Starter Bundle: 110 Momentum credits",
        ...over,
      })

    const completed = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "payment",
          payment_status: "paid",
          amount_total: 1999,
          client_reference_id: "pay-1",
          metadata: { paymentId: "pay-1" },
        },
      },
    }

    it("rejects a bad signature with 400", async () => {
      const { raw } = signed(completed)
      await expect(service.handleStripeWebhook(raw, "t=1,v1=deadbeef")).rejects.toMatchObject({
        status: 400,
        errorCode: "INVALID_SIGNATURE",
      })
      await expect(service.handleStripeWebhook(raw, undefined)).rejects.toMatchObject({
        status: 400,
      })
    })

    it("a replayed checkout.session.completed credits exactly once", async () => {
      pending()
      const { raw, header } = signed(completed)
      await service.handleStripeWebhook(raw, header)
      await service.handleStripeWebhook(raw, header)
      await Promise.all([
        service.handleStripeWebhook(raw, header),
        service.handleStripeWebhook(raw, header),
      ])
      expect(balance()).toBe(130)
      expect(db.creditTransaction.rows).toEqual([
        expect.objectContaining({
          type: "PURCHASE",
          amount: 110,
          balanceAfter: 130,
          referenceId: "pay-1",
        }),
      ])
      expect(db.payment.rows[0]).toEqual(
        expect.objectContaining({ status: "SUCCEEDED", paidAt: expect.any(Date) })
      )
      await new Promise((r) => setImmediate(r))
      expect(email.send).toHaveBeenCalledTimes(1)
      expect(email.send.mock.calls[0][0]).toEqual(
        expect.objectContaining({ to: "owner@acme.io", subject: "Your Hyrr receipt: $19.99" })
      )
    })

    it("does not credit an unpaid session or a mismatched amount", async () => {
      pending()
      const unpaid = {
        ...completed,
        data: { object: { ...completed.data.object, payment_status: "unpaid" } },
      }
      let s = signed(unpaid)
      await service.handleStripeWebhook(s.raw, s.header)
      const wrong = {
        ...completed,
        data: { object: { ...completed.data.object, amount_total: 1 } },
      }
      s = signed(wrong)
      await service.handleStripeWebhook(s.raw, s.header)
      expect(balance()).toBe(20)
    })

    it("subscription checkout → Subscription ACTIVE and Company.plan = plan name", async () => {
      const s = signed({
        id: "evt_s",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_s",
            mode: "subscription",
            customer: "cus_1",
            subscription: "sub_1",
            metadata: { companyId: "co-1", planCode: "PRO" },
          },
        },
      })
      await service.handleStripeWebhook(s.raw, s.header)
      expect(db.subscription.rows[0]).toEqual(
        expect.objectContaining({
          companyId: "co-1",
          plan: "PRO",
          status: "ACTIVE",
          provider: "STRIPE",
          providerCustomerId: "cus_1",
          providerSubscriptionId: "sub_1",
        })
      )
      expect(db.company.rows[0].plan).toBe("Pro")
    })

    it("invoice.paid grants the plan's monthly credits once per invoice id", async () => {
      db.subscription.rows.push({
        companyId: "co-1",
        plan: "PRO",
        status: "ACTIVE",
        provider: "STRIPE",
        providerSubscriptionId: "sub_1",
        providerCustomerId: "cus_1",
      })
      const invoice = (id: string) =>
        signed({
          id: `evt_${id}`,
          type: "invoice.paid",
          data: {
            object: {
              id,
              customer: "cus_1",
              amount_paid: 9900,
              currency: "usd",
              parent: {
                subscription_details: {
                  subscription: "sub_1",
                  metadata: { companyId: "co-1", planCode: "PRO" },
                },
              },
              lines: { data: [{ period: { start: 1790000000, end: 1792600000 } }] },
            },
          },
        })
      const first = invoice("in_1")
      await service.handleStripeWebhook(first.raw, first.header)
      await service.handleStripeWebhook(first.raw, first.header)
      expect(balance()).toBe(320)
      const second = invoice("in_2")
      await service.handleStripeWebhook(second.raw, second.header)
      expect(balance()).toBe(620)
      const grants = db.creditTransaction.rows.filter((t: any) => t.type === "PLAN_GRANT")
      expect(grants.map((g: any) => g.referenceId)).toEqual(["in_1", "in_2"])
      expect(db.subscription.rows[0].currentPeriodEnd).toEqual(new Date(1792600000 * 1000))
      expect(db.payment.rows.filter((p: any) => p.kind === "SUBSCRIPTION")).toHaveLength(2)
    })

    it("customer.subscription.updated syncs status/cancelAtPeriodEnd; deleted → STARTER", async () => {
      db.subscription.rows.push({
        companyId: "co-1",
        plan: "PRO",
        status: "ACTIVE",
        provider: "STRIPE",
        providerSubscriptionId: "sub_1",
        cancelAtPeriodEnd: false,
      })
      db.company.rows[0].plan = "Pro"
      let s = signed({
        id: "evt_u",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_1",
            status: "past_due",
            cancel_at_period_end: true,
            customer: "cus_1",
            metadata: {},
            items: { data: [{ current_period_end: 1792600000 }] },
          },
        },
      })
      await service.handleStripeWebhook(s.raw, s.header)
      expect(db.subscription.rows[0]).toEqual(
        expect.objectContaining({
          status: "PAST_DUE",
          cancelAtPeriodEnd: true,
          plan: "PRO",
          currentPeriodEnd: new Date(1792600000 * 1000),
        })
      )
      s = signed({
        id: "evt_d",
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_1", status: "canceled", metadata: {} } },
      })
      await service.handleStripeWebhook(s.raw, s.header)
      expect(db.subscription.rows[0]).toEqual(
        expect.objectContaining({ plan: "STARTER", status: "CANCELED" })
      )
      expect(db.company.rows[0].plan).toBe("Starter")
    })
  })

  describe("Chapa", () => {
    const pendingChapa = () =>
      db.payment.rows.push({
        id: "pay-c",
        companyId: "co-1",
        userId: "u1",
        provider: "CHAPA",
        providerRef: "hyrr-pay-c",
        kind: "CREDIT_PACK",
        credits: 110,
        amount: 299900,
        currency: "ETB",
        status: "PENDING",
        description: "Starter Bundle",
      })
    const verifyReturns = (data: any) =>
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ status: "success", data }),
        } as any)

    it("verifies server-side and fulfils once (webhook + GET callback replay)", async () => {
      pendingChapa()
      const fetchMock = verifyReturns({
        status: "success",
        amount: "2999.00",
        currency: "ETB",
        tx_ref: "hyrr-pay-c",
        reference: "APx",
      })
      const body = { tx_ref: "hyrr-pay-c", status: "success" }
      expect(await service.handleChapaWebhook(Buffer.from(JSON.stringify(body)), body, [])).toEqual(
        { received: true, fulfilled: true }
      )
      expect(await service.handleChapaCallback("hyrr-pay-c")).toEqual({
        received: true,
        fulfilled: false,
      })
      expect(balance()).toBe(130)
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.chapa.co/v1/transaction/verify/hyrr-pay-c"
      )
    })

    it("does not credit on an amount/currency mismatch", async () => {
      pendingChapa()
      verifyReturns({ status: "success", amount: "1.00", currency: "ETB", tx_ref: "hyrr-pay-c" })
      const res = await service.handleChapaCallback("hyrr-pay-c")
      expect(res.fulfilled).toBe(false)
      expect(balance()).toBe(20)
      expect(db.payment.rows[0].status).toBe("FAILED")
    })

    it("does not credit when the verify API is unreachable", async () => {
      pendingChapa()
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNREFUSED"))
      const res = await service.handleChapaCallback("hyrr-pay-c")
      expect(res).toEqual({ received: true, fulfilled: false })
      expect(balance()).toBe(20)
      expect(db.payment.rows[0].status).toBe("PENDING")
    })

    it("checks the HMAC signature when CHAPA_WEBHOOK_SECRET is set", async () => {
      process.env.CHAPA_WEBHOOK_SECRET = "chapa-hook-secret"
      pendingChapa()
      const fetchMock = verifyReturns({ status: "success", amount: "2999.00", currency: "ETB" })
      const raw = Buffer.from(JSON.stringify({ tx_ref: "hyrr-pay-c" }))
      await expect(
        service.handleChapaWebhook(raw, { tx_ref: "hyrr-pay-c" }, ["bad"])
      ).rejects.toMatchObject({ status: 400, errorCode: "INVALID_SIGNATURE" })
      expect(fetchMock).not.toHaveBeenCalled()
      const sig = createHmac("sha256", "chapa-hook-secret").update(raw).digest("hex")
      expect(
        await service.handleChapaWebhook(raw, { tx_ref: "hyrr-pay-c" }, [undefined, sig])
      ).toEqual({ received: true, fulfilled: true })
    })
  })

  describe("confirm", () => {
    it("re-checks a pending Stripe payment and fulfils it", async () => {
      db.payment.rows.push({
        id: "pay-1",
        companyId: "co-1",
        userId: "u1",
        provider: "STRIPE",
        providerRef: "cs_1",
        credits: 110,
        amount: 1999,
        currency: "USD",
        status: "PENDING",
        description: "x",
      })
      jest
        .spyOn(stripe, "retrieveCheckoutSession")
        .mockResolvedValue({ id: "cs_1", payment_status: "paid" } as any)
      const res: any = await service.confirm(owner, "pay-1")
      expect(res.status).toBe("SUCCEEDED")
      expect(balance()).toBe(130)
      await service.confirm(owner, "pay-1")
      expect(balance()).toBe(130)
    })

    it("leaves an unpaid session pending and hides other companies' payments", async () => {
      db.payment.rows.push({
        id: "pay-1",
        companyId: "co-1",
        provider: "STRIPE",
        providerRef: "cs_1",
        credits: 1,
        amount: 1,
        currency: "USD",
        status: "PENDING",
        description: "x",
      })
      db.payment.rows.push({
        id: "pay-2",
        companyId: "co-2",
        provider: "STRIPE",
        providerRef: "cs_2",
        credits: 1,
        amount: 1,
        currency: "USD",
        status: "PENDING",
        description: "x",
      })
      jest
        .spyOn(stripe, "retrieveCheckoutSession")
        .mockResolvedValue({ id: "cs_1", payment_status: "unpaid" } as any)
      expect(((await service.confirm(owner, "pay-1")) as any).status).toBe("PENDING")
      await expect(service.confirm(owner, "pay-2")).rejects.toMatchObject({ status: 404 })
    })
  })

  describe("wallet & seats", () => {
    it("GET /billing/wallet shape", async () => {
      const w = await service.getWallet(owner)
      expect(w).toEqual({
        balance: 20,
        plan: {
          code: "STARTER",
          name: "Starter",
          monthlyCredits: 0,
          seatLimit: 3,
          priceUsdCents: 0,
        },
        subscription: null,
        seats: { used: 1, limit: 3 },
      })
    })

    it("seat limits: Starter 3, Pro 10, Enterprise unlimited", async () => {
      db.user.rows.push({ id: "u2", companyId: "co-1" }, { id: "u3", companyId: "co-1" })
      await expect(assertSeatAvailable(db, "co-1")).rejects.toMatchObject({
        status: 402,
        errorCode: "SEAT_LIMIT_REACHED",
        details: { used: 3, limit: 3, plan: "STARTER" },
      })
      db.subscription.rows.push({ companyId: "co-1", plan: "PRO", status: "ACTIVE" })
      await expect(assertSeatAvailable(db, "co-1")).resolves.toBeUndefined()
      for (let i = 4; i <= 10; i++) db.user.rows.push({ id: `u${i}`, companyId: "co-1" })
      await expect(assertSeatAvailable(db, "co-1")).rejects.toMatchObject({
        errorCode: "SEAT_LIMIT_REACHED",
      })
      db.subscription.rows[0].plan = "ENTERPRISE"
      await expect(assertSeatAvailable(db, "co-1")).resolves.toBeUndefined()
    })

    it("lists packages with totals and both prices", async () => {
      expect(await service.listPackages()).toEqual([
        {
          id: PKG,
          code: "STARTER",
          name: "Starter Bundle",
          credits: 100,
          bonusCredits: 10,
          totalCredits: 110,
          prices: { usd: 1999, etb: 299900 },
        },
      ])
      db.creditPackage.rows[0].priceEtbCents = 0
      expect((await service.listPackages())[0].prices).toEqual({ usd: 1999, etb: null })
      await expect(service.checkout(owner, PKG, "chapa")).rejects.toMatchObject({
        errorCode: "CURRENCY_UNAVAILABLE",
      })
    })
  })
})
