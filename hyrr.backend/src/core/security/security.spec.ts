import { CaptchaService } from "./captcha.service"
import { decryptSecret, encryptSecret } from "./secret-box"

describe("CaptchaService", () => {
  const env = { ...process.env }
  const realFetch = global.fetch
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock as any
  })
  afterEach(() => {
    process.env = { ...env }
    global.fetch = realFetch
  })

  it("is disabled (and always passes) without TURNSTILE_SECRET_KEY", async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const captcha = new CaptchaService()
    expect(captcha.isEnabled()).toBe(false)
    await expect(captcha.verify(undefined)).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requires a token when enabled", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    await expect(new CaptchaService().verify(undefined)).rejects.toMatchObject({
      errorCode: "CAPTCHA_REQUIRED",
      status: 400,
    })
  })

  it("accepts tokens Turnstile confirms and rejects the rest", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    const captcha = new CaptchaService()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    await expect(captcha.verify("good", "1.2.3.4")).resolves.toBeUndefined()
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(body.get("response")).toBe("good")
    expect(body.get("remoteip")).toBe("1.2.3.4")

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) })
    await expect(captcha.verify("bad")).rejects.toMatchObject({ errorCode: "CAPTCHA_FAILED" })
  })

  it("fails closed when Turnstile is unreachable", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    fetchMock.mockRejectedValueOnce(new Error("network down"))
    await expect(new CaptchaService().verify("tok")).rejects.toMatchObject({
      errorCode: "CAPTCHA_FAILED",
    })
  })
})

describe("secret box (AES-256-GCM)", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP")
    const b = encryptSecret("JBSWY3DPEHPK3PXP")
    expect(a).not.toBe(b)
    expect(a).not.toContain("JBSWY3DPEHPK3PXP")
    expect(decryptSecret(a)).toBe("JBSWY3DPEHPK3PXP")
  })

  it("returns null for tampered or malformed values", () => {
    const boxed = encryptSecret("secret")
    const parts = boxed.split(":")
    parts[3] = Buffer.from("x" + Buffer.from(parts[3], "base64url").toString()).toString(
      "base64url"
    )
    expect(decryptSecret(parts.join(":"))).toBeNull()
    expect(decryptSecret("garbage")).toBeNull()
    expect(decryptSecret(null)).toBeNull()
  })

  it("depends on TWO_FACTOR_ENCRYPTION_KEY when set", () => {
    const env = { ...process.env }
    try {
      process.env.TWO_FACTOR_ENCRYPTION_KEY = "key-one-key-one-key-one-key-one-1"
      const boxed = encryptSecret("secret")
      process.env.TWO_FACTOR_ENCRYPTION_KEY = "key-two-key-two-key-two-key-two-2"
      expect(decryptSecret(boxed)).toBeNull()
    } finally {
      process.env = env
    }
  })
})
