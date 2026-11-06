import { AdminGuard } from "./admin.guard"

const ctx = (user: any) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any

describe("AdminGuard", () => {
  const prisma: any = { user: { findUnique: jest.fn() } }
  const guard = new AdminGuard(prisma)
  beforeEach(() => prisma.user.findUnique.mockReset())

  it("401 UNAUTHORIZED without a user", async () => {
    await expect(guard.canActivate(ctx(undefined))).rejects.toMatchObject({
      status: 401,
      errorCode: "UNAUTHORIZED",
    })
  })

  it.each(["SEEKER", "RECRUITER"])("403 FORBIDDEN for %s", async (role) => {
    await expect(guard.canActivate(ctx({ userId: "u1", role }))).rejects.toMatchObject({
      status: 403,
      errorCode: "FORBIDDEN",
    })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("403 TWO_FACTOR_REQUIRED for an admin without 2FA", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: "ADMIN", twoFactorEnabled: false })
    await expect(guard.canActivate(ctx({ userId: "a1", role: "ADMIN" }))).rejects.toMatchObject({
      status: 403,
      errorCode: "TWO_FACTOR_REQUIRED",
    })
  })

  it("403 FORBIDDEN when the stored role is no longer ADMIN", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: "SEEKER", twoFactorEnabled: true })
    await expect(guard.canActivate(ctx({ userId: "a1", role: "ADMIN" }))).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    })
  })

  it("lets an admin with 2FA through", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: "ADMIN", twoFactorEnabled: true })
    await expect(guard.canActivate(ctx({ userId: "a1", role: "ADMIN" }))).resolves.toBe(true)
  })
})
