import * as React from "react"
import { useJobStore } from "../../store/useJobStore"

export function OAuthCallback() {
  const { setAccessToken } = useJobStore()

  React.useEffect(() => {
    // OAuth credentials are placed in the fragment, which browsers do not send to servers/logs.
    const params = new URLSearchParams(window.location.hash.replace(/^#/, "") || window.location.search)
    const token = params.get("token")
    if (token) {
      setAccessToken(token)
    }
    // Redirect to home dashboard
    window.location.href = "/"
  }, [setAccessToken])

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-bg-primary gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-[13px] text-txt-caption font-semibold">Completing sign in, please wait...</p>
    </div>
  )
}
