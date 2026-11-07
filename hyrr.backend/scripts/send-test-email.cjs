// Checks the SMTP settings in hyrr.backend/.env and sends one test e-mail.
// Usage: npm run email:test --workspace=hyrr.backend -- you@example.com
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const nodemailer = require("nodemailer")

const to = process.argv[2]
const host = process.env.SMTP_HOST?.trim()
if (!to) {
  console.error("Usage: npm run email:test --workspace=hyrr.backend -- you@example.com")
  process.exit(1)
}
if (!host) {
  console.error("SMTP_HOST is not set in hyrr.backend/.env: e-mails are only logged to the console.")
  process.exit(1)
}
const port = Number(process.env.SMTP_PORT || 587)
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465
const user = process.env.SMTP_USER?.trim()
const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  ...(user ? { auth: { user, pass: process.env.SMTP_PASS || "" } } : {}),
})
const from = process.env.EMAIL_FROM || "Hyrr <no-reply@hyrr.app>"

;(async () => {
  console.log(`Connecting to ${host}:${port} (${secure ? "TLS" : "STARTTLS"})${user ? ` as ${user}` : ""}…`)
  await transport.verify()
  console.log("Login OK. Sending…")
  const info = await transport.sendMail({
    from,
    to,
    subject: "Hyrr test e-mail",
    text: "If you can read this, Hyrr can send e-mail with your SMTP settings.",
    html: "<p>If you can read this, <strong>Hyrr</strong> can send e-mail with your SMTP settings.</p>",
  })
  console.log(`Sent from ${from} to ${to} (message id ${info.messageId}). Check the inbox and spam folder.`)
})().catch((err) => {
  console.error(`Failed: ${err?.message || err}`)
  process.exit(1)
})
