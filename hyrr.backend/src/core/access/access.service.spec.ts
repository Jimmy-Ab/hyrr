import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AccessService } from "./access.service"

describe("AccessService", () => {
  let prismaMock: any
  let access: AccessService

  const job = { id: "job-1", companyId: "co-1", recruiterId: "poster" }

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>()
    prismaMock.user.findUnique.mockResolvedValue({ companyId: null })
    access = new AccessService(prismaMock)
  })

  const member = (role: string) =>
    prismaMock.companyMember.findMany.mockResolvedValue([{ companyId: "co-1", role }])

  it("company VIEWER can view but not manage company applications", async () => {
    member("VIEWER")
    prismaMock.application.findUnique.mockResolvedValue({ id: "a", status: "APPLIED", job })
    const viewer = { userId: "v", role: "RECRUITER" }
    await expect(access.applicationFor(viewer, "a", "view")).resolves.toBeTruthy()
    await expect(access.applicationFor(viewer, "a", "manage")).rejects.toMatchObject({ status: 403 })
  })

  it("company RECRUITER (not the poster) can manage", async () => {
    member("RECRUITER")
    prismaMock.job.findUnique.mockResolvedValue(job)
    await expect(
      access.jobForManagement({ userId: "colleague", role: "RECRUITER" }, "job-1")
    ).resolves.toBeTruthy()
  })

  it("SAVED applications are invisible to recruiters", async () => {
    member("OWNER")
    prismaMock.application.findUnique.mockResolvedValue({ id: "a", status: "SAVED", job })
    await expect(
      access.applicationFor({ userId: "o", role: "RECRUITER" }, "a", "view")
    ).rejects.toMatchObject({ status: 404 })
  })

  it("seeker cannot delete a recruiter-scheduled interview but can delete their own event", async () => {
    prismaMock.calendarEvent.findUnique.mockResolvedValue({
      id: "e1",
      userId: "recruiter-1",
      application: { id: "a", userId: "seeker-1", job },
    })
    await expect(
      access.calendarEventFor({ userId: "seeker-1", role: "SEEKER" }, "e1")
    ).rejects.toMatchObject({ status: 403 })

    prismaMock.calendarEvent.findUnique.mockResolvedValue({ id: "e2", userId: "seeker-1" })
    await expect(
      access.calendarEventFor({ userId: "seeker-1", role: "SEEKER" }, "e2")
    ).resolves.toBeTruthy()
  })

  it("company recruiter can delete company interview events", async () => {
    member("RECRUITER")
    prismaMock.calendarEvent.findUnique.mockResolvedValue({
      id: "e1",
      userId: "someone-else",
      application: { id: "a", job },
    })
    prismaMock.application.findUnique.mockResolvedValue({ id: "a", status: "INTERVIEWING", job })
    await expect(
      access.calendarEventFor({ userId: "colleague", role: "RECRUITER" }, "e1")
    ).resolves.toBeTruthy()
  })
})
