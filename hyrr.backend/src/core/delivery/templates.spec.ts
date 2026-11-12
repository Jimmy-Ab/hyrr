import {
  appUrl,
  applicationStatus,
  escapeHtml,
  interviewScheduled,
  jobAlertDigest,
  newMessage,
  notification,
  passwordChanged,
  paymentReceipt,
  resetPassword,
  verifyEmail,
} from "./templates"

describe("e-mail templates", () => {
  const saved = { ...process.env }
  afterEach(() => (process.env = { ...saved }))

  it("escapes HTML in every interpolated value", () => {
    const evil = `<script>alert("x")</script>`
    const mail = newMessage({ name: evil, fromName: evil, jobTitle: evil, excerpt: evil })
    expect(mail.html).not.toContain("<script>")
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;")
    // Plain text keeps the raw value (not HTML)
    expect(mail.text).toContain(evil)
  })

  it("drops non-http(s) links", () => {
    const mail = verifyEmail({ name: "Sam", url: "javascript:alert(1)" })
    expect(mail.html).not.toContain("javascript:")
    expect(mail.text).not.toContain("javascript:")
  })

  it("includes links in both html and text", () => {
    const url = "https://app.example.com/reset-password?token=a&b=c"
    const mail = resetPassword({ name: "Sam", url })
    expect(mail.html).toContain(escapeHtml(new URL(url).toString()))
    expect(mail.text).toContain(url)
    expect(mail.subject).toBe("Reset your password")
  })

  it("every template returns subject, html and text", () => {
    const all = [
      verifyEmail({ name: "A", url: "https://x.io" }),
      resetPassword({ name: "A", url: "https://x.io" }),
      passwordChanged({ name: "A" }),
      applicationStatus({ name: "A", jobTitle: "Dev", companyName: "Acme", statusLabel: "Offer" }),
      interviewScheduled({ name: "A", jobTitle: "Dev", startTime: new Date(0), location: "HQ" }),
      newMessage({ name: "A", fromName: "Acme", jobTitle: "Dev", excerpt: "Hi" }),
      jobAlertDigest({
        name: "A",
        jobs: [{ title: "Dev", company: "Acme", location: "Berlin", url: "https://x.io" }],
      }),
      paymentReceipt({ name: "A", amount: "€10", description: "Boost" }),
      notification({ title: "Something happened" }),
    ]
    for (const mail of all) {
      expect(mail.subject).toBeTruthy()
      expect(mail.html).toContain("<!doctype html>")
      expect(mail.text).toBeTruthy()
    }
    expect(all[3].subject).toBe("Application update: Dev at Acme")
    expect(all[6].subject).toBe("New job match: Dev at Acme")
  })

  it("appUrl picks the app by recipient role", () => {
    process.env.FRONTEND_URL = "https://jobs.example.com/"
    process.env.RECRUITER_APP_URL = "https://hire.example.com"
    expect(appUrl("SEEKER", "/verify-email?token=1")).toBe(
      "https://jobs.example.com/verify-email?token=1"
    )
    expect(appUrl("RECRUITER", "settings")).toBe("https://hire.example.com/settings")
  })
})
