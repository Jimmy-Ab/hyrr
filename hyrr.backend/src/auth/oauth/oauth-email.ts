const isTrue = (value: unknown) => value === true || value === "true"

/** Google: `email_verified` from the OpenID userinfo payload. */
export function googleVerifiedEmail(profile: any): string | null {
  const email = profile?.emails?.[0]?.value || profile?._json?.email
  const verified = isTrue(profile?.emails?.[0]?.verified) || isTrue(profile?._json?.email_verified)
  return email && verified ? String(email) : null
}

/** GitHub: the PRIMARY address, and only if GitHub marks it verified (needs `user:email`). */
export function githubVerifiedEmail(profile: any): string | null {
  const emails: any[] = Array.isArray(profile?.emails) ? profile.emails : []
  const primary = emails.find((e) => e?.primary && isTrue(e?.verified))
  const email = primary?.value || primary?.email
  return email ? String(email) : null
}

/** LinkedIn OIDC: `email_verified` claim from /v2/userinfo. */
export function linkedinVerifiedEmail(claims: any): string | null {
  return claims?.email && isTrue(claims?.email_verified) ? String(claims.email) : null
}
