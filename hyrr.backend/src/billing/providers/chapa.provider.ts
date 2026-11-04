import { Injectable, Logger } from "@nestjs/common"
import { createHmac, timingSafeEqual } from "crypto"

export type ChapaInitializeInput = {
  amount: string
  currency: string
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  txRef: string
  callbackUrl: string
  returnUrl: string
  title?: string
  description?: string
}

export type ChapaVerification = {
  status: string // "success" | "failed" | "pending" …
  amount: number | null // minor units
  currency: string | null
  txRef: string | null
  reference: string | null
  raw: unknown
}

const API = "https://api.chapa.co/v1"

/** Chapa (Ethiopia) hosted checkout over its REST API. Optional: needs CHAPA_SECRET_KEY. */
@Injectable()
export class ChapaProvider {
  private readonly logger = new Logger(ChapaProvider.name)

  private key(): string | null {
    const v = process.env.CHAPA_SECRET_KEY?.trim()
    return v && !v.endsWith("...") ? v : null
  }

  private base(): string {
    return (process.env.CHAPA_API_URL || API).replace(/\/+$/, "")
  }

  isConfigured(): boolean {
    return !!this.key()
  }

  webhookSecret(): string | null {
    return process.env.CHAPA_WEBHOOK_SECRET?.trim() || null
  }

  /** HMAC-SHA256(rawBody, CHAPA_WEBHOOK_SECRET) in hex, compared in constant time. */
  verifySignature(rawBody: Buffer | string, signatures: (string | undefined)[]): boolean {
    const secret = this.webhookSecret()
    if (!secret) return true
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
    return signatures.some((sig) => {
      if (!sig) return false
      const a = Buffer.from(sig.trim().toLowerCase())
      const b = Buffer.from(expected)
      return a.length === b.length && timingSafeEqual(a, b)
    })
  }

  async initialize(input: ChapaInitializeInput): Promise<{ checkoutUrl: string }> {
    const res = await fetch(`${this.base()}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        email: input.email || undefined,
        first_name: input.firstName || undefined,
        last_name: input.lastName || undefined,
        tx_ref: input.txRef,
        callback_url: input.callbackUrl,
        return_url: input.returnUrl,
        customization: {
          title: (input.title || "Hyrr").slice(0, 16),
          description: (input.description || "Momentum credits")
            .replace(/[^\w .-]/g, "")
            .slice(0, 50),
        },
      }),
    })
    const body: any = await res.json().catch(() => null)
    const url = body?.data?.checkout_url
    if (!res.ok || typeof url !== "string")
      throw new Error(
        `Chapa initialize failed (${res.status}): ${body?.message ? JSON.stringify(body.message) : "no checkout_url"}`
      )
    return { checkoutUrl: url }
  }

  /** Server-side verification; never trust a webhook body. Throws when the API is unreachable. */
  async verify(txRef: string): Promise<ChapaVerification> {
    const res = await fetch(`${this.base()}/transaction/verify/${encodeURIComponent(txRef)}`, {
      headers: { Authorization: `Bearer ${this.key()}` },
    })
    const body: any = await res.json().catch(() => null)
    if (!body || (res.status >= 500 && !body?.data))
      throw new Error(`Chapa verify failed (${res.status})`)
    const data = body?.data ?? {}
    const amountNum = Number(data.amount)
    return {
      status: String(data.status || body.status || "failed").toLowerCase(),
      amount: Number.isFinite(amountNum) ? Math.round(amountNum * 100) : null,
      currency: data.currency ? String(data.currency).toUpperCase() : null,
      txRef: data.tx_ref ?? null,
      reference: data.reference ?? null,
      raw: body,
    }
  }
}
