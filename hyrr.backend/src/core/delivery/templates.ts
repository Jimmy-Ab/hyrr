/**
 * Transactional e-mail templates. Each helper returns `{ subject, html, text }`.
 * Every interpolated value is HTML-escaped; URLs are additionally restricted to http(s).
 */

export type EmailContent = { subject: string; html: string; text: string }
export type RecipientRole = "SEEKER" | "RECRUITER" | "ADMIN" | string | null | undefined

const BRAND = "Hyrr"
const PRIMARY = "#4f46e5"

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Only http(s) URLs are rendered as links; anything else becomes empty. */
export function safeUrl(value: string | null | undefined): string {
  if (!value) return ""
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : ""
  } catch {
    return ""
  }
}

const trimSlash = (value: string) => value.replace(/\/+$/, "")

/** Absolute link into the app the recipient uses (recruiter app vs seeker app). */
export function appUrl(role: RecipientRole, path = "/"): string {
  const base =
    role === "RECRUITER" || role === "ADMIN"
      ? process.env.RECRUITER_APP_URL || "http://localhost:5173"
      : process.env.FRONTEND_URL || "http://localhost:5174"
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${trimSlash(base)}${suffix}`
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "button"; label: string; url: string }
  | { kind: "list"; items: { title: string; meta?: string; url?: string }[] }
  | { kind: "muted"; text: string }

function renderHtml(preheader: string, heading: string, blocks: Block[]): string {
  const body = blocks
    .map((block) => {
      switch (block.kind) {
        case "p":
          return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">${escapeHtml(block.text)}</p>`
        case "muted":
          return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;">${escapeHtml(block.text)}</p>`
        case "quote":
          return `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${PRIMARY};background:#f5f5ff;font-size:14px;line-height:1.6;color:#374151;white-space:pre-line;">${escapeHtml(block.text)}</blockquote>`
        case "button": {
          const href = safeUrl(block.url)
          if (!href) return ""
          return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${PRIMARY};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a></td></tr></table><p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;">Or open this link: <a href="${escapeHtml(href)}" style="color:${PRIMARY};">${escapeHtml(href)}</a></p>`
        }
        case "list":
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${block.items
            .map((item) => {
              const href = safeUrl(item.url)
              const title = href
                ? `<a href="${escapeHtml(href)}" style="color:${PRIMARY};text-decoration:none;font-weight:600;">${escapeHtml(item.title)}</a>`
                : `<strong>${escapeHtml(item.title)}</strong>`
              const meta = item.meta
                ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(item.meta)}</div>`
                : ""
              return `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;font-size:15px;color:#1f2937;">${title}${meta}</td></tr>`
            })
            .join("")}</table>`
      }
    })
    .join("\n")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${PRIMARY};">${BRAND}</td></tr>
<tr><td style="background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e5e7eb;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827;">${escapeHtml(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#9ca3af;">You are receiving this e-mail because of your ${BRAND} account or application. You can change e-mail preferences in your ${BRAND} settings.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function renderText(heading: string, blocks: Block[]): string {
  const lines = [heading, ""]
  for (const block of blocks) {
    switch (block.kind) {
      case "p":
      case "muted":
        lines.push(block.text, "")
        break
      case "quote":
        lines.push(...block.text.split("\n").map((l) => `> ${l}`), "")
        break
      case "button": {
        const href = safeUrl(block.url)
        if (href) lines.push(`${block.label}: ${href}`, "")
        break
      }
      case "list":
        for (const item of block.items) {
          lines.push(`- ${item.title}${item.meta ? ` (${item.meta})` : ""}`)
          const href = safeUrl(item.url)
          if (href) lines.push(`  ${href}`)
        }
        lines.push("")
        break
    }
  }
  lines.push(`— The ${BRAND} team`)
  return lines.join("\n")
}

function build(subject: string, heading: string, blocks: Block[], preheader = subject): EmailContent {
  return { subject, html: renderHtml(preheader, heading, blocks), text: renderText(heading, blocks) }
}

const greeting = (name?: string | null) => (name?.trim() ? `Hi ${name.trim()},` : "Hi,")

export function verifyEmail(input: { name?: string | null; url: string }): EmailContent {
  return build("Confirm your e-mail address", "Confirm your e-mail address", [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: `Please confirm your e-mail address to finish setting up your ${BRAND} account.` },
    { kind: "button", label: "Confirm e-mail", url: input.url },
    { kind: "muted", text: "If you didn't create an account, you can ignore this e-mail." },
  ])
}

export function resetPassword(input: { name?: string | null; url: string }): EmailContent {
  return build("Reset your password", "Reset your password", [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: "We received a request to reset your password. The link expires soon and can be used once." },
    { kind: "button", label: "Choose a new password", url: input.url },
    { kind: "muted", text: "If you didn't request this, ignore this e-mail — your password stays unchanged." },
  ])
}

export function passwordChanged(input: { name?: string | null }): EmailContent {
  return build("Your password was changed", "Your password was changed", [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: `The password for your ${BRAND} account was just changed and other sessions were signed out.` },
    { kind: "muted", text: "If this wasn't you, reset your password immediately and contact support." },
  ])
}

export function applicationStatus(input: {
  name?: string | null
  jobTitle: string
  companyName: string
  statusLabel: string
  url?: string | null
}): EmailContent {
  const blocks: Block[] = [
    { kind: "p", text: greeting(input.name) },
    {
      kind: "p",
      text: `Your application for ${input.jobTitle} at ${input.companyName} has a new status: ${input.statusLabel}.`,
    },
  ]
  if (input.url) blocks.push({ kind: "button", label: "View application", url: input.url })
  return build(
    `Application update: ${input.jobTitle} at ${input.companyName}`,
    "Your application was updated",
    blocks
  )
}

export function interviewScheduled(input: {
  name?: string | null
  jobTitle: string
  startTime: Date | string
  meetingUrl?: string | null
  location?: string | null
}): EmailContent {
  const when =
    input.startTime instanceof Date
      ? input.startTime.toUTCString()
      : new Date(input.startTime).toString() === "Invalid Date"
        ? String(input.startTime)
        : new Date(input.startTime).toUTCString()
  const blocks: Block[] = [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: `An interview for ${input.jobTitle} was scheduled for ${when}.` },
  ]
  if (input.location) blocks.push({ kind: "p", text: `Location: ${input.location}` })
  if (input.meetingUrl) blocks.push({ kind: "button", label: "Join meeting", url: input.meetingUrl })
  return build(`Interview scheduled: ${input.jobTitle}`, "Interview scheduled", blocks)
}

export function newMessage(input: {
  name?: string | null
  fromName: string
  jobTitle: string
  excerpt: string
  url?: string | null
}): EmailContent {
  const excerpt = input.excerpt.length > 500 ? `${input.excerpt.slice(0, 497)}...` : input.excerpt
  const blocks: Block[] = [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: `${input.fromName} sent you a message about ${input.jobTitle}:` },
    { kind: "quote", text: excerpt },
  ]
  if (input.url) blocks.push({ kind: "button", label: "Reply", url: input.url })
  return build(`New message from ${input.fromName} about ${input.jobTitle}`, "You have a new message", blocks)
}

export function jobAlertDigest(input: {
  name?: string | null
  jobs: { title: string; company: string; location?: string | null; url?: string | null }[]
}): EmailContent {
  const count = input.jobs.length
  const subject =
    count === 1
      ? `New job match: ${input.jobs[0].title} at ${input.jobs[0].company}`
      : `${count} new jobs match your alerts`
  return build(subject, count === 1 ? "A new job matches your alert" : "New jobs match your alerts", [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: count === 1 ? "This job matches one of your job alerts:" : "These jobs match your job alerts:" },
    {
      kind: "list",
      items: input.jobs.map((job) => ({
        title: job.title,
        meta: [job.company, job.location].filter(Boolean).join(" · "),
        url: job.url ?? undefined,
      })),
    },
    { kind: "muted", text: "Manage your job alerts in your Hyrr settings." },
  ])
}

/** Stub for the upcoming billing phase. */
export function paymentReceipt(input: {
  name?: string | null
  amount: string
  description: string
  date?: Date | string
  url?: string | null
}): EmailContent {
  const blocks: Block[] = [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: `Thanks for your payment of ${input.amount} for ${input.description}.` },
  ]
  if (input.date) blocks.push({ kind: "muted", text: `Date: ${new Date(input.date).toUTCString()}` })
  if (input.url) blocks.push({ kind: "button", label: "View receipt", url: input.url })
  return build(`Your ${BRAND} receipt`, "Payment received", blocks)
}

/** Generic notification e-mail (used for in-app notification copies). */
export function notification(input: {
  name?: string | null
  title: string
  url?: string | null
}): EmailContent {
  const blocks: Block[] = [
    { kind: "p", text: greeting(input.name) },
    { kind: "p", text: input.title },
  ]
  if (input.url) blocks.push({ kind: "button", label: `Open ${BRAND}`, url: input.url })
  const subject = input.title.length > 90 ? `${input.title.slice(0, 87)}...` : input.title
  return build(subject, "You have a new notification", blocks)
}
