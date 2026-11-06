import { Prisma } from "@prisma/client"
import { AuditService } from "./audit.service"
import { csvCell } from "./sql"

describe("AuditService", () => {
  const prisma: any = { auditLog: { create: jest.fn(), findMany: jest.fn() } }
  const audit = new AuditService(prisma)
  beforeEach(() => {
    prisma.auditLog.create.mockReset().mockResolvedValue({ id: "a1" })
    prisma.auditLog.findMany.mockReset()
  })

  it("records the reason inside meta, with ip and severity", async () => {
    await audit.record({
      actorId: "admin-1",
      action: "user.suspend",
      target: "user:u1",
      details: "Suspended a@b.c",
      reason: "Spam",
      meta: { before: { status: "ACTIVE" } },
      ip: "1.2.3.4",
      severity: "critical",
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "admin-1",
        action: "user.suspend",
        target: "user:u1",
        details: "Suspended a@b.c",
        meta: { before: { status: "ACTIVE" }, reason: "Spam" },
        ip: "1.2.3.4",
        severity: "critical",
      },
    })
  })

  it("writes through the given transaction client and defaults ip/meta", async () => {
    const tx: any = { auditLog: { create: jest.fn() } }
    await audit.record(
      { actorId: "a", action: "x", target: "pricing", details: "d", severity: "info" },
      tx
    )
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
      ip: "unknown",
      meta: Prisma.JsonNull,
    })
  })

  it("lists with filters and cursor pagination", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `r${i}`,
      user: { id: "a", name: "Ada", email: "ada@x.io" },
      action: "user.suspend",
      target: "user:u",
      details: "d",
      meta: null,
      ip: "ip",
      severity: "info",
      createdAt: new Date(),
    }))
    prisma.auditLog.findMany.mockResolvedValue(rows)
    const from = new Date("2026-01-01T00:00:00Z")
    const page = await audit.list({ actorId: "a", action: "user.suspend", from }, "c0", 2)
    const args = prisma.auditLog.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: "a", action: "user.suspend", createdAt: { gte: from } })
    expect(args).toMatchObject({ take: 3, cursor: { id: "c0" }, skip: 1 })
    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBe("r1")
    expect(page.items[0].actor).toEqual({ id: "a", name: "Ada", email: "ada@x.io" })
  })

  it("exports CSV with a header, the reason column and escaped cells", async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "r1",
        user: { id: "a", name: 'Ada "A"', email: "ada@x.io" },
        action: "company.credits",
        target: "company:c",
        details: "=HYPERLINK(1)",
        meta: { reason: "Goodwill, refund", amount: 5 },
        ip: "ip",
        severity: "warning",
        createdAt: new Date("2026-11-06T10:00:00.000Z"),
      },
    ])
    const csv = await audit.csv({})
    const [header, line] = csv.trim().split("\r\n")
    expect(header).toBe(
      '"createdAt","actorName","actorEmail","action","target","details","reason","severity","ip","meta"'
    )
    expect(line).toContain('"Ada ""A"""')
    expect(line).toContain(`"'=HYPERLINK(1)"`)
    expect(line).toContain('"Goodwill, refund"')
    expect(line.startsWith('"2026-11-06T10:00:00.000Z"')).toBe(true)
  })

  it("csvCell neutralises formula prefixes", () => {
    expect(csvCell("+1")).toBe(`"'+1"`)
    expect(csvCell("@x")).toBe(`"'@x"`)
    expect(csvCell(null)).toBe('""')
  })
})
