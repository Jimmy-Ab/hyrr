import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AccessService } from "../core/access/access.service"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { CalendarService } from "./calendar.service"

describe("CalendarService", () => {
  let service: CalendarService
  let prismaMock: any

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: { createNotification: jest.fn() } },
        {
          provide: AccessService,
          useValue: {
            applicationFor: jest.fn(),
            calendarEventFor: jest.fn(),
            jobScopeWhere: jest.fn().mockResolvedValue({ OR: [{ recruiterId: "recruiter-1" }] }),
          },
        },
      ],
    }).compile()

    service = module.get<CalendarService>(CalendarService)
  })

  it("should list calendar events for a seeker", async () => {
    prismaMock.calendarEvent.findMany.mockResolvedValue([
      { id: "event-1", title: "Technical Interview" },
    ] as any)

    const result = await service.getEvents({ userId: "seeker-1", role: "SEEKER" })
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe("Technical Interview")
  })

  it("should schedule a new interview event", async () => {
    prismaMock.calendarEvent.create.mockResolvedValue({
      id: "event-2",
      title: "Culture Fit stage",
      startTime: new Date("2026-07-15T10:00:00Z"),
    } as any)

    const result = await service.createEvent(
      {
        applicationId: "app-1",
        title: "Culture Fit stage",
        startTime: "2026-07-15T10:00:00Z",
        type: "INTERVIEW",
      },
      { userId: "recruiter-1", role: "RECRUITER" }
    )

    expect(result.id).toBe("event-2")
  })

  it("stores offset ISO datetimes as Date and keeps meetingUrl/location", async () => {
    prismaMock.calendarEvent.create.mockImplementation(async ({ data }: any) => ({ id: "e", ...data }))

    const result: any = await service.createEvent(
      {
        title: "Call",
        startTime: "2026-07-15T10:00:00+02:00",
        endTime: "2026-07-15T11:00:00+02:00",
        type: "INTERVIEW",
        meetingUrl: "https://meet.example.com/x",
        location: "Room 1",
      },
      { userId: "recruiter-1", role: "RECRUITER" }
    )

    expect(result.startTime).toEqual(new Date("2026-07-15T08:00:00Z"))
    expect(result.meetingUrl).toBe("https://meet.example.com/x")
    expect(result.location).toBe("Room 1")
    expect(result.userId).toBe("recruiter-1")
  })

  it("rejects an end time before the start time", async () => {
    await expect(
      service.createEvent(
        {
          title: "Call",
          startTime: "2026-07-15T10:00:00Z",
          endTime: "2026-07-15T09:00:00Z",
          type: "INTERVIEW",
        },
        { userId: "recruiter-1", role: "RECRUITER" }
      )
    ).rejects.toMatchObject({ status: 400 })
  })

  it("scopes recruiter events by company and hides SAVED applications", async () => {
    prismaMock.calendarEvent.findMany.mockResolvedValue([])
    await service.getEvents({ userId: "recruiter-1", role: "RECRUITER" })
    expect(prismaMock.calendarEvent.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        {
          application: {
            job: { OR: [{ recruiterId: "recruiter-1" }] },
            status: { not: "SAVED" },
          },
        },
        { userId: "recruiter-1" },
      ],
    })
  })
})
