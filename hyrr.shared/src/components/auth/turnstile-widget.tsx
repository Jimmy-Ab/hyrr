import * as React from "react"
import { TURNSTILE_SITE_KEY } from "../../lib/config"

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      theme?: "auto" | "light" | "dark"
      callback?: (token: string) => void
      "expired-callback"?: () => void
      "error-callback"?: () => void
    }
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let scriptPromise: Promise<TurnstileApi> | null = null

/** Loads the Turnstile script once per page. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable"))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Could not load the security check"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export interface TurnstileWidgetProps {
  onToken: (token: string) => void
  onExpire?: () => void
  theme?: "auto" | "light" | "dark"
  className?: string
}

/**
 * Cloudflare Turnstile captcha. Renders nothing when VITE_TURNSTILE_SITE_KEY is unset.
 * Tokens are single-use: remount it (change its `key`) after a failed submit to get a new one.
 */
export function TurnstileWidget({
  onToken,
  onExpire,
  theme = "auto",
  className,
}: TurnstileWidgetProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  // Keep the latest callbacks without re-rendering the widget.
  const onTokenRef = React.useRef(onToken)
  const onExpireRef = React.useRef(onExpire)
  onTokenRef.current = onToken
  onExpireRef.current = onExpire

  React.useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let widgetId: string | null = null
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return
        widgetId = api.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => onExpireRef.current?.(),
        })
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // Widget already gone.
        }
      }
    }
  }, [theme])

  if (!TURNSTILE_SITE_KEY) return null
  return (
    <div className={className}>
      <div ref={containerRef} />
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-sec-red">
          {error}. Reload the page and try again.
        </p>
      )}
    </div>
  )
}
