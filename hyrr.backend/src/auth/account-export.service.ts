import { Injectable, NotFoundException } from "@nestjs/common"
import { UserRole } from "@prisma/client"
import { SEEKER_APPLICATION_FIELDS } from "../applications/applications.service"
import { PrismaService } from "../prisma/prisma.service"

/** Upper bound per collection so a single export stays a sane size. */
const EXPORT_LIMIT = 10_000

/**
 * GDPR-style export of the data an account owns. Every query uses an explicit `select`, so
 * secrets (password hash, 2FA secret, recovery codes, auth token hashes) can never leak in.
 */
@Injectable()
export class AccountExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        joinedAt: true,
        lastLogin: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
        googleId: true,
        githubId: true,
        linkedinId: true,
        companyId: true,
      },
    })
    if (!user) throw new NotFoundException("User not found")
    const { googleId, githubId, linkedinId, ...profile } = user
    const isRecruiter = user.role === UserRole.RECRUITER || user.role === UserRole.ADMIN

    const [
      seekerProfile,
      settings,
      documents,
      applications,
      sentMessages,
      receivedMessages,
      notifications,
      calendarEvents,
      jobAlerts,
      savedSearches,
      companyMemberships,
    ] = await Promise.all([
      this.prisma.seekerProfile.findUnique({
        where: { userId },
        select: {
          title: true,
          location: true,
          website: true,
          github: true,
          linkedin: true,
          bio: true,
          expectedSalary: true,
          preferredType: true,
          availability: true,
          preferredLocations: true,
          visibility: true,
          skills: true,
          languages: true,
          phone: true,
          yearsOfExperience: true,
          updatedAt: true,
          experiences: { select: { role: true, company: true, duration: true, desc: true } },
          educations: { select: { school: true, degree: true, duration: true } },
          interests: { select: { name: true } },
        },
      }),
      this.prisma.userSetting.findUnique({
        where: { userId },
        select: {
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
          applicationUpdates: true,
          interviewReminders: true,
          offerNotifications: true,
          messageNotifications: true,
          jobRecommendations: true,
          weeklyDigest: true,
          profilePublic: true,
          resumeVisible: true,
          showActivity: true,
          theme: true,
          updatedAt: true,
        },
      }),
      this.prisma.document.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          version: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      }),
      this.prisma.application.findMany({
        where: { userId },
        select: {
          ...SEEKER_APPLICATION_FIELDS,
          job: { select: { title: true, location: true, company: { select: { name: true } } } },
          answers: { select: { answer: true, question: { select: { question: true } } } },
        },
        orderBy: { appliedAt: "desc" },
        take: EXPORT_LIMIT,
      }),
      this.prisma.message.findMany({
        where: { senderId: userId },
        select: { id: true, applicationId: true, text: true, createdAt: true, read: true },
        orderBy: { createdAt: "asc" },
        take: EXPORT_LIMIT,
      }),
      this.prisma.message.findMany({
        where: { receiverId: userId },
        select: {
          id: true,
          applicationId: true,
          text: true,
          createdAt: true,
          read: true,
          sender: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: EXPORT_LIMIT,
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: { id: true, title: true, type: true, read: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LIMIT,
      }),
      this.prisma.calendarEvent.findMany({
        where: { userId },
        select: {
          id: true,
          applicationId: true,
          title: true,
          startTime: true,
          endTime: true,
          type: true,
          meetingUrl: true,
          location: true,
          notes: true,
          createdAt: true,
        },
        orderBy: { startTime: "desc" },
        take: EXPORT_LIMIT,
      }),
      this.prisma.jobAlert.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          keywords: true,
          locations: true,
          jobTypes: true,
          minSalary: true,
          remoteOnly: true,
          frequency: true,
          active: true,
          createdAt: true,
        },
        take: EXPORT_LIMIT,
      }),
      this.prisma.savedSearch.findMany({
        where: { userId },
        select: { id: true, name: true, query: true, filters: true, createdAt: true },
        take: EXPORT_LIMIT,
      }),
      isRecruiter
        ? this.prisma.companyMember.findMany({
            where: { userId },
            select: {
              role: true,
              createdAt: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  website: true,
                  country: true,
                  city: true,
                  industry: true,
                  description: true,
                  plan: true,
                  verified: true,
                  joinedAt: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ])

    const postedJobs = isRecruiter
      ? await this.prisma.job.findMany({
          where: { recruiterId: userId },
          select: {
            id: true,
            companyId: true,
            title: true,
            location: true,
            type: true,
            salary: true,
            status: true,
            description: true,
            requirements: true,
            skills: true,
            benefits: true,
            remote: true,
            createdAt: true,
            category: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LIMIT,
        })
      : []

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        ...profile,
        linkedAccounts: { google: !!googleId, github: !!githubId, linkedin: !!linkedinId },
      },
      seekerProfile,
      settings,
      documents,
      applications,
      messages: { sent: sentMessages, received: receivedMessages },
      notifications,
      calendarEvents,
      jobAlerts,
      savedSearches,
      ...(isRecruiter ? { companies: companyMemberships, postedJobs } : {}),
    }
  }
}
