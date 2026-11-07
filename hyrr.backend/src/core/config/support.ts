/** Where users are told to write when their account or company needs help (suspensions etc.). */
export function supportEmail(): string {
  const explicit = process.env.SUPPORT_EMAIL?.trim()
  if (explicit) return explicit
  const from = process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.EMAIL_FROM?.trim()
  return from && from.includes("@") ? from : "support@hyrr.app"
}

export const suspendedMessage = () =>
  `Your account has been suspended. If you think this is a mistake, contact ${supportEmail()}.`
