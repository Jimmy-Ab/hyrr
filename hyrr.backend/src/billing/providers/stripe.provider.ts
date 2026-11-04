import { Injectable } from "@nestjs/common"
import Stripe = require("stripe")

const isRealKey = (value?: string) => {
  const v = value?.trim()
  return !!v && !/^(sk|rk)_(test|live)_\.{3}$/.test(v) && !v.endsWith("...") && v.length > 12
}

/** Thin wrapper over the Stripe SDK. Optional: without STRIPE_SECRET_KEY checkout is unavailable. */
@Injectable()
export class StripeProvider {
  private client: Stripe | null = null
  private clientKey: string | undefined

  isConfigured(): boolean {
    return isRealKey(process.env.STRIPE_SECRET_KEY)
  }

  webhookSecret(): string | null {
    return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null
  }

  /** SDK instance (lazily created; re-created when the key changes, e.g. in tests). */
  sdk(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY?.trim()
    if (!this.client || this.clientKey !== key) {
      // Signature verification needs no API key; a placeholder keeps the SDK constructible.
      this.client = new Stripe(isRealKey(key) ? key! : "sk_test_unconfigured_placeholder")
      this.clientKey = key
    }
    return this.client
  }

  /** Verifies `stripe-signature` against the raw body. Throws on a bad signature. */
  constructEvent(rawBody: Buffer | string, signature: string, secret: string): Stripe.Event {
    return this.sdk().webhooks.constructEvent(rawBody, signature, secret)
  }

  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    return this.sdk().checkout.sessions.create(params)
  }

  retrieveCheckoutSession(id: string): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    return this.sdk().checkout.sessions.retrieve(id)
  }

  retrieveSubscription(id: string): Promise<Stripe.Response<Stripe.Subscription>> {
    return this.sdk().subscriptions.retrieve(id)
  }

  createPortalSession(
    customer: string,
    returnUrl: string,
  ): Promise<Stripe.Response<Stripe.BillingPortal.Session>> {
    return this.sdk().billingPortal.sessions.create({ customer, return_url: returnUrl })
  }
}
