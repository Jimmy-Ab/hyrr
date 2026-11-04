import { Injectable, Logger } from "@nestjs/common"
import * as nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

const DEFAULT_FROM = "Hyrr <no-reply@hyrr.local>"

/** Strip CR/LF so values can never inject extra headers. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim()

/**
 * SMTP e-mail gateway (nodemailer). Without SMTP_HOST it logs the message (subject, recipient,
 * plain text incl. links) and returns `{ delivered: false }`. Never throws.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: Transporter | null | undefined

  isEnabled(): boolean {
    return !!process.env.SMTP_HOST?.trim()
  }

  private transport(): Transporter | null {
    if (this.transporter !== undefined) return this.transporter
    if (!this.isEnabled()) return (this.transporter = null)
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465
    const user = process.env.SMTP_USER?.trim()
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure,
      ...(user ? { auth: { user, pass: process.env.SMTP_PASS || "" } } : {}),
    })
    return this.transporter
  }

  async send(message: EmailMessage): Promise<{ delivered: boolean }> {
    try {
      const to = oneLine(message.to || "")
      if (!to) return { delivered: false }
      const subject = oneLine(message.subject || "")
      const transport = this.transport()
      if (!transport) {
        this.logger.log(
          `[e-mail not configured, SMTP_HOST unset] to=${to} subject="${subject}"\n${message.text}`
        )
        return { delivered: false }
      }
      await transport.sendMail({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to,
        subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: oneLine(message.replyTo) } : {}),
      })
      return { delivered: true }
    } catch (err: any) {
      this.logger.warn(`E-mail to ${message.to} failed: ${err?.message || err}`)
      return { delivered: false }
    }
  }
}
