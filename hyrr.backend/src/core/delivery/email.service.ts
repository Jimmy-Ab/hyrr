import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import type { Transporter } from "nodemailer"
import * as nodemailer from "nodemailer"
import { QueueService } from "../../queue/queue.service"

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  attachments?: { filename: string; content: string; contentType: string }[]
}

const DEFAULT_FROM = "Hyrr <no-reply@hyrr.local>"
export const EMAIL_ATTEMPTS = 5
export const EMAIL_BACKOFF_MS = 10_000

/** Strip CR/LF so values can never inject extra headers. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim()

/**
 * SMTP e-mail gateway (nodemailer). `send` enqueues `email:send` (5 attempts, 10 s exponential
 * backoff) and never throws; the queue worker calls `deliver`, which throws on SMTP failure so
 * the job is retried. Without SMTP_HOST `deliver` logs the message (subject, recipient, plain text
 * incl. links) and returns `{ delivered: false }`.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name)
  private transporter: Transporter | null | undefined

  constructor(@Optional() private readonly queue?: QueueService) {}

  onModuleInit() {
    this.queue?.process<EmailMessage>("email", "send", (message) => this.deliver(message))
  }

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

  /**
   * Queues the e-mail and resolves `{ delivered: false, queued: true }` (delivery happens in the
   * background). Without a QueueService it delivers directly. Never throws.
   */
  async send(message: EmailMessage): Promise<{ delivered: boolean; queued?: boolean }> {
    if (!oneLine(message?.to || "")) return { delivered: false }
    if (this.queue) {
      await this.queue.add<EmailMessage>("email", "send", message, {
        attempts: EMAIL_ATTEMPTS,
        backoffMs: EMAIL_BACKOFF_MS,
      })
      return { delivered: false, queued: true }
    }
    try {
      return await this.deliver(message)
    } catch (err: any) {
      this.logger.warn(`E-mail to ${message.to} failed: ${err?.message || err}`)
      return { delivered: false }
    }
  }

  /** The actual SMTP send (queue processor). Throws on SMTP failure so the job is retried. */
  async deliver(message: EmailMessage): Promise<{ delivered: boolean }> {
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
      ...(message.attachments?.length ? { attachments: message.attachments } : {}),
    })
    return { delivered: true }
  }
}
