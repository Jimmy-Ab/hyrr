import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { ExternalJobsService } from "./external-jobs.service"
import {
  mapAdzuna,
  mapArbeitnow,
  mapJooble,
  mapRemotive,
  plainText,
  type ExternalJobInput,
  type Provider,
} from "./providers"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)

const job = (over: Partial<ExternalJobInput> = {}): ExternalJobInput => ({
  source: "REMOTIVE",
  sourceId: "1",
  title: "Backend Engineer",
  company: "Acme",
  companyLogo: null,
  location: "Remote",
  remote: true,
  description: "Build APIs.",
  url: "https://remotive.com/jobs/1",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  employmentType: "full_time",
  category: "Software",
  postedAt: new Date("2026-11-01"),
  ...over,
})

describe("provider mappers", () => {
  it("Adzuna", () => {
    const j = mapAdzuna(
      {
        id: "4321",
        title: "Data Analyst",
        company: { display_name: "Monzo" },
        location: { display_name: "London" },
        description: "<b>SQL</b> &amp; Python",
        redirect_url: "https://www.adzuna.co.uk/jobs/land/ad/4321",
        salary_min: 40000,
        salary_max: 55000.5,
        created: "2026-11-02T10:00:00Z",
        category: { label: "IT Jobs" },
      },
      "gb"
    )
    expect(j).toMatchObject({
      source: "ADZUNA",
      sourceId: "4321",
      company: "Monzo",
      description: "SQL & Python",
      salaryMax: 55001,
      salaryCurrency: "GBP",
      remote: false,
    })
  })

  it("Jooble, Remotive and Arbeitnow; incomplete postings are dropped", () => {
    expect(
      mapJooble({
        id: 9,
        title: "Remote React Dev",
        company: "X",
        link: "https://jooble.org/desc/9",
        snippet: "&nbsp;Hi",
      })
    ).toMatchObject({ source: "JOOBLE", sourceId: "9", remote: true, description: "Hi" })
    expect(
      mapRemotive({
        id: 7,
        title: "PM",
        company_name: "Y",
        url: "https://remotive.com/x",
        candidate_required_location: "Europe",
      })
    ).toMatchObject({ source: "REMOTIVE", remote: true, location: "Europe", companyLogo: null })
    // Logos: Remotive's own https URL only; anything else is dropped (initials avatar).
    const withLogo = (company_logo: unknown) =>
      mapRemotive({
        id: 9,
        title: "PM",
        company_name: "Y",
        url: "https://remotive.com/y",
        company_logo,
      })
    expect(withLogo("https://remotive.com/logo.png")?.companyLogo).toBe(
      "https://remotive.com/logo.png"
    )
    expect(withLogo("http://insecure.example/logo.png")?.companyLogo).toBeNull()
    expect(withLogo("javascript:alert(1)")?.companyLogo).toBeNull()
    expect(
      mapArbeitnow({
        slug: "dev-berlin",
        title: "Dev",
        company_name: "Z",
        url: "https://arbeitnow.com/x",
        remote: false,
        created_at: 1762000000,
        job_types: ["full time"],
      })
    ).toMatchObject({
      source: "ARBEITNOW",
      employmentType: "full time",
      postedAt: new Date(1762000000 * 1000),
    })
    expect(mapRemotive({ id: 8, title: "No link", company_name: "Y" })).toBeNull()
    expect(
      mapJooble({ id: 1, title: "Bad url", company: "X", link: "javascript:alert(1)" })
    ).toBeNull()
  })

  it("plainText strips HTML, scripts and caps the length", () => {
    expect(plainText("<p>Hello</p><script>evil()</script><ul><li>One</li></ul>")).toBe("Hello\nOne")
    expect(plainText("x".repeat(5000))?.length).toBe(4000)
    expect(plainText("   ")).toBeNull()
  })
})

describe("ExternalJobsService", () => {
  let prisma: any
  let wallet: { debit: jest.Mock }
  let service: ExternalJobsService

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    wallet = { debit: jest.fn().mockResolvedValue({ balanceAfter: 9 }) }
    service = new ExternalJobsService(
      prisma,
      wallet as any,
      { getConfig: jest.fn().mockResolvedValue({ externalApplyCost: 1 }) } as any
    )
    prisma.externalJob.findMany.mockResolvedValue([])
  })

  it("list never sends the posting URL (Apply is the only way to the original posting)", async () => {
    prisma.externalJob.findMany.mockResolvedValue([
      { ...job(), id: "e1", applies: [] },
      { ...job({ sourceId: "2" }), id: "e2", applies: [{ id: "a" }] },
    ])
    const page = await service.list("u1")
    expect(page.items).toHaveLength(2)
    expect(page.items.every((j: any) => !("url" in j))).toBe(true)
    expect(page.items.map((j: any) => j.applied)).toEqual([false, true])
  })

  const provider = (source: any, jobs: ExternalJobInput[] | Error, enabled = true): Provider => ({
    source,
    enabled,
    fetch: async () => {
      if (jobs instanceof Error) throw jobs
      return jobs
    },
  })

  it("sync upserts, skips duplicates across sources and scam postings, isolates provider errors", async () => {
    const report = await service.sync([
      provider("REMOTIVE", [
        job(),
        job({
          sourceId: "2",
          title: "Easy money",
          description: "Pay a registration fee via Western Union to start",
        }),
      ]),
      provider("ARBEITNOW", [job({ source: "ARBEITNOW", sourceId: "abc" })]), // same title+company
      provider("JOOBLE", new Error("HTTP 500")),
      provider("ADZUNA", [job({ source: "ADZUNA", sourceId: "z" })], false), // not configured
    ])
    expect(report.REMOTIVE).toMatchObject({ fetched: 2, saved: 1, skipped: 1 })
    expect(report.ARBEITNOW).toMatchObject({ saved: 0, skipped: 1 })
    expect(report.JOOBLE.error).toBe("HTTP 500")
    expect(report.ADZUNA).toBeUndefined()
    expect(prisma.externalJob.upsert).toHaveBeenCalledTimes(1)
    expect(prisma.externalJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } })
    )
  })

  describe("apply", () => {
    const stored = {
      id: "ej-1",
      active: true,
      url: "https://remotive.com/jobs/1",
      title: "Backend Engineer",
      company: "Acme",
      location: "Remote",
    }

    it("charges once, records the apply, auto-tracks it and returns the link", async () => {
      prisma.externalJob.findUnique.mockResolvedValue(stored)
      prisma.externalJobApply.findUnique.mockResolvedValue(null)
      prisma.externalApplication.findFirst.mockResolvedValue(null)
      const res = await service.apply("u1", "ej-1")
      expect(res).toEqual({ url: stored.url, charged: 1, alreadyApplied: false })
      expect(wallet.debit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          amount: 1,
          type: "EXTERNAL_APPLY",
          referenceId: "ej-1",
        }),
        prisma
      )
      expect(prisma.externalApplication.create.mock.calls[0][0].data).toMatchObject({
        userId: "u1",
        externalJobId: "ej-1",
        stage: "APPLIED",
      })
    })

    it("reopening is free; expired postings can't be applied to", async () => {
      prisma.externalJob.findUnique.mockResolvedValue(stored)
      prisma.externalJobApply.findUnique.mockResolvedValue({ id: "a1" })
      expect(await service.apply("u1", "ej-1")).toMatchObject({ charged: 0, alreadyApplied: true })
      prisma.externalJobApply.findUnique.mockResolvedValue(null)
      prisma.externalJob.findUnique.mockResolvedValue({ ...stored, active: false })
      expect(await code(service.apply("u1", "ej-1"))).toBe("EXTERNAL_JOB_EXPIRED")
      expect(wallet.debit).not.toHaveBeenCalled()
    })

    it("no credits: 402 from the wallet and nothing recorded", async () => {
      prisma.externalJob.findUnique.mockResolvedValue(stored)
      prisma.externalJobApply.findUnique.mockResolvedValue(null)
      wallet.debit.mockRejectedValue(
        Object.assign(new Error("no credits"), { errorCode: "INSUFFICIENT_CREDITS" })
      )
      expect(await code(service.apply("u1", "ej-1"))).toBe("INSUFFICIENT_CREDITS")
      expect(prisma.externalJobApply.create).not.toHaveBeenCalled()
    })
  })
})
