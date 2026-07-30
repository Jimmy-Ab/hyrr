import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  // ─── Any role: get basic user info + company ──────────────────────
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        joinedAt: true,
        company: {
          select: { id: true, name: true, logo: true, color: true, plan: true },
        },
      },
    })
  }

  async getProfile(userId: string) {
    let profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: {
        experiences: true,
        educations: true,
        interests: true,
        user: true,
      },
    })

    if (!profile) {
      // Create lazy profile
      profile = await this.prisma.seekerProfile.create({
        data: {
          userId,
          title: "",
          location: "",
        },
        include: {
          experiences: true,
          educations: true,
          interests: true,
          user: true,
        },
      })
    }

    return profile
  }

  async updateProfile(userId: string, data: any) {
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
    })
    if (!profile) throw new NotFoundException("Profile not found")

    const { experiences, educations, interests, name } = data

    // Filter valid fields for profile update
    const updateData: any = {}
    const allowedFields = [
      "title",
      "location",
      "website",
      "github",
      "linkedin",
      "bio",
      "expectedSalary",
      "preferredType",
      "availability",
      "visibility",
      "skills",
      "languages",
      "preferredLocations",
      "phone",
      "yearsOfExperience",
    ]
    for (const key of allowedFields) {
      if (data[key] !== undefined) updateData[key] = data[key]
    }

    // Handle nested interests relation update if interest slugs are provided
    if (Array.isArray(interests)) {
      updateData.interests = {
        set: interests.map((id: string) => ({ id })),
      }
    }

    // Transaction to update profile and sync experiences/educations
    return this.prisma.$transaction(async (tx) => {
      // Update user name or avatar if provided
      if (name !== undefined || data.avatar !== undefined) {
        const userData: any = {}
        if (name !== undefined) userData.name = name
        if (data.avatar !== undefined) userData.avatar = data.avatar
        await tx.user.update({
          where: { id: userId },
          data: userData,
        })
      }

      // Sync experiences if provided
      if (Array.isArray(experiences)) {
        await tx.workExperience.deleteMany({
          where: { profileId: profile.id },
        })
        await tx.workExperience.createMany({
          data: experiences.map((exp: any) => ({
            profileId: profile.id,
            role: exp.role,
            company: exp.company,
            duration: exp.duration,
            desc: exp.desc || "",
          })),
        })
      }

      // Sync educations if provided
      if (Array.isArray(educations)) {
        await tx.education.deleteMany({ where: { profileId: profile.id } })
        await tx.education.createMany({
          data: educations.map((edu: any) => ({
            profileId: profile.id,
            school: edu.school,
            degree: edu.degree,
            duration: edu.duration,
          })),
        })
      }

      return tx.seekerProfile.update({
        where: { userId },
        data: updateData,
        include: {
          experiences: true,
          educations: true,
          interests: true,
          user: true,
        },
      })
    })
  }

  async addExperience(
    userId: string,
    exp: { role: string; company: string; duration: string; desc?: string }
  ) {
    const profile = await this.getProfile(userId)
    return this.prisma.workExperience.create({
      data: {
        profileId: profile.id,
        role: exp.role,
        company: exp.company,
        duration: exp.duration,
        desc: exp.desc,
      },
    })
  }

  async deleteExperience(id: string, userId: string) {
    const profile = await this.getProfile(userId)
    const exp = await this.prisma.workExperience.findUnique({ where: { id } })
    if (!exp || exp.profileId !== profile.id) throw new NotFoundException("Experience not found")
    return this.prisma.workExperience.delete({ where: { id } })
  }

  async addEducation(userId: string, edu: { school: string; degree: string; duration: string }) {
    const profile = await this.getProfile(userId)
    return this.prisma.education.create({
      data: {
        profileId: profile.id,
        school: edu.school,
        degree: edu.degree,
        duration: edu.duration,
      },
    })
  }

  async deleteEducation(id: string, userId: string) {
    const profile = await this.getProfile(userId)
    const edu = await this.prisma.education.findUnique({ where: { id } })
    if (!edu || edu.profileId !== profile.id) throw new NotFoundException("Education not found")
    return this.prisma.education.delete({ where: { id } })
  }
}
