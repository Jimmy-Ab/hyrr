/** Team invite links open `/invite?token=…` in the recruiter app; the token survives sign-up/OAuth. */
const KEY = "hyrr.inviteToken"

/** Call once at startup: moves an invite token from the URL into session storage. */
export function captureInviteToken() {
  try {
    const url = new URL(window.location.href)
    if (url.pathname !== "/invite") return
    const token = url.searchParams.get("token")
    if (token) sessionStorage.setItem(KEY, token)
    window.history.replaceState(null, "", "/")
  } catch {
    // Storage blocked: the link simply has to be opened again after signing in.
  }
}

export function pendingInviteToken(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearInviteToken() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
