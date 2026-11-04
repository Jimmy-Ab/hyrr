import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { createHmac, randomUUID, timingSafeEqual } from "crypto"
import * as fs from "fs"
import * as path from "path"
import { jwtSecret } from "../auth/jwt.config"

/** MIME type → allowed extensions. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
}
export const PUBLIC_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
/** `<ownerUserId>_<randomUUID>.<ext>` */
const OWNED_FILENAME = new RegExp(`^([A-Za-z0-9-]{1,64})_(${UUID})(\\.[a-z0-9]{1,5})$`, "i")

export function resolveUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"))
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)
  private readonly uploadDir = resolveUploadDir()

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true })
    }
  }

  getUploadPath(): string {
    return this.uploadDir
  }

  /** Name for a freshly uploaded file; embeds the uploader so ownership can be verified later. */
  buildFilename(userId: string, originalName: string): string {
    const ext = path.extname(originalName).toLowerCase()
    return `${userId}_${randomUUID()}${ext}`
  }

  /** Returns the uploader's userId encoded in a filename, or null for legacy/foreign names. */
  ownerOf(filename: string): string | null {
    const match = OWNED_FILENAME.exec(path.basename(filename))
    return match ? match[1] : null
  }

  private baseUrl() {
    return (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(
      /\/+$/,
      ""
    )
  }

  /** `${PUBLIC_API_URL}/api/uploads/<file>` (+ short-lived token for non-image documents). */
  formatFileUrl(filename: string): string {
    const safe = path.basename(filename)
    const url = `${this.baseUrl()}/api/uploads/${encodeURIComponent(safe)}`
    if (PUBLIC_IMAGE_EXTENSIONS.includes(path.extname(safe).toLowerCase())) return url
    return `${url}?token=${this.createAccessToken(safe)}`
  }

  /** Permanent, token-less URL for a stored upload. This is what gets persisted in the DB. */
  canonicalFileUrl(filename: string): string {
    return `${this.baseUrl()}/api/uploads/${encodeURIComponent(path.basename(filename))}`
  }

  /**
   * Turns a persisted upload URL into one the client can open right now (adds a fresh
   * short-lived token for documents). Non-upload URLs and null are returned unchanged.
   */
  signStoredUrl<T extends string | null | undefined>(value: T): T | string {
    if (!value) return value
    const parsed = this.parseUploadUrl(value)
    return parsed ? this.formatFileUrl(parsed.filename) : value
  }

  private signature(value: string) {
    return createHmac("sha256", process.env.UPLOAD_URL_SECRET || jwtSecret())
      .update(value)
      .digest("base64url")
  }
  createAccessToken(filename: string, expiresInMs = 15 * 60 * 1000) {
    const payload = `${filename}:${Date.now() + expiresInMs}`
    return `${Buffer.from(payload).toString("base64url")}.${this.signature(payload)}`
  }
  verifyAccessToken(filename: string, token?: string) {
    if (!token) return false
    const [encoded, signature] = token.split(".")
    if (!encoded || !signature) return false
    const payload = Buffer.from(encoded, "base64url").toString()
    const separator = payload.lastIndexOf(":")
    const tokenFilename = payload.slice(0, separator)
    const expiry = payload.slice(separator + 1)
    const expected = this.signature(payload)
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return false
    return tokenFilename === filename && Number(expiry) > Date.now()
  }

  getFilename(value: string) {
    try {
      return path.basename(decodeURIComponent(new URL(value).pathname))
    } catch {
      return path.basename(value)
    }
  }

  /**
   * Parses a URL (or bare filename) produced by POST /api/uploads.
   * Returns null when it does not reference one of our stored uploads.
   */
  parseUploadUrl(value: string): { filename: string; ownerId: string | null } | null {
    if (!value || typeof value !== "string") return null
    let filename: string
    try {
      const url = new URL(value)
      if (!/\/uploads\/[^/]+$/.test(url.pathname)) return null
      filename = path.basename(decodeURIComponent(url.pathname))
    } catch {
      if (value.includes("/")) return null
      filename = value
    }
    if (!filename || filename.startsWith(".")) return null
    if (!fs.existsSync(path.join(this.uploadDir, filename))) return null
    return { filename, ownerId: this.ownerOf(filename) }
  }

  /** Returns the stored filename when `value` is an upload owned by `userId`; otherwise 400. */
  assertOwnedUpload(value: string, userId: string): string {
    const parsed = this.parseUploadUrl(value)
    if (!parsed || parsed.ownerId !== userId) {
      throw new BadRequestException("The file must be uploaded through /api/uploads by you")
    }
    return parsed.filename
  }

  /** Removes a stored upload; a missing file is not an error. */
  async deleteFile(filename: string): Promise<void> {
    const safe = path.basename(filename)
    if (!safe || safe.startsWith(".")) return
    try {
      await fs.promises.unlink(path.join(this.uploadDir, safe))
    } catch (err: any) {
      if (err?.code !== "ENOENT")
        this.logger.warn(`Could not delete upload ${safe}: ${err?.message}`)
    }
  }

  validateStoredFile(file: { path: string; mimetype: string; originalname: string }) {
    const data = fs.readFileSync(file.path)
    const extension = path.extname(file.originalname).toLowerCase()
    const isPng =
      data.length >= 8 &&
      data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const isJpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
    const isWebp =
      data.length >= 12 &&
      data.subarray(0, 4).toString("ascii") === "RIFF" &&
      data.subarray(8, 12).toString("ascii") === "WEBP"
    const isPdf = data.subarray(0, 5).toString() === "%PDF-"
    const isZip = data.length >= 4 && data.subarray(0, 2).toString() === "PK"
    const isLegacyDoc =
      data.length >= 8 &&
      data.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    const valid =
      (extension === ".png" && isPng) ||
      ((extension === ".jpg" || extension === ".jpeg") && isJpeg) ||
      (extension === ".webp" && isWebp) ||
      (extension === ".pdf" && isPdf) ||
      (extension === ".docx" && isZip) ||
      (extension === ".doc" && isLegacyDoc)
    if (!valid) {
      fs.unlinkSync(file.path)
      throw new BadRequestException("File content does not match its declared type")
    }
  }
}
