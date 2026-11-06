/** Magic-byte checks: the buffer content must match the declared file extension. */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

export function detectFileKind(
  data: Buffer
): "png" | "jpeg" | "webp" | "pdf" | "zip" | "ole" | null {
  if (!data || data.length < 3) return null
  if (data.length >= 8 && data.subarray(0, 8).equals(PNG)) return "png"
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg"
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp"
  if (data.length >= 5 && data.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf"
  if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04)
    return "zip"
  if (data.length >= 8 && data.subarray(0, 8).equals(OLE)) return "ole"
  return null
}

const EXPECTED: Record<string, ReturnType<typeof detectFileKind>> = {
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".webp": "webp",
  ".pdf": "pdf",
  ".docx": "zip",
  ".doc": "ole",
}

/** True when `data` starts with the signature of the type implied by `extension`. */
export function matchesDeclaredType(data: Buffer, extension: string): boolean {
  const expected = EXPECTED[extension.toLowerCase()]
  return !!expected && detectFileKind(data) === expected
}
