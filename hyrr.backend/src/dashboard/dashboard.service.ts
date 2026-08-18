import { Injectable } from "@nestjs/common"
import { ApplicationStatus } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"

const APPLICATION_STATUSES = Object.values(ApplicationStatus)

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSeekerDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId }, include: { experiences: true, educations: true },
    })
    const applicationWhere = {
      OR: [{ userId }, ...(user?.email ? [{ email: user.email }] : [])],
    }
    const applications = await this.prisma.application.findMany({
      where: applicationWhere,
      include: { job: { include: { company: true } } },
      orderBy: { updatedAt: "desc" },
    })
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<ApplicationStatus, number>
    for (const application of applications) counts[application.status] += 1

    const now = new Date()
    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(now.getDate() - 13)
    fourteenDaysAgo.setHours(0, 0, 0, 0)
    const events = await this.prisma.applicationStageEvent.findMany({
      where: { application: applicationWhere, createdAt: { gte: fourteenDaysAgo } },
      select: { createdAt: true },
    })
    const activity = Array.from({ length: 14 }, (_, index) => {
      const day = new Date(fourteenDaysAgo)
      day.setDate(fourteenDaysAgo.getDate() + index)
      const key = day.toISOString().slice(0, 10)
      return { date: key, updates: events.filter((event) => event.createdAt.toISOString().slice(0, 10) === key).length }
    })
    const upcomingInterviews = await this.prisma.calendarEvent.findMany({
      where: { application: applicationWhere, startTime: { gte: now } },
      include: { application: { include: { job: { include: { company: true } } } } },
      orderBy: { startTime: "asc" }, take: 3,
    })
    const profileFields = [
      Boolean(profile?.title), Boolean(profile?.bio), Boolean(profile?.skills.length),
      Boolean(profile?.languages.length), Boolean(profile?.experiences.length),
      Boolean(profile?.educations.length), Boolean(profile?.website || profile?.github || profile?.linkedin),
      Boolean(profile?.expectedSalary),
    ]
    return {
      summary: {
        applications: applications.length,
        inProcess: counts.IN_PROCESS,
        interviewing: counts.INTERVIEWING,
        saved: counts.SAVED,
        profileStrength: Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100),
      },
      pipeline: counts,
      activity,
      recentApplications: applications.slice(0, 4),
      upcomingInterviews,
    }
  }
}
