import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { ScreeningService } from "./screening.service"

describe("ScreeningService (R1)", () => {
  let prisma: any
  let access: any
  let service: ScreeningService
  const recruiter = { userId: "rec-1", role: "RECRUITER" }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) =>
      typeof fn === "function" ? fn(prisma) : Promise.all(fn)
    )
    access = {
      jobForView: jest.fn().mockResolvedValue({ id: "job-1" }),
      jobForManagement: jest.fn().mockResolvedValue({ id: "job-1" }),
    }
    service = new ScreeningService(prisma, access)
  })

  describe("list", () => {
    it("is public for ACTIVE jobs", async () => {
      prisma.job.findUnique.mockResolvedValue({ status: "ACTIVE" })
      prisma.screeningQuestion.findMany.mockResolvedValue([{ id: "q1" }])
      await expect(service.list("job-1", null)).resolves.toEqual([{ id: "q1" }])
      expect(access.jobForView).not.toHaveBeenCalled()
    })

    it("hides questions of non-active jobs from the public, shows them to recruiters with view access", async () => {
      prisma.job.findUnique.mockResolvedValue({ status: "DRAFT" })
      prisma.screeningQuestion.findMany.mockResolvedValue([])
      await expect(service.list("job-1", null)).rejects.toMatchObject({
        errorCode: "JOB_NOT_FOUND",
      })
      await expect(
        service.list("job-1", { userId: "s", role: "SEEKER" })
      ).rejects.toMatchObject({ status: 404 })
      await service.list("job-1", recruiter)
      expect(access.jobForView).toHaveBeenCalledWith(recruiter, "job-1")
    })
  })

  describe("replace", () => {
    it("keeps known ids, deletes removed ones, creates new ones in array order", async () => {
      prisma.screeningQuestion.findMany
        .mockResolvedValueOnce([{ id: "q1" }, { id: "q2" }, { id: "q3" }])
        .mockResolvedValueOnce([{ id: "q3" }, { id: "new" }])
      const result = await service.replace("job-1", recruiter, [
        { id: "q3", question: "Kept?", required: true },
        { question: "Brand new", required: false },
        { id: "ghost", question: "Unknown id is new", required: false },
      ])
      expect(access.jobForManagement).toHaveBeenCalledWith(recruiter, "job-1")
      expect(prisma.screeningQuestion.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["q1", "q2"] } },
      })
      expect(prisma.screeningQuestion.update).toHaveBeenCalledWith({
        where: { id: "q3" },
        data: { question: "Kept?", required: true, position: 0 },
      })
      expect(prisma.screeningQuestion.create).toHaveBeenCalledTimes(2)
      expect(prisma.screeningQuestion.create).toHaveBeenCalledWith({
        data: { question: "Brand new", required: false, position: 1, jobId: "job-1" },
      })
      expect(prisma.screeningQuestion.create).toHaveBeenCalledWith({
        data: { question: "Unknown id is new", required: false, position: 2, jobId: "job-1" },
      })
      expect(result).toEqual([{ id: "q3" }, { id: "new" }])
    })

    it("an empty list removes every question", async () => {
      prisma.screeningQuestion.findMany.mockResolvedValueOnce([{ id: "q1" }]).mockResolvedValue([])
      await service.replace("job-1", recruiter, [])
      expect(prisma.screeningQuestion.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["q1"] } },
      })
    })

    it("requires manage access", async () => {
      access.jobForManagement.mockRejectedValue(Object.assign(new Error("no"), { status: 403 }))
      await expect(service.replace("job-1", recruiter, [])).rejects.toMatchObject({ status: 403 })
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe("validateAnswers", () => {
    beforeEach(() => {
      prisma.screeningQuestion.findMany.mockResolvedValue([
        { id: "q1", required: true },
        { id: "q2", required: false },
        { id: "q3", required: true },
      ])
    })

    it("400 SCREENING_ANSWERS_REQUIRED lists the missing required question ids", async () => {
      const err: any = await service
        .validateAnswers("job-1", [
          { questionId: "q1", answer: "yes" },
          { questionId: "q3", answer: "   " },
        ])
        .catch((e) => e)
      expect(err.status).toBe(400)
      expect(err.errorCode).toBe("SCREENING_ANSWERS_REQUIRED")
      expect(err.details).toEqual(["q3"])
    })

    it("returns trimmed answers for known questions and drops unknown ones", async () => {
      const result = await service.validateAnswers("job-1", [
        { questionId: "q1", answer: " yes " },
        { questionId: "q3", answer: "EU citizen" },
        { questionId: "zzz", answer: "ignored" },
      ])
      expect(result).toEqual([
        { questionId: "q1", answer: "yes" },
        { questionId: "q3", answer: "EU citizen" },
      ])
    })

    it("jobs without questions accept anything", async () => {
      prisma.screeningQuestion.findMany.mockResolvedValue([])
      await expect(service.validateAnswers("job-1", undefined)).resolves.toEqual([])
    })
  })
})
