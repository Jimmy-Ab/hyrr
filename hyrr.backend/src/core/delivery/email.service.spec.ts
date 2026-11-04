import * as nodemailer from "nodemailer"
import { EmailService } from "./email.service"

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
})
