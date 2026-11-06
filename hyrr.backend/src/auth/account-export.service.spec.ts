import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AccountExportService } from "./account-export.service"

const SECRET_FIELDS = ["passwordHash", "twoFactorSecret", "twoFactorRecoveryCodes", "tokenHash"]

/** Recursively collects every `select` key used in the Prisma calls. */
function selectedKeys(calls: any[][]): string[] {
  const keys: string[] = []
  const walk = (select: any) => {
    if (!select || typeof select !== "object") return
    for (const [key, value] of Object.entries(select)) {
      keys.push(key)
      if (value && typeof value === "object") walk((value as any).select ?? value)
    }
  }
  for (const [args] of calls) walk(args?.select)
  return keys
}

describe("AccountExportService", () => {
  let prisma: any
  let service: AccountExportService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    service = new AccountExportService(prisma)
    for (const model of [
      "document",
      "application",
      "message",
      "notification",
      "calendarEvent",
      "jobAlert",
      "savedSearch",
      "companyMember",
      "job",
    ]) {
      prisma[model].findMany.mockResolvedValue([])
    }
    prisma.seekerProfile.findUnique.mockResolvedValue(null)
    prisma.userSetting.findUnique.mockResolvedValue(null)
  })

  it("uses explicit selects and never exports secrets", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "A",
      email: "a@b.c",
      role: "RECRUITER",
      googleId: "g-123",
      githubId: null,
      linkedinId: null,
    })
    const data: any = await service.export("u1")

    const models = Object.keys(prisma).filter((k) => !k.startsWith("$"))
    for (const model of models) {
      for (const method of ["findUnique", "findMany", "findFirst"]) {
        const fn = prisma[model]?.[method]
        if (!fn?.mock) continue
        for (const [args] of fn.mock.calls) expect(args.select).toBeDefined()
        const keys = selectedKeys(fn.mock.calls)
        for (const secret of SECRET_FIELDS) expect(keys).not.toContain(secret)
      }
    }
    const json = JSON.stringify(data)
    expect(json).not.toContain("g-123")
    expect(data.profile.linkedAccounts).toEqual({ google: true, github: false, linkedin: false })
    // Recruiters also get their company + posted jobs.
    expect(data.companies).toEqual([])
    expect(data.postedJobs).toEqual([])
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recruiterId: "u1" } })
    )
  })

  it("seekers get no recruiter sections and application payloads skip ai/notes fields", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "SEEKER" })
    const data: any = await service.export("u1")
    expect(data.postedJobs).toBeUndefined()
    const select = prisma.application.findMany.mock.calls[0][0].select
    expect(Object.keys(select).some((k) => k.startsWith("ai"))).toBe(false)
    expect(select.recruiterNotes).toBeUndefined()
    expect(prisma.job.findMany).not.toHaveBeenCalled()
  })
})
