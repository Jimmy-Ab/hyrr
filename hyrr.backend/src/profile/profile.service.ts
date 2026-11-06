import { HttpStatus, Injectable, NotFoundException, Optional } from "@nestjs/common"
import { DocType, Prisma } from "@prisma/client"
import { AiService } from "../ai/ai.service"
import { CvSuggestions } from "../ai/cv-profile"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import {
  formatMonthRange,
  formatSalaryRange,
  formatYearRange,
  parseMonth,
} from "../core/validation/structured"
import { EmbeddingsService } from "../embeddings/embeddings.service"
import { MatchingService } from "../matching/matching.service"
import { computeProfileStrength } from "../matching/scoring"
import { PrismaService } from "../prisma/prisma.service"
import { CvTextService } from "../uploads/cv-text.service"
import { UploadsService } from "../uploads/uploads.service"
import { ImportCvDto } from "./dtos/import-cv.dto"
import { EducationDto, ExperienceDto, UpdateProfileDto } from "./dtos/profile.dto"

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
  "preferredType",
  "availability",
  "phone",
  "yearsOfExperience",
] as const
const LIST_FIELDS = ["skills", "languages", "preferredLocations"] as const // null → []

/** Experience row from the DTO: dates are the source of truth, `duration` is generated. */
function experienceData(exp: ExperienceDto) {
  const start = parseMonth(exp.startDate)
  const current = !!exp.current
  const end = current ? null : parseMonth(exp.endDate ?? null)
  return {
    role: exp.role,
    company: exp.company,
    startDate: start,
    endDate: end,
    current,
    duration: start ? formatMonthRange(start, end, current) : (exp.duration ?? ""),
    desc: exp.desc || "",
  }
}

function educationData(edu: EducationDto) {
  return {
    school: edu.school,
    degree: edu.degree,
    startYear: edu.startYear ?? null,
    endYear: edu.endYear ?? null,
    duration: edu.startYear ? formatYearRange(edu.startYear, edu.endYear) : (edu.duration ?? ""),
  }
}

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private matching: MatchingService,
    private ai: AiService,
    private uploads: UploadsService,
    private cvText: CvTextService,
    @Optional() private embeddings?: EmbeddingsService
  ) {}

  /** GET /profile payload: the profile plus completeness (`profileStrength` 0-100, `missing`). */
  async getProfileView(userId: string) {
    return withStrength(await this.getProfile(userId))
  }

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
    // Expected salary: the DTO guarantees the four fields arrive together (null clears).
    if (data.expectedSalaryMin !== undefined || data.expectedSalaryMax !== undefined) {
      const set = data.expectedSalaryMin != null && data.expectedSalaryMax != null
      updateData.expectedSalaryMin = set ? data.expectedSalaryMin : null
      updateData.expectedSalaryMax = set ? data.expectedSalaryMax : null
      updateData.expectedSalaryCurrency = set ? data.expectedSalaryCurrency : null
      updateData.expectedSalaryPeriod = set ? (data.expectedSalaryPeriod ?? "YEAR") : null
      updateData.expectedSalary = set
        ? formatSalaryRange(
            data.expectedSalaryMin,
            data.expectedSalaryMax,
            data.expectedSalaryCurrency,
            data.expectedSalaryPeriod ?? "YEAR"
          )
        : null
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
    const updated = await this.prisma.$transaction(async (tx) => {
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
          data: experiences.map((exp) => ({ profileId: profile.id, ...experienceData(exp) })),
        })
      }

      // Sync educations if provided
      if (Array.isArray(educations)) {
        await tx.education.deleteMany({ where: { profileId: profile.id } })
        await tx.education.createMany({
          data: educations.map((edu) => ({ profileId: profile.id, ...educationData(edu) })),
        })
      }

      return tx.seekerProfile.update({
        where: { userId },
        data: updateData,
        include: PROFILE_INCLUDE,
      })
    })
    await this.matching.invalidate(userId)
    await this.embeddings?.embedProfileSoon(userId)
    return withStrength(updated)
  }

  async addExperience(userId: string, exp: ExperienceDto) {
    const profile = await this.getProfile(userId)
    const created = await this.prisma.workExperience.create({
      data: { profileId: profile.id, ...experienceData(exp) },
    })
    await this.matching.invalidate(userId)
    await this.embeddings?.embedProfileSoon(userId)
    return created
  }

  async deleteExperience(id: string, userId: string) {
    const profile = await this.getProfile(userId)
    const exp = await this.prisma.workExperience.findUnique({ where: { id } })
    if (!exp || exp.profileId !== profile.id) throw new NotFoundException("Experience not found")
    const deleted = await this.prisma.workExperience.delete({ where: { id } })
    await this.matching.invalidate(userId)
    await this.embeddings?.embedProfileSoon(userId)
    return deleted
  }

  async addEducation(userId: string, edu: EducationDto) {
    const profile = await this.getProfile(userId)
    const created = await this.prisma.education.create({
      data: { profileId: profile.id, ...educationData(edu) },
    })
    await this.matching.invalidate(userId)
    await this.embeddings?.embedProfileSoon(userId)
    return created
  }

  async deleteEducation(id: string, userId: string) {
    const profile = await this.getProfile(userId)
    const edu = await this.prisma.education.findUnique({ where: { id } })
    if (!edu || edu.profileId !== profile.id) throw new NotFoundException("Education not found")
    const deleted = await this.prisma.education.delete({ where: { id } })
    await this.matching.invalidate(userId)
    await this.embeddings?.embedProfileSoon(userId)
    return deleted
  }

  /**
   * CV → profile suggestions (never written; the seeker reviews and saves via PUT /profile).
   * Source: `documentId` (own document), `url` (own upload), else the latest active RESUME.
   * 503 AI_DISABLED without an AI provider, 422 CV_UNREADABLE when no text can be read.
   */
  async importFromCv(
    userId: string,
    dto: ImportCvDto
  ): Promise<{ suggestions: CvSuggestions; source: "ai" }> {
    if (!(await this.ai.resolveModel()))
      throw new AppException(
        "AI is not configured, so CVs can't be imported right now",
        HttpStatus.SERVICE_UNAVAILABLE,
        "AI_DISABLED"
      )

    let source: string | null = null
    if (dto.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.documentId, userId },
        select: { url: true },
      })
      if (!doc) throw new NotFoundAppException("Document not found", "DOCUMENT_NOT_FOUND")
      source = doc.url
    } else if (dto.url) {
      this.uploads.assertOwnedUpload(dto.url, userId)
      source = dto.url
    } else {
      const doc = await this.prisma.document.findFirst({
        where: { userId, type: DocType.RESUME, active: true },
        orderBy: { createdAt: "desc" },
        select: { url: true },
      })
      source = doc?.url ?? null
    }
    if (!source) throw cvUnreadable("Upload a CV first")

    const { text, note } = await this.cvText.extract(source)
    if (!text) throw cvUnreadable(note || "The CV could not be read")

    const suggestions = await this.ai.extractProfileFromCv(text)
    return { suggestions, source: "ai" }
  }
}

const cvUnreadable = (message: string) =>
  new AppException(message, HttpStatus.UNPROCESSABLE_ENTITY, "CV_UNREADABLE")

function withStrength<T extends Parameters<typeof computeProfileStrength>[0] & object>(profile: T) {
  return { ...profile, ...computeProfileStrength(profile) }
}
