import { ensureRequestId, isHealthPath, requestIdMiddleware } from "./request-id"
import { STRICT_AUTH_PATH } from "./rate-limit"

describe("request ids", () => {
  it("assigns a UUID when missing or unsafe, keeps safe incoming ids", () => {
    const req: any = { headers: {} }
    const id = ensureRequestId(req)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(req.headers["x-correlation-id"]).toBe(id)
    expect(ensureRequestId({ headers: { "x-correlation-id": "abc-12345" } } as any)).toBe("abc-12345")
    expect(ensureRequestId({ headers: { "x-correlation-id": "bad\nid value" } } as any)).not.toBe(
      "bad\nid value"
    )
  })

  it("middleware echoes the id", () => {
    const req: any = { headers: {} }
    const res: any = { setHeader: jest.fn() }
    const next = jest.fn()
    requestIdMiddleware(req, res, next)
    expect(res.setHeader).toHaveBeenCalledWith("x-correlation-id", req.headers["x-correlation-id"])
    expect(next).toHaveBeenCalled()
  })

  it("matches health and strict auth paths", () => {
    expect(isHealthPath("/api/health")).toBe(true)
    expect(isHealthPath("/api/health/ready")).toBe(true)
    expect(isHealthPath("/api/healthy")).toBe(false)
    for (const p of ["login", "register", "forgot-password", "reset-password", "resend-verification", "2fa/verify"])
      expect(STRICT_AUTH_PATH.test(`/api/auth/${p}`)).toBe(true)
    expect(STRICT_AUTH_PATH.test("/api/auth/me")).toBe(false)
  })
})
