import * as nodemailer from "nodemailer"
import { EMAIL_ATTEMPTS, EMAIL_BACKOFF_MS, EmailService } from "./email.service"

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }))

const message = {
  to: "sam@example.com",
  subject: "Hello\r\nBcc: evil@example.com",
  html: "<p>Hi</p>",
  text: "Hi — open https://app.example.com/verify?token=abc",
}

describe("EmailService", () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    jest.clearAllMocks()
  })

  it("logs and returns delivered: false when SMTP_HOST is unset", async () => {
    delete process.env.SMTP_HOST
    const service = new EmailService()
    const log = jest.spyOn((service as any).logger, "log").mockImplementation(() => undefined)
    await expect(service.send(message)).resolves.toEqual({ delivered: false })
    expect(nodemailer.createTransport).not.toHaveBeenCalled()
    expect(log.mock.calls[0][0]).toContain("sam@example.com")
    expect(log.mock.calls[0][0]).toContain("https://app.example.com/verify?token=abc")
  })

  it("sends through SMTP and strips header-injection newlines", async () => {
    process.env.SMTP_HOST = "smtp.example.com"
    process.env.SMTP_PORT = "465"
    process.env.SMTP_USER = "user"
    process.env.SMTP_PASS = "pass"
    process.env.EMAIL_FROM = "Hyrr <hi@hyrr.app>"
    const sendMail = jest.fn().mockResolvedValue({})
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail })
    const service = new EmailService()
    await expect(service.send(message)).resolves.toEqual({ delivered: true })
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 465, secure: true })
    )
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Hyrr <hi@hyrr.app>",
        to: "sam@example.com",
        subject: "Hello Bcc: evil@example.com",
      })
    )
  })

  it("never throws when the transport fails", async () => {
    process.env.SMTP_HOST = "smtp.example.com"
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    })
    const service = new EmailService()
    jest.spyOn((service as any).logger, "warn").mockImplementation(() => undefined)
    await expect(service.send(message)).resolves.toEqual({ delivered: false })
  })

  it("deliver() throws on SMTP failure so the queue retries", async () => {
    process.env.SMTP_HOST = "smtp.example.com"
    ;(nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    })
    await expect(new EmailService().deliver(message)).rejects.toThrow("ECONNREFUSED")
  })

  describe("with a queue", () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined), process: jest.fn() }

    it("enqueues email:send (5 attempts, 10 s backoff) and resolves queued", async () => {
      const service = new EmailService(queue as any)
      await expect(service.send(message)).resolves.toEqual({ delivered: false, queued: true })
      expect(queue.add).toHaveBeenCalledWith("email", "send", message, {
        attempts: EMAIL_ATTEMPTS,
        backoffMs: EMAIL_BACKOFF_MS,
      })
      expect(EMAIL_ATTEMPTS).toBe(5)
      expect(EMAIL_BACKOFF_MS).toBe(10_000)
      expect(nodemailer.createTransport).not.toHaveBeenCalled()
    })

    it("does not enqueue without a recipient", async () => {
      const service = new EmailService(queue as any)
      await expect(service.send({ ...message, to: " \n" })).resolves.toEqual({ delivered: false })
      expect(queue.add).not.toHaveBeenCalled()
    })

    it("registers deliver() as the email:send processor", async () => {
      delete process.env.SMTP_HOST
      const service = new EmailService(queue as any)
      const log = jest.spyOn((service as any).logger, "log").mockImplementation(() => undefined)
      service.onModuleInit()
      expect(queue.process).toHaveBeenCalledWith("email", "send", expect.any(Function))
      const handler = queue.process.mock.calls[0][2]
      await expect(handler(message)).resolves.toEqual({ delivered: false })
      expect(log.mock.calls[0][0]).toBe(
        `[e-mail not configured, SMTP_HOST unset] to=sam@example.com subject="Hello Bcc: evil@example.com"\n${message.text}`
      )
    })
  })
})
