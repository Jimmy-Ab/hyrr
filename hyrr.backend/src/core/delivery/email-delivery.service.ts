import { Injectable } from "@nestjs/common"
import { EmailService } from "./email.service"
import { notification } from "./templates"

/** @deprecated Use `EmailService.send({ to, subject, html, text })` with a template from `./templates`. */
@Injectable()
export class EmailDeliveryService {
  constructor(private readonly email: EmailService) {}

  async send(to: string, subject: string, text: string) {
    const content = notification({ title: text })
    return this.email.send({ to, subject, html: content.html, text: content.text })
  }
}
