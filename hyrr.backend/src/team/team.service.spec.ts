import { PrismaClient } from "@prisma/client"
import { mockDeep } from "jest-mock-extended"
import { sha256 } from "../auth/one-time-token"
import { TeamService, maskEmail } from "./team.service"

const code = (p: Promise<unknown>) =>
  p.then(() => "resolved").catch((e) => e?.errorCode ?? e?.message)

describe("TeamService", () => {
  let prisma: any
  let wallet: { ensureWallet: jest.Mock; credit: jest.Mock }
  let email: { send: jest.Mock }
  let notifications: { createNotification: jest.Mock }
  let service: TeamService
  const owner = { userId: "owner-1", role: "RECRUITER", companyId: "co-1" }
  const future = new Date(Date.now() + 86_400_000)

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma))
    wallet = { ensureWallet: jest.fn(), credit: jest.fn() }
    email = { send: jest.fn().mockResolvedValue({ delivered: true }) }
    notifications = { createNotification: jest.fn().mockResolvedValue(undefined) }
    service = new TeamService(
      prisma,
      wallet as any,
      { getConfig: jest.fn().mockResolvedValue({ signupBonus: 20 }) } as any,
      email as any,
      notifications as any
    )
  })

  const asMember = (role: string, userId = "owner-1") =>
    prisma.companyMember.findUnique.mockResolvedValue({ id: "m", companyId: "co-1", userId, role })

  const seats = (used: number, limit: number) => {
    prisma.subscription.findUnique.mockResolvedValue(null)
    prisma.company.findUnique.mockResolvedValue({ plan: "Starter", name: "Acme" })
    prisma.user.count.mockResolvedValue(used)
    prisma.companyInvite.count.mockResolvedValue(0)
    prisma.plan.findUnique.mockResolvedValue({ seatLimit: limit })
  }

  const openInvite = (over: Record<string, any> = {}) => ({
    id: "inv-1",
    companyId: "co-1",
    email: "tom@acme.com",
    role: "RECRUITER",
    tokenHash: sha256("tok"),
    invitedById: "owner-1",
    createdAt: new Date(),
    expiresAt: future,
    acceptedAt: null,
    declinedAt: null,
    revokedAt: null,
    company: { id: "co-1", name: "Acme", logo: "A", status: "VERIFIED" },
    invitedBy: { name: "Olga" },
    ...over,
  })

  it("masks e-mails in previews", () => {
    expect(maskEmail("dalasa@acme.com")).toBe("d•••••@acme.com")
    expect(maskEmail("a@b.co")).toBe("a••@b.co")
  })

  describe("invite", () => {
    it("only owners invite", async () => {
      asMember("RECRUITER")
      expect(await code(service.invite(owner, { email: "x@acme.com", role: "RECRUITER" }))).toBe(
        "OWNER_ONLY"
      )
      expect(prisma.companyInvite.create).not.toHaveBeenCalled()
    })

    it("refuses job seeker e-mails", async () => {
      asMember("OWNER")
      prisma.user.findFirst.mockResolvedValue({ id: "s1", role: "SEEKER", companyId: null })
      expect(await code(service.invite(owner, { email: "s@acme.com", role: "VIEWER" }))).toBe(
        "INVITE_NEEDS_RECRUITER"
      )
    })

    it("open invites hold seats: 402 when the plan is full", async () => {
      asMember("OWNER")
      prisma.user.findFirst.mockResolvedValue(null)
      seats(2, 3)
      prisma.companyInvite.count.mockResolvedValue(1)
      expect(await code(service.invite(owner, { email: "n@acme.com", role: "VIEWER" }))).toBe(
        "SEAT_LIMIT_REACHED"
      )
    })

    it("stores only the token hash, e-mails the link and replaces an earlier open invite", async () => {
      asMember("OWNER")
      prisma.user.findFirst.mockResolvedValue(null)
      seats(1, 3)
      prisma.companyInvite.create.mockImplementation(async ({ data }: any) => ({
        id: "inv-9",
        createdAt: new Date(),
        ...data,
        invitedBy: { name: "Olga" },
      }))
      prisma.user.findUnique.mockResolvedValue({ name: "Olga" })
      const result = await service.invite(owner, {
        email: " New@Acme.com ",
        role: "HIRING_MANAGER",
      })
      expect(prisma.companyInvite.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: "co-1", email: "new@acme.com" }),
          data: { revokedAt: expect.any(Date) },
        })
      )
      const data = prisma.companyInvite.create.mock.calls[0][0].data
      expect(data.email).toBe("new@acme.com")
      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/)
      const mail = email.send.mock.calls[0][0]
      expect(mail.to).toBe("new@acme.com")
      expect(mail.html).toContain("/invite?token=")
      expect(mail.html).not.toContain(data.tokenHash)
      expect(result).toMatchObject({ id: "inv-9", email: "new@acme.com", role: "HIRING_MANAGER" })
    })
  })

  describe("accepting", () => {
    it("rejects expired, used or unknown links with 410 INVITE_EXPIRED", async () => {
      prisma.companyInvite.findUnique.mockResolvedValue(openInvite({ expiresAt: new Date(0) }))
      expect(await code(service.previewInvite("tok"))).toBe("INVITE_EXPIRED")
      prisma.companyInvite.findUnique.mockResolvedValue(openInvite({ revokedAt: new Date() }))
      expect(await code(service.previewInvite("tok"))).toBe("INVITE_EXPIRED")
      prisma.companyInvite.findUnique.mockResolvedValue(null)
      expect(await code(service.previewInvite("nope"))).toBe("INVITE_EXPIRED")
    })

    it("preview never reveals the full e-mail", async () => {
      prisma.companyInvite.findUnique.mockResolvedValue(openInvite())
      const preview = await service.previewInvite("tok")
      expect(JSON.stringify(preview)).not.toContain("tom@acme.com")
      expect(preview).toMatchObject({ company: { name: "Acme" }, emailHint: "t••@acme.com" })
    })

    it("seekers can't accept", async () => {
      expect(await code(service.acceptInvite({ userId: "s", role: "SEEKER" }, "tok"))).toBe(
        "INVITE_NEEDS_RECRUITER"
      )
    })

    it("the signed-in e-mail must match the invite", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u2",
        email: "else@acme.com",
        role: "RECRUITER",
      })
      prisma.companyInvite.findUnique.mockResolvedValue(openInvite())
      prisma.companyMember.count.mockResolvedValue(0)
      prisma.job.count.mockResolvedValue(0)
      expect(await code(service.acceptInvite({ userId: "u2", role: "RECRUITER" }, "tok"))).toBe(
        "INVITE_EMAIL_MISMATCH"
      )
      expect(prisma.companyMember.create).not.toHaveBeenCalled()
    })

    it("joins, removes the empty placeholder company and tells the inviter", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u2",
        email: "Tom@acme.com",
        role: "RECRUITER",
        name: "Tom",
        companyId: "co-solo",
        companyMemberships: [{ companyId: "co-solo" }],
      })
      prisma.companyInvite.findUnique.mockResolvedValue(openInvite())
      prisma.companyMember.count.mockResolvedValue(0)
      prisma.job.count.mockResolvedValue(0)
      prisma.company.findUnique.mockResolvedValue({ name: "Solo" })
      const result = await service.acceptInvite({ userId: "u2", role: "RECRUITER" }, "tok")
      expect(prisma.company.deleteMany).toHaveBeenCalledWith({ where: { id: "co-solo" } })
      expect(prisma.companyMember.create).toHaveBeenCalledWith({
        data: { companyId: "co-1", userId: "u2", role: "RECRUITER" },
      })
      expect(prisma.companyInvite.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { acceptedAt: expect.any(Date) },
      })
      expect(notifications.createNotification).toHaveBeenCalledWith(
        "owner-1",
        expect.stringContaining("Tom accepted"),
        "SYSTEM"
      )
      expect(result).toMatchObject({ companyId: "co-1", role: "RECRUITER" })
    })

    it("someone in a real company must leave it first", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u2",
        email: "tom@acme.com",
        role: "RECRUITER",
        companyId: "co-busy",
        companyMemberships: [{ companyId: "co-busy" }],
      })
      prisma.companyInvite.findUnique.mockResolvedValue(openInvite())
      prisma.companyMember.count.mockResolvedValue(2)
      prisma.job.count.mockResolvedValue(0)
      prisma.company.findUnique.mockResolvedValue({ name: "Busy" })
      expect(await code(service.acceptInvite({ userId: "u2", role: "RECRUITER" }, "tok"))).toBe(
        "LEAVE_CURRENT_COMPANY"
      )
      expect(prisma.company.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe("join requests", () => {
    it("matches only verified companies and never free-mail domains", async () => {
      expect(await service.domainMatch("me@gmail.com")).toBeNull()
      expect(prisma.company.findFirst).not.toHaveBeenCalled()
      prisma.company.findFirst.mockResolvedValue({ id: "co-1", name: "Acme", logo: "A" })
      expect(await service.domainMatch("me@acme.com")).toMatchObject({ name: "Acme" })
      expect(prisma.company.findFirst.mock.calls[0][0].where).toMatchObject({
        verified: true,
        verifiedDomain: "acme.com",
      })
    })

    it("refuses a request for a company on another domain", async () => {
      prisma.company.findFirst.mockResolvedValue({ id: "co-other", name: "Other", logo: "O" })
      expect(
        await code(service.createJoinRequest(prisma, { id: "u", email: "me@acme.com" }, "co-1"))
      ).toBe("DOMAIN_MISMATCH")
    })

    it("approving checks seats, moves the requester in and notifies them", async () => {
      asMember("OWNER")
      prisma.companyJoinRequest.findUnique.mockResolvedValue({
        id: "jr-1",
        companyId: "co-1",
        userId: "u3",
        status: "PENDING",
        user: { id: "u3", name: "Ana", email: "ana@acme.com" },
        company: { name: "Acme" },
      })
      prisma.user.findUnique.mockResolvedValue({ companyId: null, companyMemberships: [] })
      seats(1, 3)
      await service.approveJoinRequest(owner, "jr-1", "VIEWER")
      expect(prisma.companyMember.create).toHaveBeenCalledWith({
        data: { companyId: "co-1", userId: "u3", role: "VIEWER" },
      })
      expect(prisma.companyJoinRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) })
      )
      expect(notifications.createNotification).toHaveBeenCalledWith(
        "u3",
        expect.stringContaining("approved"),
        "SYSTEM"
      )
    })
  })

  describe("ownership and leaving", () => {
    it("transfer makes the member OWNER and the old owner a Recruiter", async () => {
      prisma.companyMember.findUnique
        .mockResolvedValueOnce({ id: "m", companyId: "co-1", userId: "owner-1", role: "OWNER" })
        .mockResolvedValueOnce({
          id: "m2",
          companyId: "co-1",
          userId: "u2",
          role: "RECRUITER",
          user: { name: "Tom" },
          company: { name: "Acme" },
        })
      await service.transferOwnership(owner, "m2")
      expect(prisma.companyMember.update).toHaveBeenCalledWith({
        where: { id: "m2" },
        data: { role: "OWNER" },
      })
      expect(prisma.companyMember.updateMany).toHaveBeenCalledWith({
        where: { companyId: "co-1", userId: "owner-1" },
        data: { role: "RECRUITER" },
      })
    })

    it("the owner must transfer before leaving", async () => {
      asMember("OWNER")
      expect(await code(service.leave(owner))).toBe("OWNER_MUST_TRANSFER")
    })

    it("a member leaves and ends up without a company", async () => {
      asMember("RECRUITER", "u2")
      prisma.user.findUnique.mockResolvedValue({ name: "Tom" })
      prisma.companyMember.findMany.mockResolvedValue([{ userId: "owner-1" }])
      await service.leave({ userId: "u2", role: "RECRUITER", companyId: "co-1" })
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u2" },
        data: { companyId: null },
      })
      expect(notifications.createNotification).toHaveBeenCalledWith(
        "owner-1",
        expect.stringContaining("left your team"),
        "SYSTEM"
      )
    })
  })

  describe("company setup", () => {
    it("creates the company with one welcome bonus per person", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u", name: "Ana", companyId: null })
      prisma.creditTransaction.count.mockResolvedValue(0)
      prisma.company.create.mockResolvedValue({ id: "co-new", name: "Ana Co", website: null })
      await service.setupCompany({ userId: "u", role: "RECRUITER" }, { name: " Ana Co " })
      expect(prisma.company.create.mock.calls[0][0].data).toMatchObject({
        name: "Ana Co",
        country: "",
      })
      expect(wallet.credit).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: "co-new", amount: 20, type: "SIGNUP_BONUS" }),
        prisma
      )

      wallet.credit.mockClear()
      prisma.creditTransaction.count.mockResolvedValue(1)
      await service.setupCompany({ userId: "u", role: "RECRUITER" }, { name: "Again" })
      expect(wallet.credit).not.toHaveBeenCalled()
    })

    it("refuses people who already have a company", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u", name: "Ana", companyId: "co-1" })
      expect(
        await code(service.setupCompany({ userId: "u", role: "RECRUITER" }, { name: "X" }))
      ).toBe("ALREADY_IN_COMPANY")
    })
  })
})
