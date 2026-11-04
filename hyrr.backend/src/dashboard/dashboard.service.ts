import { Injectable } from "@nestjs/common"
import { ApplicationStatus } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"

const APPLICATION_STATUSES = Object.values(ApplicationStatus)

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSeekerDashboard(userId: string) {
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: { experiences: true, educations: true },
    })
    // Only applications linked to this account (guest applications are never matched by e-mail).
    const applicationWhere = { userId }
    const [grouped, recentApplications] = await Promise.all([
      this.prisma.application.groupBy({
        by: ["status"],
        where: applicationWhere,
        _count: { _all: true },
      }),
      this.prisma.application.findMany({
        where: applicationWhere,
        select: {
          id: true,
          jobId: true,
          status: true,
          title: true,
          location: true,
          seekerBookmarked: true,
          appliedAt: true,
          updatedAt: true,
          offerAmount: true,
          job: { include: { company: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
    ])
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<
      ApplicationStatus,
      number
    >
    let totalApplications = 0
    for (const row of grouped) {
      counts[row.status] = row._count._all
      totalApplications += row._count._all
    }

    const now = new Date()
    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(now.getDate() - 13)
    fourteenDaysAgo.setHours(0, 0, 0, 0)
    const events = await this.prisma.applicationStageEvent.findMany({
      where: { application: applicationWhere, createdAt: { gte: fourteenDaysAgo } },
      select: { createdAt: true },
      take: 2000,
    })
    const activity = Array.from({ length: 14 }, (_, index) => {
      const day = new Date(fourteenDaysAgo)
      day.setDate(fourteenDaysAgo.getDate() + index)
      const key = day.toISOString().slice(0, 10)
      return {
        date: key,
        updates: events.filter((event) => event.createdAt.toISOString().slice(0, 10) === key)
          .length,
      }
    })
    const upcomingInterviews = await this.prisma.calendarEvent.findMany({
      where: { application: applicationWhere, startTime: { gte: now } },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        type: true,
        meetingUrl: true,
        location: true,
        application: {
          select: { id: true, jobId: true, job: { include: { company: true } } },
        },
      },
      orderBy: { startTime: "asc" },
      take: 3,
    })
    const profileFields = [
      Boolean(profile?.title),
      Boolean(profile?.bio),
      Boolean(profile?.skills.length),
      Boolean(profile?.languages.length),
      Boolean(profile?.experiences.length),
      Boolean(profile?.educations.length),
      Boolean(profile?.website || profile?.github || profile?.linkedin),
      Boolean(profile?.expectedSalary),
    ]
    return {
      summary: {
        applications: totalApplications,
        inProcess: counts.IN_PROCESS,
        interviewing: counts.INTERVIEWING,
        saved: counts.SAVED,
        profileStrength: Math.round(
          (profileFields.filter(Boolean).length / profileFields.length) * 100
        ),
      },
      pipeline: counts,
      activity,
      recentApplications,
      upcomingInterviews,
    }
  }
}
