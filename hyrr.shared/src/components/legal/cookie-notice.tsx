import { Cookie } from "lucide-react"
import * as React from "react"
import { Button } from "../ui/button"

const STORAGE_KEY = "hyrr.cookieNotice.dismissed"

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

/** Informational notice: the apps only use essential cookies, so no consent choice is needed. */
export function CookieNotice() {
  const [dismissed, setDismissed] = React.useState(readDismissed)
  if (dismissed) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // Storage unavailable (private mode): hide for this page view only.
    }
    setDismissed(true)
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-bg-border bg-bg-secondary p-4 shadow-floating sm:flex-row sm:items-center"
    >
      <Cookie className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
      <p className="flex-1 text-[13px] text-txt-body">
        We only use essential cookies to keep you signed in and secure. No tracking or advertising.{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener"
          className="font-semibold text-primary hover:underline"
        >
          Privacy Policy
        </a>
      </p>
      <Button size="sm" onClick={dismiss} className="shrink-0 self-end sm:self-auto">
        Got it
      </Button>
    </div>
  )
}
