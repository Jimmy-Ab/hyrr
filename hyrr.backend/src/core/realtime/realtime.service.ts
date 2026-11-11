import { Injectable } from "@nestjs/common"
import type { Server } from "socket.io"

export const ADMIN_ROOM = "admin"
export type AdminMetricKind =
  "application" | "signup" | "job_published" | "payment" | "credit_tx" | "placement"

/**
 * Socket server handle for modules that can't depend on MessagesGateway (auth, billing, jobs):
 * the gateway attaches its server on start. Every call is a no-op until then (tests, scripts).
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null

  attach(server: Server) {
    this.server = server
  }

  /** Refresh hint for signed-in admins with 2FA (no personal data). */
  adminMetric(kind: AdminMetricKind, data: Record<string, any> = {}) {
    try {
      this.server
        ?.to(ADMIN_ROOM)
        .emit("admin_metric", { kind, at: new Date().toISOString(), ...data })
    } catch {
      // live hints are best effort
    }
  }

  /**
   * Refresh hint for every connected client (no personal data): prices, packs and plans changed,
   * so the apps refetch `GET /billing/pricing` and the catalog.
   */
  pricingUpdated() {
    try {
      this.server?.emit("pricing_updated", { at: new Date().toISOString() })
    } catch {
      // live hints are best effort
    }
  }
}
