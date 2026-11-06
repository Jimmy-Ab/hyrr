import { PrismaClient } from "@prisma/client"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { mockDeep } from "jest-mock-extended"
import { AiService } from "../ai/ai.service"
import { normalizeCvSuggestions, parseCvSuggestionsResponse } from "../ai/cv-profile"
import { CompanyProfileService } from "./company-profile.service"
import { UpdateCompanyProfileDto } from "./dtos/company-profile.dto"
import { ProfileService } from "./profile.service"

describe("ProfileService.importFromCv", () => {
  let prisma: any
  let ai: any
  let uploads: any
  let cvText: any
  let matching: any
  let service: ProfileService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    ai = {
      resolveModel: jest.fn().mockResolvedValue({ model: "gpt-4o-mini", provider: "openai" }),
      extractProfileFromCv: jest
        .fn()
        .mockResolvedValue({ skills: ["React"], languages: [], experiences: [], educations: [] }),
    }
    uploads = { assertOwnedUpload: jest.fn() }
    cvText = { extract: jest.fn().mockResolvedValue({ text: "Jane Doe, React developer" }) }
    matching = { invalidate: jest.fn() }
    service = new ProfileService(prisma, matching, ai, uploads, cvText)
  })

  it("503 AI_DISABLED when no AI provider is configured (nothing is read)", async () => {
    ai.resolveModel.mockResolvedValue(null)
    await expect(service.importFromCv("u1", {})).rejects.toMatchObject({
      status: 503,
      errorCode: "AI_DISABLED",
    })
    expect(cvText.extract).not.toHaveBeenCalled()
  })

  it("422 CV_UNREADABLE when the CV has no text, or there is no CV", async () => {
    prisma.document.findFirst.mockResolvedValue({ url: "http://x/api/uploads/u1_a.pdf" })
    cvText.extract.mockResolvedValue({
      text: null,
      note: "No readable text in the CV (scanned image?)",
    })
    await expect(service.importFromCv("u1", {})).rejects.toMatchObject({
      status: 422,
      errorCode: "CV_UNREADABLE",
    })
    prisma.document.findFirst.mockResolvedValue(null)
    await expect(service.importFromCv("u1", {})).rejects.toMatchObject({ status: 422 })
    expect(ai.extractProfileFromCv).not.toHaveBeenCalled()
  })

  it("uses the seeker's own document and never writes the profile", async () => {
    prisma.document.findFirst.mockResolvedValue({ url: "http://x/api/uploads/u1_a.pdf" })
    const result = await service.importFromCv("u1", { documentId: "d1" })
    expect(prisma.document.findFirst.mock.calls[0][0].where).toEqual({ id: "d1", userId: "u1" })
    expect(cvText.extract).toHaveBeenCalledWith("http://x/api/uploads/u1_a.pdf")
    expect(ai.extractProfileFromCv).toHaveBeenCalledWith("Jane Doe, React developer")
    expect(result).toEqual({
      suggestions: expect.objectContaining({ skills: ["React"] }),
      source: "ai",
    })
    expect(prisma.seekerProfile.update).not.toHaveBeenCalled()
  })

  it("404 for someone else's document; url must be the seeker's own upload", async () => {
    prisma.document.findFirst.mockResolvedValue(null)
    await expect(service.importFromCv("u1", { documentId: "d2" })).rejects.toMatchObject({
      status: 404,
    })
    await service.importFromCv("u1", { url: "http://x/api/uploads/u1_b.pdf" })
    expect(uploads.assertOwnedUpload).toHaveBeenCalledWith("http://x/api/uploads/u1_b.pdf", "u1")
  })

  it("GET /profile view adds profileStrength + missing", async () => {
    prisma.seekerProfile.findUnique.mockResolvedValue({
      id: "p1",
      title: "Dev",
      skills: [],
      experiences: [],
      educations: [],
      interests: [],
    })
    const view = await service.getProfileView("u1")
    expect(view.profileStrength).toBe(15)
    expect(view.missing).toContain("Work experience")
  })

  it("profile updates invalidate the matching cache", async () => {
    prisma.seekerProfile.findUnique.mockResolvedValue({ id: "p1" })
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    prisma.seekerProfile.update.mockResolvedValue({ id: "p1", title: "Dev" })
    const result = await service.updateProfile("u1", { title: "Dev" })
    expect(matching.invalidate).toHaveBeenCalledWith("u1")
    expect(result).toHaveProperty("profileStrength")
  })
})

describe("AiService.extractProfileFromCv", () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  const make = (adapter: any) => {
    const prisma: any = mockDeep<PrismaClient>()
    prisma.systemSetting.findUnique.mockResolvedValue({
      id: "global-settings",
      activeModel: "gpt-4o-mini",
      temperature: 0.2,
      systemPrompt: "sys",
    })
    return new AiService(prisma, { getAdapter: () => adapter } as any, {} as any)
  }

  it("503 AI_DISABLED without provider keys", async () => {
    process.env.OPENAI_API_KEY = ""
    process.env.ANTHROPIC_API_KEY = ""
    process.env.GOOGLE_AI_API_KEY = ""
    await expect(make({}).extractProfileFromCv("cv")).rejects.toMatchObject({
      status: 503,
      errorCode: "AI_DISABLED",
    })
  })

  it("returns the adapter's suggestions; model failures → 502 AI_FAILED", async () => {
    process.env.OPENAI_API_KEY = "sk-test-real"
    const adapter = { extractProfile: jest.fn().mockResolvedValue({ skills: ["Go"] }) }
    expect(await make(adapter).extractProfileFromCv("cv")).toEqual({ skills: ["Go"] })
    expect(adapter.extractProfile).toHaveBeenCalledWith("gpt-4o-mini", "cv")
    adapter.extractProfile.mockRejectedValue(new Error("boom"))
    await expect(make(adapter).extractProfileFromCv("cv")).rejects.toMatchObject({
      status: 502,
      errorCode: "AI_FAILED",
    })
  })
})

describe("CV suggestion normalisation", () => {
  it("clips, dedupes and drops empty rows", () => {
    const result = normalizeCvSuggestions({
      title: "  Frontend   Developer ",
      bio: "",
      skills: ["React", "react", " TypeScript ", "", "- Node.js", "x".repeat(100)],
      languages: "English, Amharic",
      yearsOfExperience: 6,
      experiences: [
        { role: "Dev", company: "Acme", duration: "2020 – now", desc: "Built things" },
        { role: "", company: "", duration: "" },
        { title: "Intern", employer: "Beta", dates: "2019" },
      ],
      educations: [{ school: "AAU", degree: "BSc", duration: "2015 – 2019" }, {}],
    })
    expect(result.title).toBe("Frontend Developer")
    expect(result.bio).toBeUndefined()
    expect(result.skills).toEqual(["React", "TypeScript", "Node.js", "x".repeat(60)])
    expect(result.languages).toEqual(["English", "Amharic"])
    expect(result.yearsOfExperience).toBe("6")
    expect(result.experiences).toEqual([
      { role: "Dev", company: "Acme", duration: "2020 – now", desc: "Built things" },
      { role: "Intern", company: "Beta", duration: "2019" },
    ])
    expect(result.educations).toHaveLength(1)
  })

  it("parses a fenced JSON fallback reply and rejects non-JSON", () => {
    const parsed = parseCvSuggestionsResponse('```json\n{"skills": ["Go"], "experiences": []}\n```')
    expect(parsed.skills).toEqual(["Go"])
    expect(parsed.experiences).toEqual([])
    expect(() => parseCvSuggestionsResponse("sorry")).toThrow()
  })
})

describe("CompanyProfileService", () => {
  let prisma: any
  let verification: any
  let cache: any
  let service: CompanyProfileService
  const recruiter = { userId: "r1", role: "RECRUITER", companyId: "co-1" }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    verification = { refreshForCompany: jest.fn() }
    cache = { delByPattern: jest.fn() }
    service = new CompanyProfileService(prisma, verification, cache)
    prisma.company.findUniqueOrThrow.mockResolvedValue({ id: "co-1", website: "https://old.io" })
    prisma.company.update.mockImplementation(async ({ data }: any) => ({ id: "co-1", ...data }))
  })

  it("403 for users without a company or with a read-only role", async () => {
    await expect(
      service.update({ userId: "s1", role: "SEEKER", companyId: null }, { name: "X" })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      service.get({ userId: "r2", role: "RECRUITER", companyId: null })
    ).rejects.toMatchObject({
      status: 403,
    })
    prisma.companyMember.findUnique.mockResolvedValue({ role: "VIEWER" })
    await expect(service.update(recruiter, { name: "X" })).rejects.toMatchObject({ status: 403 })
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it("updates fields and refreshes verification only when the website changes", async () => {
    prisma.companyMember.findUnique.mockResolvedValue({ role: "OWNER" })
    await service.update(recruiter, { name: "Acme", description: null, website: "https://old.io/" })
    expect(prisma.company.update.mock.calls[0][0].data).toEqual({
      name: "Acme",
      description: null,
      website: "https://old.io/",
    })
    expect(prisma.company.update.mock.calls[0][0].select).not.toHaveProperty("plan")
    expect(verification.refreshForCompany).not.toHaveBeenCalled()

    await service.update(recruiter, { website: "https://new.io" })
    expect(verification.refreshForCompany).toHaveBeenCalledWith("co-1")
    expect(cache.delByPattern).toHaveBeenCalledWith("jobs:public*")
  })

  it("DTO: website must be http(s); '' clears it; bare domains get https://", async () => {
    const check = async (website: any) => {
      const dto = plainToInstance(UpdateCompanyProfileDto, { website })
      return { errors: await validate(dto), value: dto.website }
    }
    expect(await check("")).toEqual({ errors: [], value: null })
    expect((await check("acme.io")).value).toBe("https://acme.io")
    expect((await check("ftp://acme.io")).errors.length).toBeGreaterThan(0)
    expect((await check("https://acme.io")).errors).toEqual([])
  })
})
