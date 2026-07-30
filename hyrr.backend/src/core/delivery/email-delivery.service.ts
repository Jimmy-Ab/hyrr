import { Injectable, Logger } from "@nestjs/common"

/** Provider-neutral email gateway. Configure EMAIL_WEBHOOK_URL to connect Resend, SendGrid, SES, or an internal mail service. */
@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name)

  async send(to: string, subject: string, text: string) {
    const url = process.env.EMAIL_WEBHOOK_URL
    if (!url) {
      this.logger.debug(`Email delivery not configured; queued notification for ${to}`)
      return { delivered: false, reason: "not-configured" }
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.EMAIL_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        to,
        subject,
        text,
        from: process.env.EMAIL_FROM || "Hyrr <no-reply@hyrr.local>",
      }),
    })
    if (!response.ok) throw new Error(`Email provider responded ${response.status}`)
    return { delivered: true }
  }
}
