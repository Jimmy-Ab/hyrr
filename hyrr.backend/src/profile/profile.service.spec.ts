import { Test, TestingModule } from "@nestjs/testing"
import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { AiService } from "../ai/ai.service"
import { MatchingService } from "../matching/matching.service"
import { PrismaService } from "../prisma/prisma.service"
import { CvTextService } from "../uploads/cv-text.service"
import { UploadsService } from "../uploads/uploads.service"
import { ProfileService } from "./profile.service"

describe("ProfileService", () => {
  let service: ProfileService
  let prismaMock: any

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>()
    prismaMock.$transaction.mockImplementation((fn: any) => fn(prismaMock))
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MatchingService, useValue: { invalidate: jest.fn() } },
        { provide: AiService, useValue: {} },
        { provide: UploadsService, useValue: {} },
        { provide: CvTextService, useValue: {} },
      ],
    }).compile()

    service = module.get<ProfileService>(ProfileService)
  })

  it("should retrieve a seeker profile", async () => {
    prismaMock.seekerProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      title: "Software Developer",
    } as any)

    const result = await service.getProfile("user-1")
    expect(result.id).toBe("profile-1")
    expect(result.title).toBe("Software Developer")
  })

  it("should update profile fields successfully", async () => {
    prismaMock.seekerProfile.findUnique.mockResolvedValue({ id: "profile-1" } as any)
    prismaMock.seekerProfile.update.mockResolvedValue({
      id: "profile-1",
      title: "Lead Software Engineer",
    } as any)

    const result = await service.updateProfile("user-1", { title: "Lead Software Engineer" })
    expect(result.title).toBe("Lead Software Engineer")
  })

  it("clears links sent as empty strings and never selects passwordHash", async () => {
    prismaMock.seekerProfile.findUnique.mockResolvedValue({ id: "profile-1" } as any)
    prismaMock.seekerProfile.update.mockResolvedValue({ id: "profile-1" } as any)

    await service.updateProfile("user-1", { website: null, github: null, phone: "", bio: "Hi" })

    const args = prismaMock.seekerProfile.update.mock.calls[0][0]
    expect(args.data).toEqual({ website: null, github: null, phone: null, bio: "Hi" })
    expect(args.include.user).toEqual({
      select: expect.not.objectContaining({ passwordHash: true }),
    })
    expect(args.include.user.select.passwordHash).toBeUndefined()
  })

  it("persists every profile field the DTO accepts", async () => {
    prismaMock.seekerProfile.findUnique.mockResolvedValue({ id: "profile-1" } as any)
    prismaMock.seekerProfile.update.mockResolvedValue({ id: "profile-1" } as any)
    prismaMock.user.update.mockResolvedValue({} as any)

    await service.updateProfile("user-1", {
      name: "Ann",
      avatar: "https://cdn.example.com/a.png",
      title: "Dev",
      location: "Berlin",
      phone: "+49 30 1234567",
      bio: "Bio",
      skills: ["TS"],
      languages: ["EN"],
      preferredLocations: ["Remote"],
      visibility: "private",
      website: "https://ann.dev",
      linkedin: "https://linkedin.com/in/ann",
      github: "https://github.com/ann",
      expectedSalaryMin: 90000,
      expectedSalaryMax: 110000,
      expectedSalaryCurrency: "USD",
      expectedSalaryPeriod: "YEAR",
      preferredType: "Full Time",
      availability: "2 weeks",
      yearsOfExperience: "5+",
    })

    const data = prismaMock.seekerProfile.update.mock.calls[0][0].data
    for (const key of [
      "title",
      "location",
      "phone",
      "bio",
      "skills",
      "languages",
      "preferredLocations",
      "visibility",
      "website",
      "linkedin",
      "github",
      "expectedSalary",
      "expectedSalaryMin",
      "expectedSalaryCurrency",
      "preferredType",
      "availability",
      "yearsOfExperience",
    ]) {
      expect(data).toHaveProperty(key)
    }
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Ann", avatar: "https://cdn.example.com/a.png" },
    })
  })
})
