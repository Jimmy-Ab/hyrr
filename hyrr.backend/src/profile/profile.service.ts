import { Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { UpdateProfileDto } from "./dtos/profile.dto"

/** Public user fields embedded in profile responses — never passwordHash or OAuth ids. */
const PROFILE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  role: true,
  status: true,
  joinedAt: true,
} satisfies Prisma.UserSelect

const PROFILE_INCLUDE = {
  experiences: true,
  educations: true,
  interests: true,
  user: { select: PROFILE_USER_SELECT },
} satisfies Prisma.SeekerProfileInclude

/** Scalar profile fields that PUT /profile persists, grouped by how `null` is stored. */
const REQUIRED_TEXT_FIELDS = ["title", "location"] as const // non-nullable columns: null → ""
const NULLABLE_TEXT_FIELDS = [
  "website",
  "github",
  "linkedin",
  "bio",
  "expectedSalary",
  "preferredType",
  "availability",
  "phone",
  "yearsOfExperience",
] as const
const LIST_FIELDS = ["skills", "languages", "preferredLocations"] as const // null → []

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
          select: { id: true, name: true, logo: true, color: true, plan: true, verified: true },
        },
      },
    })
  }

  async getProfile(userId: string) {
    let profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    })

    if (!profile) {
      // Create lazy profile
      profile = await this.prisma.seekerProfile.create({
        data: {
          userId,
          title: "",
          location: "",
        },
        include: PROFILE_INCLUDE,
      })
    }

    return profile
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    // Lazily creates the profile for seekers who never opened it
    const profile = await this.getProfile(userId)

    const { experiences, educations, interests, name } = data

    // `undefined` = leave unchanged; `null` / "" (normalised to null by the DTO) = clear
    const updateData: Prisma.SeekerProfileUpdateInput = {}
    for (const key of REQUIRED_TEXT_FIELDS) {
      if (data[key] !== undefined) updateData[key] = data[key] ?? ""
    }
    for (const key of NULLABLE_TEXT_FIELDS) {
      if (data[key] === undefined) continue
      const value = typeof data[key] === "string" ? data[key].trim() : data[key]
      updateData[key] = value === "" ? null : value
    }
    for (const key of LIST_FIELDS) {
      if (data[key] === undefined) continue
      updateData[key] = (data[key] ?? []).map((v: string) => v.trim()).filter(Boolean)
    }
    if (data.visibility !== undefined && data.visibility !== null) {
      updateData.visibility = data.visibility
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
      if ((name !== undefined && name !== null) || data.avatar !== undefined) {
        const userData: Prisma.UserUpdateInput = {}
        if (name !== undefined && name !== null && name.trim()) userData.name = name.trim()
        // User.avatar is non-nullable: clearing falls back to a generated initials avatar
        if (data.avatar !== undefined)
          userData.avatar =
            data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}`
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
        include: PROFILE_INCLUDE,
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
