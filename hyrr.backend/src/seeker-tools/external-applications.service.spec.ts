import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { EXTERNAL_LIMIT, ExternalApplicationsService } from "./external-applications.service"

const code = (p: Promise<unknown>) => p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)

describe("ExternalApplicationsService", () => {
  let prisma: any
  let service: ExternalApplicationsService
  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    service = new ExternalApplicationsService(prisma)
  })

  it("creates with APPLIED by default and caps the list", async () => {
    prisma.externalApplication.count.mockResolvedValue(0)
    await service.create("u1", { company: "Stripe", title: "Engineer" })
    expect(prisma.externalApplication.create.mock.calls[0][0].data).toMatchObject({
      userId: "u1",
      stage: "APPLIED",
      url: null,
    })
    prisma.externalApplication.count.mockResolvedValue(EXTERNAL_LIMIT)
    expect(await code(service.create("u1", { company: "X", title: "Y" }))).toBe("EXTERNAL_LIMIT")
  })

  it("only the owner can change or delete an entry", async () => {
    prisma.externalApplication.findUnique.mockResolvedValue({ id: "e1", userId: "someone-else" })
    expect(await code(service.update("u1", "e1", { stage: "OFFER" }))).toBe("EXTERNAL_NOT_FOUND")
    expect(await code(service.remove("u1", "e1"))).toBe("EXTERNAL_NOT_FOUND")
    expect(prisma.externalApplication.update).not.toHaveBeenCalled()
  })

  it("updates only the fields sent; empty strings clear optional fields", async () => {
    prisma.externalApplication.findUnique.mockResolvedValue({ id: "e1", userId: "u1" })
    await service.update("u1", "e1", { stage: "INTERVIEWING", url: "" })
    expect(prisma.externalApplication.update.mock.calls[0][0].data).toEqual({
      stage: "INTERVIEWING",
      url: null,
    })
  })
})
