import { githubVerifiedEmail, googleVerifiedEmail, linkedinVerifiedEmail } from "./oauth-email"
import { decodeOAuthState, encodeOAuthState, resolveRedirect } from "./oauth-state"

describe("OAuth state", () => {
  it("round-trips role + allowed redirect", () => {
    const state = encodeOAuthState({ role: "RECRUITER", redirect: "http://localhost:5173" })
    expect(decodeOAuthState(state)).toEqual({
      role: "RECRUITER",
      redirect: "http://localhost:5173",
    })
  })

  it("rejects tampered state", () => {
    const state = encodeOAuthState({ role: "SEEKER", redirect: "http://localhost:5174" })
    const [body, sig] = state.split(".")
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), r: "RECRUITER" })
    ).toString("base64url")
    expect(decodeOAuthState(`${forged}.${sig}`)).toBeNull()
  })

  it("never redirects to an origin outside the allow-list", () => {
    expect(resolveRedirect("https://evil.example")).not.toBe("https://evil.example")
    expect(resolveRedirect("http://localhost:5173/some/path")).toBe("http://localhost:5173")
  })
})

describe("verified provider e-mails", () => {
  it("google requires email_verified", () => {
    expect(googleVerifiedEmail({ emails: [{ value: "a@b.c", verified: true }] })).toBe("a@b.c")
    expect(googleVerifiedEmail({ emails: [{ value: "a@b.c", verified: false }] })).toBeNull()
  })
  it("github uses the primary verified address", () => {
    expect(
      githubVerifiedEmail({
        emails: [
          { value: "x@b.c", primary: false, verified: true },
          { value: "p@b.c", primary: true, verified: true },
        ],
      })
    ).toBe("p@b.c")
    expect(
      githubVerifiedEmail({ emails: [{ value: "p@b.c", primary: true, verified: false }] })
    ).toBeNull()
  })
  it("linkedin requires email_verified", () => {
    expect(linkedinVerifiedEmail({ email: "l@b.c", email_verified: true })).toBe("l@b.c")
    expect(linkedinVerifiedEmail({ email: "l@b.c" })).toBeNull()
  })
})
