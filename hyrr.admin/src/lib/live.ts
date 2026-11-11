import { useJobStore } from "hyrr.shared"
import { useEffect, useState } from "react"
import { queryClient } from "./api"

/** Admin queries that live metrics make stale (dashboard, analytics, money lists). */
const LIVE_PATHS = /^\/(dashboard|analytics|payments|ledger|companies|users|moderation)/
const PRICING_PATHS = /^\/(pricing|packages|plans)$/
const THROTTLE_MS = 5000

/**
 * Joins the admin live room on the shared socket and refreshes the affected queries when an
 * `admin_metric` arrives (at most once per 5 s). Returns whether live updates are on.
 */
export function useAdminLive(): boolean {
  const socket = useJobStore((s) => s.socket)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!socket) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let pending = false
    const refresh = () =>
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "admin" && LIVE_PATHS.test(String(q.queryKey[1])),
      })
    const onMetric = () => {
      if (timer) {
        pending = true
        return
      }
      refresh()
      timer = setTimeout(() => {
        timer = null
        if (pending) {
          pending = false
          refresh()
        }
      }, THROTTLE_MS)
    }
    const join = () =>
      socket.emit("join_admin", {}, (ack: { joined?: boolean } | undefined) =>
        setLive(!!ack?.joined)
      )
    const onDisconnect = () => setLive(false)
    // Another admin saved prices, packs or plans.
    const onPricing = () =>
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "admin" && PRICING_PATHS.test(String(q.queryKey[1])),
      })
    socket.on("connect", join)
    socket.on("disconnect", onDisconnect)
    socket.on("admin_metric", onMetric)
    socket.on("pricing_updated", onPricing)
    if (socket.connected) join()
    return () => {
      socket.off("connect", join)
      socket.off("disconnect", onDisconnect)
      socket.off("admin_metric", onMetric)
      socket.off("pricing_updated", onPricing)
      if (timer) clearTimeout(timer)
    }
  }, [socket])

  return live
}
