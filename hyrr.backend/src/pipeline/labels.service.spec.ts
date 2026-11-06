import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { LabelsService, MAX_LABELS_PER_COMPANY } from "./labels.service"

describe("LabelsService (R3)", () => {
  let prisma: any
  let access: any
  let service: LabelsService
  const owner = { userId: "rec-1", role: "RECRUITER", companyId: "co-1" }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) =>
      typeof fn === "function" ? fn(prisma) : Promise.all(fn)
    )
    prisma.companyMember.findUnique.mockResolvedValue({ role: "OWNER" })
    access = {
      applicationFor: jest.fn().mockResolvedValue({ id: "app-1", job: { companyId: "co-1" } }),
    }
    service = new LabelsService(prisma, access)
  })

  it("lists only the caller's company labels with counts", async () => {
    prisma.candidateLabel.findMany.mockResolvedValue([
      { id: "l1", name: "Top", color: "green", _count: { applications: 3 } },
    ])
    await expect(service.list(owner)).resolves.toEqual([
      { id: "l1", name: "Top", color: "green", count: 3 },
    ])
    expect(prisma.candidateLabel.findMany.mock.calls[0][0].where).toEqual({ companyId: "co-1" })
  })

  it("viewers cannot create labels", async () => {
    prisma.companyMember.findUnique.mockResolvedValue({ role: "VIEWER" })
    await expect(service.create(owner, { name: "x", color: "red" })).rejects.toMatchObject({
      status: 403,
    })
  })

  it("409 LABEL_LIMIT at the company cap", async () => {
    prisma.candidateLabel.count.mockResolvedValue(MAX_LABELS_PER_COMPANY)
    await expect(service.create(owner, { name: "x", color: "red" })).rejects.toMatchObject({
      status: 409,
      errorCode: "LABEL_LIMIT",
    })
  })

  it("cannot rename or delete another company's label (404 LABEL_NOT_FOUND)", async () => {
    prisma.candidateLabel.findFirst.mockResolvedValue(null)
    await expect(service.update(owner, "foreign", { name: "x" })).rejects.toMatchObject({
      errorCode: "LABEL_NOT_FOUND",
    })
    await expect(service.remove(owner, "foreign")).rejects.toMatchObject({
      errorCode: "LABEL_NOT_FOUND",
    })
    expect(prisma.candidateLabel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "foreign", companyId: "co-1" } })
    )
    expect(prisma.candidateLabel.delete).not.toHaveBeenCalled()
  })

  describe("setForApplication", () => {
    it("replaces the set: removes others, adds missing, returns labels sorted by name", async () => {
      prisma.candidateLabel.findMany.mockResolvedValue([
        { id: "l2", name: "Zeta", color: "red" },
        { id: "l1", name: "Alpha", color: "green" },
      ])
      const result = await service.setForApplication(owner, "app-1", ["l1", "l2", "l1"])
      expect(access.applicationFor).toHaveBeenCalledWith(owner, "app-1", "manage")
      expect(prisma.candidateLabel.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ["l1", "l2"] },
        companyId: "co-1",
      })
      expect(prisma.applicationLabel.deleteMany).toHaveBeenCalledWith({
        where: { applicationId: "app-1", labelId: { notIn: ["l1", "l2"] } },
      })
      expect(prisma.applicationLabel.createMany).toHaveBeenCalledWith({
        data: [
          { applicationId: "app-1", labelId: "l1" },
          { applicationId: "app-1", labelId: "l2" },
        ],
        skipDuplicates: true,
      })
      expect(result.labels.map((l) => l.name)).toEqual(["Alpha", "Zeta"])
    })

    it("an empty list clears every label", async () => {
      const result = await service.setForApplication(owner, "app-1", [])
      expect(prisma.applicationLabel.deleteMany).toHaveBeenCalledWith({
        where: { applicationId: "app-1", labelId: { notIn: [] } },
      })
      expect(prisma.applicationLabel.createMany).not.toHaveBeenCalled()
      expect(result).toEqual({ labels: [] })
    })

    it("rejects labels of another company (application's company decides)", async () => {
      prisma.candidateLabel.findMany.mockResolvedValue([{ id: "l1", name: "A", color: "red" }])
      await expect(
        service.setForApplication(owner, "app-1", ["l1", "other-company-label"])
      ).rejects.toMatchObject({ errorCode: "LABEL_NOT_FOUND" })
      expect(prisma.applicationLabel.deleteMany).not.toHaveBeenCalled()
    })
  })
})
