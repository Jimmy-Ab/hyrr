import {
  CompanyVerificationService,
  isFreeMailDomain,
  matchingCompanyDomain,
  registrableDomain,
} from "./company-verification.service"

describe("registrableDomain", () => {
  it.each([
    ["https://www.acme.com", "acme.com"],
    ["acme.com", "acme.com"],
    ["http://careers.eu.acme.com/jobs?x=1", "acme.com"],
    ["WWW.ACME.COM.", "acme.com"],
    ["https://www.acme.co.uk/about", "acme.co.uk"],
    ["shop.acme.com.au", "acme.com.au"],
    ["https://acme.co.et", "acme.co.et"],
    ["jobs.acme.com.et", "acme.com.et"],
    ["acme.io:8080", "acme.io"],
    ["jane@mail.acme.com", "acme.com"],
    ["jane@acme.co.uk", "acme.co.uk"],
    ["acme.de", "acme.de"],
  ])("%s → %s", (input, expected) => {
    expect(registrableDomain(input)).toBe(expected)
  })

  it.each(["", "localhost", "http://127.0.0.1", "not a url", null, undefined, "co.uk"])(
    "rejects %p",
    (input) => {
      expect(registrableDomain(input as any)).toBeNull()
    }
  )
})

describe("free-mail detection", () => {
  it.each([
    "gmail.com",
    "outlook.com",
    "hotmail.co.uk",
    "yahoo.fr",
    "proton.me",
    "mail.ru",
    "gmx.de",
  ])("%s is free mail", (domain) => expect(isFreeMailDomain(domain)).toBe(true))
  it.each(["acme.com", "acme.co.uk", "ethiotelecom.et"])("%s is a company domain", (domain) =>
    expect(isFreeMailDomain(domain)).toBe(false)
  )
})

describe("matchingCompanyDomain", () => {
  it("matches the registrable domain across www and subdomains", () => {
    expect(matchingCompanyDomain("jane@hr.acme.com", "https://www.acme.com")).toBe("acme.com")
    expect(matchingCompanyDomain("jane@acme.co.uk", "careers.acme.co.uk")).toBe("acme.co.uk")
  })
  it("rejects different domains and look-alikes", () => {
    expect(matchingCompanyDomain("jane@acme.com", "https://acme.co.uk")).toBeNull()
    expect(matchingCompanyDomain("jane@other.co.uk", "https://acme.co.uk")).toBeNull()
    expect(matchingCompanyDomain("jane@acme.com.evil.io", "acme.com")).toBeNull()
  })
  it("never verifies free-mail addresses", () => {
    expect(matchingCompanyDomain("jane@gmail.com", "https://gmail.com")).toBeNull()
  })
  it("needs both values", () => {
    expect(matchingCompanyDomain("jane@acme.com", null)).toBeNull()
    expect(matchingCompanyDomain(null, "acme.com")).toBeNull()
  })
})

describe("CompanyVerificationService", () => {
  const build = () => {
    const prisma: any = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      company: { findUnique: jest.fn(), update: jest.fn() },
    }
    return { prisma, service: new CompanyVerificationService(prisma) }
  }

  it("verifies the company when a verified recruiter e-mail matches the website", async () => {
    const { prisma, service } = build()
    prisma.user.findUnique.mockResolvedValue({ role: "RECRUITER", companyId: "c1" })
    prisma.company.findUnique.mockResolvedValue({
      id: "c1",
      website: "https://www.acme.com",
      verified: false,
      verifiedDomain: null,
    })
    prisma.user.findMany.mockResolvedValue([{ email: "a@gmail.com" }, { email: "b@acme.com" }])

    await service.refreshForUser("u1")

    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      role: "RECRUITER",
      emailVerifiedAt: { not: null },
    })
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ verified: true, verifiedDomain: "acme.com" }),
    })
  })

  it("ignores seekers and recruiters without a company", async () => {
    const { prisma, service } = build()
    prisma.user.findUnique.mockResolvedValueOnce({ role: "SEEKER", companyId: "c1" })
    await service.refreshForUser("u1")
    prisma.user.findUnique.mockResolvedValueOnce({ role: "RECRUITER", companyId: null })
    await service.refreshForUser("u2")
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
  })

  it("does nothing when no recruiter e-mail matches", async () => {
    const { prisma, service } = build()
    prisma.company.findUnique.mockResolvedValue({
      id: "c1",
      website: "acme.com",
      verified: false,
      verifiedDomain: null,
    })
    prisma.user.findMany.mockResolvedValue([{ email: "a@gmail.com" }])
    await service.refreshForCompany("c1")
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it("revokes the badge when the website moves to another domain", async () => {
    const { prisma, service } = build()
    prisma.company.findUnique.mockResolvedValue({
      id: "c1",
      website: "https://scam-site.io",
      verified: true,
      verifiedDomain: "acme.com",
    })
    prisma.user.findMany.mockResolvedValue([{ email: "b@acme.com" }])
    await service.refreshForCompany("c1")
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { verified: false, verifiedDomain: null, verifiedAt: null },
    })
  })

  it("keeps an existing badge for the same domain without re-querying", async () => {
    const { prisma, service } = build()
    prisma.company.findUnique.mockResolvedValue({
      id: "c1",
      website: "www.acme.com",
      verified: true,
      verifiedDomain: "acme.com",
    })
    await service.refreshForCompany("c1")
    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it("never throws", async () => {
    const { prisma, service } = build()
    prisma.user.findUnique.mockRejectedValue(new Error("db down"))
    await expect(service.refreshForUser("u1")).resolves.toBeUndefined()
  })
})
