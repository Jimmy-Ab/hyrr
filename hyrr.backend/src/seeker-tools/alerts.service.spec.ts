import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { jobMatchesAlert } from "./alert-matching"
import { AlertsScheduler } from "./alerts.scheduler"
import { AlertsService, MAX_ALERTS_PER_USER } from "./alerts.service"

const job = (over: Record<string, any> = {}) => ({
  id: "job-1",
  title: "React Developer",
  description: "Build UIs",
  skills: ["React"],
  requirements: ["TypeScript experience"],
  location: "Berlin, Germany",
  remote: false,
  type: "FULL_TIME",
  status: "ACTIVE",
  recruiterId: "rec-1",
  createdAt: new Date("2026-11-04T10:00:00Z"),
  company: { name: "Acme" },
  ...over,
})

const alert = (over: Record<string, any> = {}) => ({
  id: "a1",
  userId: "u1",
  name: "React",
  keywords: [],
  locations: [],
  jobTypes: [],
  minSalary: null,
  remoteOnly: false,
  frequency: "DAILY",
  active: true,
  lastSentAt: null,
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  ...over,
})

describe("jobMatchesAlert", () => {
  const base = { keywords: [], locations: [], jobTypes: [], remoteOnly: false }
  const j = job() as any

  it("matches keywords in title/description/skills/requirements, case-insensitively", () => {
    expect(jobMatchesAlert(j, { ...base, keywords: ["REACT"] })).toBe(true)
    expect(jobMatchesAlert(j, { ...base, keywords: ["typescript"] })).toBe(true)
    expect(jobMatchesAlert(j, { ...base, keywords: ["cobol", "uis"] })).toBe(true)
    expect(jobMatchesAlert(j, { ...base, keywords: ["cobol"] })).toBe(false)
  })

  it("matches locations by substring or remote", () => {
    expect(jobMatchesAlert(j, { ...base, locations: ["berlin"] })).toBe(true)
    expect(jobMatchesAlert(j, { ...base, locations: ["Paris"] })).toBe(false)
    expect(jobMatchesAlert(j, { ...base, locations: ["Paris", "Remote"] })).toBe(false)
    expect(
      jobMatchesAlert({ ...j, remote: true }, { ...base, locations: ["Paris", "remote"] })
    ).toBe(true)
  })

  it("filters by job type (enum or legacy label) and remoteOnly", () => {
    expect(jobMatchesAlert(j, { ...base, jobTypes: ["FULL_TIME"] })).toBe(true)
    expect(jobMatchesAlert(j, { ...base, jobTypes: ["Full Time"] })).toBe(true)
    expect(jobMatchesAlert(j, { ...base, jobTypes: ["CONTRACT"] })).toBe(false)
    expect(jobMatchesAlert(j, { ...base, remoteOnly: true })).toBe(false)
    expect(jobMatchesAlert({ ...j, remote: true }, { ...base, remoteOnly: true })).toBe(true)
  })
})

describe("AlertsService", () => {
  let prisma: any
  let email: any
  let gateway: any
  let service: AlertsService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    email = { send: jest.fn().mockResolvedValue({ delivered: false }) }
    gateway = { emitNotification: jest.fn() }
    service = new AlertsService(prisma, email, gateway)
    prisma.notification.createManyAndReturn.mockImplementation(async ({ data }: any) =>
      data.map((d: any, i: number) => ({ id: `n${i}`, ...d }))
    )
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "u1@x.io", name: "U1", setting: null },
    ])
  })

  describe("CRUD", () => {
    it("creates an alert with defaults", async () => {
      prisma.jobAlert.count.mockResolvedValue(0)
      prisma.jobAlert.create.mockResolvedValue({ id: "a1" })
      await service.create("u1", { name: "React", frequency: "DAILY" } as any)
      expect(prisma.jobAlert.create.mock.calls[0][0].data).toEqual({
        userId: "u1",
        name: "React",
        keywords: [],
        locations: [],
        jobTypes: [],
        remoteOnly: false,
        frequency: "DAILY",
      })
    })

    it(`rejects more than ${MAX_ALERTS_PER_USER} alerts with 409 ALERT_LIMIT`, async () => {
      prisma.jobAlert.count.mockResolvedValue(MAX_ALERTS_PER_USER)
      await expect(
        service.create("u1", { name: "x", frequency: "DAILY" } as any)
      ).rejects.toMatchObject({ status: 409, errorCode: "ALERT_LIMIT" })
      expect(prisma.jobAlert.create).not.toHaveBeenCalled()
    })

    it("only lets the owner update or delete an alert", async () => {
      prisma.jobAlert.findFirst.mockResolvedValue(null)
      await expect(service.update("u2", "a1", { active: false })).rejects.toMatchObject({
        status: 404,
        errorCode: "ALERT_NOT_FOUND",
      })
      await expect(service.remove("u2", "a1")).rejects.toMatchObject({ status: 404 })
      expect(prisma.jobAlert.findFirst.mock.calls[0][0].where).toEqual({ id: "a1", userId: "u2" })
      expect(prisma.jobAlert.update).not.toHaveBeenCalled()
      expect(prisma.jobAlert.delete).not.toHaveBeenCalled()

      prisma.jobAlert.findFirst.mockResolvedValue({ id: "a1" })
      prisma.jobAlert.update.mockResolvedValue({ id: "a1", active: false })
      await service.update("u1", "a1", { active: false, keywords: ["go"] })
      expect(prisma.jobAlert.update.mock.calls[0][0].data).toEqual({
        active: false,
        keywords: ["go"],
      })
    })
  })

  describe("sendInstant (INSTANT)", () => {
    it("notifies each matching user once, with one notification batch and e-mail", async () => {
      prisma.job.findUnique.mockResolvedValue(job())
      prisma.jobAlert.findMany.mockResolvedValue([
        alert({ id: "a1", userId: "u1", keywords: ["react"] }),
        alert({ id: "a2", userId: "u1", keywords: [] }),
        alert({ id: "a3", userId: "u2", keywords: ["cobol"] }),
      ])
      const count = await service.sendInstant("job-1")
      expect(count).toBe(1)
      const where = prisma.jobAlert.findMany.mock.calls[0][0].where
      expect(where.frequency).toBe("INSTANT")
      expect(where.userId).toEqual({ not: "rec-1" })
      expect(where.remoteOnly).toBe(false)
      const data = prisma.notification.createManyAndReturn.mock.calls[0][0].data
      expect(data).toHaveLength(1)
      expect(data[0]).toMatchObject({ userId: "u1", type: "JOB_ALERT", actionView: "DISCOVER" })
      expect(gateway.emitNotification).toHaveBeenCalledTimes(1)
      expect(email.send).toHaveBeenCalledTimes(1)
      expect(email.send.mock.calls[0][0].to).toBe("u1@x.io")
    })

    it.each(["FLAGGED", "DRAFT", "CLOSED"])("never announces %s jobs", async (status) => {
      prisma.job.findUnique.mockResolvedValue(job({ status }))
      expect(await service.sendInstant("job-1")).toBe(0)
      expect(prisma.jobAlert.findMany).not.toHaveBeenCalled()
    })

    it("respects jobRecommendations / emailNotifications preferences", async () => {
      prisma.job.findUnique.mockResolvedValue(job())
      prisma.jobAlert.findMany.mockResolvedValue([
        alert({ userId: "u1" }),
        alert({ id: "a2", userId: "u2" }),
      ])
      prisma.user.findMany.mockResolvedValue([
        {
          id: "u1",
          email: "u1@x.io",
          name: "U1",
          setting: { jobRecommendations: false, emailNotifications: true },
        },
        {
          id: "u2",
          email: "u2@x.io",
          name: "U2",
          setting: { jobRecommendations: true, emailNotifications: false },
        },
      ])
      expect(await service.sendInstant("job-1")).toBe(1)
      expect(
        prisma.notification.createManyAndReturn.mock.calls[0][0].data.map((d: any) => d.userId)
      ).toEqual(["u2"])
      expect(email.send).not.toHaveBeenCalled()
    })
  })

  describe("onJobPublished", () => {
    it("enqueues alerts:instant deduped per job", async () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) }
      const queued = new AlertsService(prisma, email, gateway, queue as any)
      await queued.onJobPublished("job-1")
      expect(queue.add).toHaveBeenCalledWith(
        "alerts",
        "instant",
        { jobId: "job-1" },
        { jobId: "instant:job-1" }
      )
      expect(prisma.job.findUnique).not.toHaveBeenCalled()
    })

    it("fans out directly without a queue", async () => {
      prisma.job.findUnique.mockResolvedValue(job({ status: "DRAFT" }))
      await service.onJobPublished("job-1")
      expect(prisma.job.findUnique).toHaveBeenCalled()
    })
  })

  describe("runDigest", () => {
    it("sends only jobs created since lastSentAt and updates lastSentAt", async () => {
      const lastSentAt = new Date("2026-11-03T08:00:00Z")
      prisma.jobAlert.findMany.mockResolvedValueOnce([alert({ lastSentAt, keywords: ["react"] })])
      prisma.job.findMany.mockResolvedValue([
        job({ id: "new", createdAt: new Date("2026-11-04T07:00:00Z") }),
        job({ id: "old", createdAt: new Date("2026-11-02T07:00:00Z") }),
        job({
          id: "other",
          title: "Accountant",
          skills: [],
          requirements: [],
          description: "",
          createdAt: new Date("2026-11-04T06:00:00Z"),
        }),
        job({ id: "own", recruiterId: "u1", createdAt: new Date("2026-11-04T05:00:00Z") }),
      ])

      const result = await service.runDigest("DAILY")
      expect(result).toEqual({ alerts: 1, users: 1 })
      const alertWhere = prisma.jobAlert.findMany.mock.calls[0][0].where
      expect(alertWhere).toMatchObject({ active: true, frequency: "DAILY" })
      expect(prisma.job.findMany.mock.calls[0][0].where.status).toBe("ACTIVE")
      expect(prisma.job.findMany.mock.calls[0][0].where.OR).toEqual([
        { publishedAt: { gt: lastSentAt, lte: expect.any(Date) } },
        { publishedAt: null, createdAt: { gt: lastSentAt, lte: expect.any(Date) } },
      ])

      const notifications = prisma.notification.createManyAndReturn.mock.calls[0][0].data
      expect(notifications).toHaveLength(1)
      expect(notifications[0].targetId).toBe("new")
      expect(email.send).toHaveBeenCalledTimes(1)
      expect(email.send.mock.calls[0][0].text).toContain("React Developer")

      const update = prisma.jobAlert.updateMany.mock.calls[0][0]
      expect(update.where).toEqual({ id: { in: ["a1"] } })
      expect(update.data.lastSentAt).toBeInstanceOf(Date)
    })

    it("selects by publishedAt (a draft published later counts then), createdAt as fallback", async () => {
      const lastSentAt = new Date("2026-11-03T08:00:00Z")
      prisma.jobAlert.findMany.mockResolvedValueOnce([alert({ lastSentAt, keywords: ["react"] })])
      prisma.job.findMany.mockResolvedValue([
        // created long ago as a draft, published today → included
        job({
          id: "published-draft",
          title: "React Published Draft",
          createdAt: new Date("2026-10-01T00:00:00Z"),
          publishedAt: new Date("2026-11-04T07:00:00Z"),
        }),
        // created today but published before the window (impossible in practice) → excluded
        job({
          id: "stale",
          title: "React Stale",
          createdAt: new Date("2026-11-04T07:00:00Z"),
          publishedAt: new Date("2026-11-02T07:00:00Z"),
        }),
        // legacy row without publishedAt → createdAt
        job({
          id: "legacy",
          title: "React Legacy",
          createdAt: new Date("2026-11-04T06:00:00Z"),
          publishedAt: null,
        }),
      ])
      await service.runDigest("DAILY")
      const notifications = prisma.notification.createManyAndReturn.mock.calls[0][0].data
      expect(notifications).toHaveLength(1)
      expect(notifications[0].title).toBe("2 new jobs match your job alerts")
      const text = email.send.mock.calls[0][0].text as string
      expect(text).toContain("React Published Draft")
      expect(text).toContain("React Legacy")
      expect(text).not.toContain("React Stale")
    })

    it("merges a user's alerts into one digest of max 20 jobs", async () => {
      prisma.jobAlert.findMany.mockResolvedValueOnce([
        alert({ id: "a1", keywords: ["react"] }),
        alert({ id: "a2", locations: ["berlin"] }),
      ])
      prisma.job.findMany.mockResolvedValue(
        Array.from({ length: 25 }, (_, i) =>
          job({ id: `j${i}`, createdAt: new Date(Date.UTC(2026, 10, 4, 0, i)) })
        )
      )
      await service.runDigest("WEEKLY")
      expect(prisma.notification.createManyAndReturn.mock.calls[0][0].data).toHaveLength(1)
      expect(prisma.notification.createManyAndReturn.mock.calls[0][0].data[0].title).toBe(
        "20 new jobs match your job alerts"
      )
      expect(email.send).toHaveBeenCalledTimes(1)
    })

    it("skips inactive alerts (query) and sends nothing without matches", async () => {
      prisma.jobAlert.findMany.mockResolvedValueOnce([alert({ keywords: ["cobol"] })])
      prisma.job.findMany.mockResolvedValue([job()])
      const result = await service.runDigest("DAILY")
      expect(prisma.jobAlert.findMany.mock.calls[0][0].where.active).toBe(true)
      expect(result.users).toBe(0)
      expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled()
      expect(email.send).not.toHaveBeenCalled()
      expect(prisma.jobAlert.updateMany).toHaveBeenCalled()
    })
  })
})

describe("AlertsScheduler", () => {
  const saved = process.env.ALERT_DIGESTS_ENABLED
  afterEach(() => {
    process.env.ALERT_DIGESTS_ENABLED = saved
  })

  it("runs digests unless ALERT_DIGESTS_ENABLED=false", async () => {
    const alerts = { runDigest: jest.fn().mockResolvedValue({ alerts: 0, users: 0 }) } as any
    const scheduler = new AlertsScheduler(alerts)
    delete process.env.ALERT_DIGESTS_ENABLED
    await scheduler.daily()
    expect(alerts.runDigest).toHaveBeenCalledWith("DAILY")
    process.env.ALERT_DIGESTS_ENABLED = "false"
    await scheduler.weekly()
    expect(alerts.runDigest).toHaveBeenCalledTimes(1)
  })
})

describe("AlertsScheduler queue registration", () => {
  const saved = process.env.ALERT_DIGESTS_ENABLED
  afterEach(() => {
    process.env.ALERT_DIGESTS_ENABLED = saved
  })

  const setup = () => {
    const alerts = {
      sendInstant: jest.fn().mockResolvedValue(2),
      runDigest: jest.fn().mockResolvedValue({ alerts: 0, users: 0 }),
    } as any
    const queue = { process: jest.fn(), repeat: jest.fn() }
    const scheduler = new AlertsScheduler(alerts, queue as any)
    const handler = (name: string) => queue.process.mock.calls.find((c) => c[1] === name)?.[2]
    return { alerts, queue, scheduler, handler }
  }

  it("registers instant + digest processors and the UTC repeatables", async () => {
    delete process.env.ALERT_DIGESTS_ENABLED
    const { alerts, queue, scheduler, handler } = setup()
    scheduler.onModuleInit()
    expect(queue.repeat).toHaveBeenCalledWith("alerts", "digest-daily", "0 8 * * *")
    expect(queue.repeat).toHaveBeenCalledWith("alerts", "digest-weekly", "0 8 * * 1")
    await expect(handler("instant")({ jobId: "j1" })).resolves.toBe(2)
    expect(alerts.sendInstant).toHaveBeenCalledWith("j1")
    await handler("digest-weekly")({})
    expect(alerts.runDigest).toHaveBeenCalledWith("WEEKLY")
  })

  it("does not schedule digests when ALERT_DIGESTS_ENABLED=false", () => {
    process.env.ALERT_DIGESTS_ENABLED = "false"
    const { queue, scheduler, handler } = setup()
    scheduler.onModuleInit()
    expect(queue.repeat).not.toHaveBeenCalled()
    expect(handler("instant")).toBeDefined()
  })
})
