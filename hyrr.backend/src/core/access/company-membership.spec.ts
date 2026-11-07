import { requireCompanyWriter } from "./company-membership"

describe("requireCompanyWriter", () => {
  const actor = { userId: "u1", role: "RECRUITER", companyId: "co-1" }
  const db = (status: string) =>
    ({
      companyMember: {
        findUnique: jest.fn().mockResolvedValue({ role: "OWNER" }),
        count: jest.fn().mockResolvedValue(1),
      },
      company: { findUnique: jest.fn().mockResolvedValue({ status }) },
    }) as any

  it("allows writers of an active company", async () => {
    await expect(requireCompanyWriter(db("VERIFIED"), actor)).resolves.toMatchObject({
      companyId: "co-1",
      role: "OWNER",
    })
  })

  it("blocks writes when an admin suspended the company (403 COMPANY_SUSPENDED)", async () => {
    await expect(requireCompanyWriter(db("SUSPENDED"), actor)).rejects.toMatchObject({
      status: 403,
      errorCode: "COMPANY_SUSPENDED",
    })
  })
})
