import { ConflictException } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AppException } from "../core/exceptions/app-exception"
import { ScreeningService } from "../pipeline/screening.service"
import { ApplicationsService } from "./applications.service"

/** Phase 3: answers on apply (R1), bulk (R4), timeline (R5), payload (R6), source (R8). */
describe("ApplicationsService – pipeline", () => {
  let prisma: any
  let access: any
  let labels: any
  let messages: any
  let notifications: any
  let service: ApplicationsService
  const recruiter = { userId: "rec-1", role: "RECRUITER" }
  const seeker = { userId: "seeker-1", role: "SEEKER", email: "s@example.com" }
  const activeJob = { id: "job-1", status: "ACTIVE", title: "Engineer", recruiterId: "rec-1" }
  const applyDto = { name: "Sam", email: "s@example.com", title: "Dev", location: "Berlin" }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) =>
      typeof fn === "function" ? fn(prisma) : Promise.all(fn)
    )
    prisma.user.findUnique.mockResolvedValue({ emailVerifiedAt: new Date() })
    prisma.screeningQuestion.findMany.mockResolvedValue([])
    access = {
      applicationFor: jest.fn(),
      jobForManagement: jest.fn().mockResolvedValue({ id: "job-1" }),
      jobForView: jest.fn(),
      jobScopeWhere: jest.fn().mockResolvedValue({}),
    }
    labels = {
      labelForCompany: jest.fn().mockResolvedValue({ id: "l1" }),
      addToApplication: jest.fn(),
      removeFromApplication: jest.fn(),
    }
    messages = { createMessage: jest.fn().mockResolvedValue({ id: "m1" }) }
    notifications = { createNotification: jest.fn().mockResolvedValue({}) }
    const screening = new ScreeningService(prisma, access)
    service = new ApplicationsService(
      prisma,
      notifications,
      access,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      screening,
      labels,
      messages
    )
  })

  describe("source on every create path (R8)", () => {
    beforeEach(() => prisma.job.findUnique.mockResolvedValue(activeJob))

    it("guest → GUEST", async () => {
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.application.create.mockResolvedValue({ id: "a", status: "APPLIED" })
      await service.applyToJob("job-1", applyDto, null)
      expect(prisma.application.create.mock.calls[0][0].data.source).toBe("GUEST")
    })

    it("signed-in seeker → DIRECT (new and SAVED upgrade)", async () => {
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.application.create.mockResolvedValue({ id: "a" })
      await service.applyToJob("job-1", applyDto, seeker)
      expect(prisma.application.create.mock.calls[0][0].data.source).toBe("DIRECT")

      prisma.application.findFirst.mockResolvedValue({ id: "saved", status: "SAVED" })
      await service.applyToJob("job-1", applyDto, seeker)
      expect(prisma.application.update.mock.calls[0][0].data.source).toBe("DIRECT")
    })

    it("recruiter-added → RECRUITER_ADDED", async () => {
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.application.create.mockResolvedValue({ id: "c" })
      await service.createCandidate("job-1", { candidateName: "Ada", email: "a@x.io" }, recruiter)
      expect(prisma.application.create.mock.calls[0][0].data.source).toBe("RECRUITER_ADDED")
    })
  })

  describe("screening answers on apply (R1)", () => {
    beforeEach(() => {
      prisma.job.findUnique.mockResolvedValue(activeJob)
      prisma.application.findFirst.mockResolvedValue(null)
      prisma.screeningQuestion.findMany.mockResolvedValue([
        { id: "q1", required: true },
        { id: "q2", required: false },
      ])
    })

    it("rejects a missing required answer before anything is written", async () => {
      await expect(service.applyToJob("job-1", applyDto, null)).rejects.toMatchObject({
        status: 400,
        errorCode: "SCREENING_ANSWERS_REQUIRED",
        details: ["q1"],
      })
      expect(prisma.application.create).not.toHaveBeenCalled()
    })

    it("stores answers in the apply transaction", async () => {
      prisma.application.create.mockResolvedValue({ id: "app-9", status: "APPLIED" })
      await service.applyToJob(
        "job-1",
        { ...applyDto, answers: [{ questionId: "q1", answer: "Yes" }] },
        null
      )
      expect(prisma.$transaction).toHaveBeenCalled()
      expect(prisma.screeningAnswer.createMany).toHaveBeenCalledWith({
        data: [{ applicationId: "app-9", questionId: "q1", answer: "Yes" }],
      })
      expect(JSON.stringify(prisma.application.create.mock.calls[0][0])).not.toContain("answers")
    })
  })

  describe("candidate payload (R6)", () => {
    it("flattens labels, notes count and screening answers from one query", async () => {
      prisma.application.findMany.mockResolvedValue([
        {
          id: "a1",
          source: "GUEST",
          labels: [{ label: { id: "l1", name: "Top", color: "green" } }],
          answers: [{ questionId: "q1", answer: "Yes", question: { question: "Permit?" } }],
          _count: { recruiterNotes: 2 },
        },
      ])
      const [c]: any[] = await service.getCandidatesForJob("job-1", recruiter, {}, "l1")
      expect(c).toEqual({
        id: "a1",
        source: "GUEST",
        labels: [{ id: "l1", name: "Top", color: "green" }],
        notesCount: 2,
        screeningAnswers: [{ questionId: "q1", question: "Permit?", answer: "Yes" }],
      })
      const args = prisma.application.findMany.mock.calls[0][0]
      expect(args.where.labels).toEqual({ some: { labelId: "l1" } })
      expect(args.include._count).toEqual({ select: { recruiterNotes: true } })
      expect(prisma.application.findMany).toHaveBeenCalledTimes(1)
    })
  })

  describe("timeline (R5)", () => {
    const events = [
      { toStatus: "APPLIED", actorId: "seeker-1", createdAt: new Date("2026-01-01") },
      { toStatus: "INTERVIEWING", actorId: "rec-1", createdAt: new Date("2026-01-05") },
    ]
    beforeEach(() => {
      access.applicationFor.mockResolvedValue({ id: "a1" })
      prisma.applicationStageEvent.findMany.mockResolvedValue(events)
      prisma.user.findMany.mockResolvedValue([
        { id: "seeker-1", name: "Sam" },
        { id: "rec-1", name: "Rita Recruiter" },
      ])
    })

    it("seekers get status, label and at only", async () => {
      const result = await service.getTimeline("a1", seeker)
      expect(result).toEqual([
        { status: "APPLIED", label: "Applied", at: events[0].createdAt },
        { status: "INTERVIEWING", label: "Interviewing", at: events[1].createdAt },
      ])
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })

    it("recruiters also see actor names", async () => {
      const result: any[] = await service.getTimeline("a1", recruiter)
      expect(result[1]).toEqual({
        status: "INTERVIEWING",
        label: "Interviewing",
        at: events[1].createdAt,
        actor: { name: "Rita Recruiter" },
      })
    })
  })

  describe("bulk (R4)", () => {
    const appRow = (id: string, status: string) => ({
      id,
      status,
      userId: null,
      email: `${id}@x.io`,
      job: { companyId: "co-1", title: "Eng", recruiterId: "rec-1" },
    })

    it("MOVE: partial success, withdrawn items fail with APPLICATION_WITHDRAWN", async () => {
      access.applicationFor.mockImplementation(async (_a: any, id: string) => {
        if (id === "missing") throw Object.assign(new Error("nf"), { errorCode: "NOT_FOUND" })
        return appRow(id, id === "w" ? "WITHDRAWN" : "APPLIED")
      })
      prisma.application.update.mockImplementation(async ({ where }: any) => ({
        id: where.id,
        userId: null,
        email: null,
        job: { title: "Eng" },
      }))
      const { results } = await service.bulkUpdate(
        { applicationIds: ["a", "w", "missing", "a"], action: "MOVE", status: "INTERVIEWING" },
        recruiter
      )
      expect(results).toEqual([
        { applicationId: "a", ok: true },
        { applicationId: "w", ok: false, error: "APPLICATION_WITHDRAWN" },
        { applicationId: "missing", ok: false, error: "NOT_FOUND" },
      ])
      expect(prisma.applicationStageEvent.create).toHaveBeenCalledTimes(1)
    })

    it("MESSAGE skips withdrawn conversations (CONVERSATION_CLOSED)", async () => {
      access.applicationFor.mockImplementation(async (_a: any, id: string) => appRow(id, "APPLIED"))
      messages.createMessage.mockImplementation(async (id: string) => {
        if (id === "w") throw new AppException("closed", 409, "CONVERSATION_CLOSED")
        return { id: "m" }
      })
      const { results } = await service.bulkUpdate(
        { applicationIds: ["a", "w"], action: "MESSAGE", message: "Hello" },
        recruiter
      )
      expect(results).toEqual([
        { applicationId: "a", ok: true },
        { applicationId: "w", ok: false, error: "CONVERSATION_CLOSED" },
      ])
      expect(messages.createMessage).toHaveBeenCalledWith("a", recruiter, "Hello", {
        clientId: null,
      })
    })

    it("ADD_LABEL checks the label belongs to the application's company", async () => {
      access.applicationFor.mockImplementation(async (_a: any, id: string) => appRow(id, "APPLIED"))
      labels.labelForCompany.mockImplementation(async (labelId: string) => {
        if (labelId !== "l1") throw new AppException("nf", 404, "LABEL_NOT_FOUND")
        return { id: "l1" }
      })
      const ok = await service.bulkUpdate(
        { applicationIds: ["a"], action: "ADD_LABEL", labelId: "l1" },
        recruiter
      )
      expect(ok.results[0].ok).toBe(true)
      expect(labels.labelForCompany).toHaveBeenCalledWith("l1", "co-1")
      expect(labels.addToApplication).toHaveBeenCalledWith("a", "l1")
      const bad = await service.bulkUpdate(
        { applicationIds: ["a"], action: "REMOVE_LABEL", labelId: "foreign" },
        recruiter
      )
      expect(bad.results[0]).toEqual({ applicationId: "a", ok: false, error: "LABEL_NOT_FOUND" })
    })

    it("maps plain Nest exceptions to stable codes", async () => {
      access.applicationFor.mockRejectedValue(new ConflictException())
      const { results } = await service.bulkUpdate(
        { applicationIds: ["a"], action: "ARCHIVE" },
        recruiter
      )
      expect(results[0].error).toBe("CONFLICT")
    })

    it("400 when the action's parameter is missing", async () => {
      await expect(
        service.bulkUpdate({ applicationIds: ["a"], action: "MOVE" }, recruiter)
      ).rejects.toMatchObject({ status: 400 })
      await expect(
        service.bulkUpdate({ applicationIds: ["a"], action: "ADD_LABEL" }, recruiter)
      ).rejects.toMatchObject({ status: 400 })
    })
  })
})
