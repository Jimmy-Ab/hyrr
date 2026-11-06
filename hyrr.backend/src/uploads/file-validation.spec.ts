import { detectFileKind, matchesDeclaredType } from "./file-validation"

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])
const PDF = Buffer.from("%PDF-1.7\n...")
const DOCX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0])
const DOC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])

describe("magic-byte validation", () => {
  it.each([
    [PNG, ".png"],
    [JPEG, ".jpg"],
    [JPEG, ".JPEG"],
    [WEBP, ".webp"],
    [PDF, ".pdf"],
    [DOCX, ".docx"],
    [DOC, ".doc"],
  ])("accepts genuine %#", (buffer, ext) => {
    expect(matchesDeclaredType(buffer, ext)).toBe(true)
  })

  it("rejects spoofed content", () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>")
    expect(matchesDeclaredType(html, ".pdf")).toBe(false)
    expect(matchesDeclaredType(PDF, ".png")).toBe(false)
    expect(matchesDeclaredType(Buffer.from("PK not a zip"), ".docx")).toBe(false)
    expect(matchesDeclaredType(PNG, ".exe")).toBe(false)
    expect(matchesDeclaredType(Buffer.alloc(0), ".pdf")).toBe(false)
  })

  it("detects kinds", () => {
    expect(detectFileKind(PDF)).toBe("pdf")
    expect(detectFileKind(Buffer.from("hello"))).toBeNull()
  })
})
