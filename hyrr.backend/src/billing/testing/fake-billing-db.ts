/* Minimal stateful in-memory Prisma stand-in for billing unit tests (only what billing uses). */
import { randomUUID } from "crypto"

const tick = () => new Promise((resolve) => setImmediate(resolve))

const matches = (row: any, where: any = {}): boolean =>
  Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === "OR") return (cond as any[]).some((w) => matches(row, w))
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("gte" in cond) return row[key] >= cond.gte
      if ("in" in cond) return cond.in.includes(row[key])
      if ("not" in cond) return row[key] !== cond.not
      if ("some" in cond) return false
    }
    return row[key] === cond
  })

const p2002 = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" })

function table(rows: any[], unique: string[] = []) {
  const findUnique = async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null
  return {
    rows,
    findUnique: jest.fn(findUnique),
    findFirst: jest.fn(async ({ where }: any = {}) => rows.find((r) => matches(r, where)) ?? null),
    findMany: jest.fn(async ({ where }: any = {}) => rows.filter((r) => matches(r, where))),
    count: jest.fn(async ({ where }: any = {}) => rows.filter((r) => matches(r, where)).length),
    create: jest.fn(async ({ data }: any) => {
      for (const key of unique)
        if (data[key] != null && rows.some((r) => r[key] === data[key])) throw p2002()
      const row = { id: data.id ?? randomUUID(), createdAt: new Date(), ...data }
      rows.push(row)
      return row
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = rows.find((r) => matches(r, where))
      if (!row) throw Object.assign(new Error("Not found"), { code: "P2025" })
      apply(row, data)
      return row
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      // Await first, then check-and-write synchronously: models a row-level atomic UPDATE.
      await tick()
      const hit = rows.filter((r) => matches(r, where))
      hit.forEach((r) => apply(r, data))
      return { count: hit.length }
    }),
    upsert: jest.fn(async ({ where, create, update }: any) => {
      await tick()
      const row = rows.find((r) => matches(r, where))
      if (row) {
        apply(row, update)
        return row
      }
      const created = { id: randomUUID(), createdAt: new Date(), ...create }
      rows.push(created)
      return created
    }),
  }
}

function apply(row: any, data: any) {
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value && typeof value === "object" && "increment" in (value as any))
      row[key] += (value as any).increment
    else if (value && typeof value === "object" && "decrement" in (value as any))
      row[key] -= (value as any).decrement
    else row[key] = value
  }
}

export function fakeBillingDb() {
  const db: any = {
    creditWallet: table([], ["companyId"]),
    creditTransaction: table([]),
    creditPackage: table([]),
    plan: table([]),
    payment: table([], ["providerRef"]),
    subscription: table([], ["companyId", "providerSubscriptionId"]),
    company: table([]),
    user: table([]),
    companyMember: table([]),
    systemSetting: table([]),
    jobCategory: table([]),
  }
  db.$transaction = jest.fn(async (arg: any) => {
    if (typeof arg === "function") return arg(db)
    return Promise.all(arg)
  })
  return db
}
