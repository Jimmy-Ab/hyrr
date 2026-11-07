import { Injectable, Logger } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { pageArgs, pageOf } from "./pagination"
import { csvRow } from "./sql"

export type AuditSeverity = "info" | "warning" | "critical"

export type AuditEntry = {
  actorId: string
  /** Dotted verb, e.g. `user.suspend`, `company.credits`, `job.remove`. */
  action: string
  /** `<kind>:<id>`, e.g. `user:…`, `company:…`, `job:…`, `package:…`, `plan:STARTER`, `pricing`. */
  target: string
  /** Human sentence shown in the audit log. */
  details: string
  reason?: string | null
  /** Structured context (before/after values, ids). The reason is merged in. */
  meta?: Record<string, unknown> | null
  ip?: string | null
  severity: AuditSeverity
}

export type AuditFilters = { actorId?: string; action?: string; from?: Date; to?: Date }

/** Max rows of one CSV export. */
export const AUDIT_CSV_MAX_ROWS = 10_000

const ACTOR_SELECT = { id: true, name: true, email: true } as const

type Db = Pick<Prisma.TransactionClient, "auditLog">

/** Writes and reads the admin audit trail (`AuditLog`). Every admin mutation records one row. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  /** Appends an audit row; pass `tx` to write it inside the action's transaction. */
  async record(entry: AuditEntry, tx?: Db) {
    const db: Db = tx ?? this.prisma
    const meta = { ...(entry.meta ?? {}), ...(entry.reason ? { reason: entry.reason } : {}) }
    return db.auditLog.create({
      data: {
        userId: entry.actorId,
        action: entry.action,
        target: entry.target,
        details: entry.details,
        meta: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
        ip: entry.ip || "unknown",
        severity: entry.severity,
      },
    })
  }

  private where(filters: AuditFilters): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {}
    if (filters.actorId) where.userId = filters.actorId
    if (filters.action) where.action = filters.action
    if (filters.from || filters.to)
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lt: filters.to } : {}),
      }
    return where
  }

  async list(filters: AuditFilters, cursor?: string, limit?: number) {
    const rows = await this.prisma.auditLog.findMany({
      where: this.where(filters),
      include: { user: { select: ACTOR_SELECT } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(cursor, limit),
    })
    return pageOf(rows.map(toItem), limit)
  }

  /** Last `take` rows about one target (e.g. `user:<id>`). */
  async forTarget(target: string, take = 10) {
    const rows = await this.prisma.auditLog.findMany({
      where: { target },
      include: { user: { select: ACTOR_SELECT } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    })
    return rows.map(toItem)
  }

  async csv(filters: AuditFilters): Promise<string> {
    const rows = await this.prisma.auditLog.findMany({
      where: this.where(filters),
      include: { user: { select: ACTOR_SELECT } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: AUDIT_CSV_MAX_ROWS,
    })
    const header = csvRow([
      "createdAt",
      "actorName",
      "actorEmail",
      "action",
      "target",
      "details",
      "reason",
      "severity",
      "ip",
      "meta",
    ])
    const lines = rows.map((r) => {
      const meta = (r.meta ?? null) as Record<string, unknown> | null
      return csvRow([
        r.createdAt,
        r.user?.name,
        r.user?.email,
        r.action,
        r.target,
        r.details,
        meta && typeof meta === "object" ? (meta.reason ?? "") : "",
        r.severity,
        r.ip,
        meta,
      ])
    })
    return [header, ...lines].join("\r\n") + "\r\n"
  }
}

function toItem(r: any) {
  return {
    id: r.id,
    actor: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
    action: r.action,
    target: r.target,
    details: r.details,
    meta: r.meta ?? null,
    ip: r.ip,
    severity: r.severity,
    createdAt: r.createdAt,
  }
}
