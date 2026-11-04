import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common"
import { randomUUID } from "crypto"
import * as path from "path"
import { AppException } from "../core/exceptions/app-exception"
import { clamAvConfigFromEnv, scanBuffer } from "./clamav"
import { matchesDeclaredType } from "./file-validation"
import { LocalStorageDriver } from "./storage/local-storage.driver"
import { createStorageDriver } from "./storage/storage.factory"
import { STORAGE_DRIVER, StorageDriver } from "./storage/storage.driver"
import { createUploadToken, uploadApiUrl, verifyUploadToken } from "./storage/upload-signing"

export { resolveUploadDir } from "./storage/local-storage.driver"

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

export type IncomingUpload = { buffer: Buffer; mimetype: string; originalname: string; size: number }

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)
  readonly storage: StorageDriver

  constructor(@Optional() @Inject(STORAGE_DRIVER) storage?: StorageDriver) {
    this.storage = storage ?? createStorageDriver()
  }

  /** Local upload directory (local driver only). */
  getUploadPath(): string {
    return this.storage instanceof LocalStorageDriver ? this.storage.dir : ""
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

  /** `${PUBLIC_API_URL}/api/uploads/<file>` (+ short-lived token for non-image documents). */
  formatFileUrl(filename: string): string {
    const safe = path.basename(filename)
    const url = uploadApiUrl(safe)
    if (PUBLIC_IMAGE_EXTENSIONS.includes(path.extname(safe).toLowerCase())) return url
    return `${url}?token=${this.createAccessToken(safe)}`
  }

  /** Permanent, token-less URL for a stored upload. This is what gets persisted in the DB. */
  canonicalFileUrl(filename: string): string {
    return uploadApiUrl(path.basename(filename))
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

  createAccessToken(filename: string, expiresInMs = 15 * 60 * 1000) {
    return createUploadToken(filename, expiresInMs)
  }
  verifyAccessToken(filename: string, token?: string) {
    return verifyUploadToken(filename, token)
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
   * Local driver: checks the file exists on disk. Object storage: no network call, the
   * filename must have the server-generated `<owner>_<uuid>.<ext>` shape
   * (use `fileExists` where existence matters).
   */
  parseUploadUrl(value: string): { filename: string; ownerId: string | null } | null {
    if (!value || typeof value !== "string") return null
    let filename: string
    try {
      const url = new URL(value)
      if (!/\/uploads\/[^/]+$/.test(url.pathname)) return null
      filename = path.basename(decodeURIComponent(url.pathname))
    } catch {
      if (value.includes("/") || value.includes("\\")) return null
      filename = value
    }
    if (!filename || filename.startsWith(".")) return null
    const ownerId = this.ownerOf(filename)
    if (this.storage instanceof LocalStorageDriver) {
      if (!this.storage.existsSync(filename)) return null
    } else if (!ownerId) {
      return null
    }
    return { filename, ownerId }
  }

  /** Returns the stored filename when `value` is an upload owned by `userId`; otherwise 400. */
  assertOwnedUpload(value: string, userId: string): string {
    const parsed = this.parseUploadUrl(value)
    if (!parsed || parsed.ownerId !== userId) {
      throw new BadRequestException("The file must be uploaded through /api/uploads by you")
    }
    return parsed.filename
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      return await this.storage.exists(path.basename(filename))
    } catch (err: any) {
      this.logger.warn(`Could not check upload ${filename}: ${err?.message}`)
      return false
    }
  }

  /** Reads a stored upload. */
  async readFile(filename: string): Promise<Buffer> {
    return this.storage.getBuffer(path.basename(filename))
  }

  /** Removes a stored upload; a missing file is not an error. */
  async deleteFile(filename: string): Promise<void> {
    const safe = path.basename(filename)
    if (!safe || safe.startsWith(".")) return
    try {
      await this.storage.delete(safe)
    } catch (err: any) {
      this.logger.warn(`Could not delete upload ${safe}: ${err?.message}`)
    }
  }

  /** Throws 400 when the buffer's magic bytes don't match the declared extension. */
  validateBuffer(buffer: Buffer, originalName: string) {
    if (!matchesDeclaredType(buffer, path.extname(originalName))) {
      throw new AppException(
        "File content does not match its declared type",
        HttpStatus.BAD_REQUEST,
        "FILE_TYPE_MISMATCH"
      )
    }
  }

  /** ClamAV INSTREAM scan when CLAMAV_HOST is set. Infected → 400 FILE_INFECTED. */
  async scan(buffer: Buffer): Promise<void> {
    const config = clamAvConfigFromEnv()
    if (!config) return
    let result
    try {
      result = await scanBuffer(buffer, config)
    } catch (err: any) {
      this.logger.error(`Virus scan unavailable: ${err?.message}`)
      if (process.env.CLAMAV_FAIL_OPEN === "true") return
      throw new ServiceUnavailableException("File scanning is temporarily unavailable")
    }
    if (result.infected) {
      this.logger.warn(`Rejected infected upload (${result.signature})`)
      throw new AppException(
        "The file was rejected by the virus scanner",
        HttpStatus.BAD_REQUEST,
        "FILE_INFECTED"
      )
    }
  }

  /** Validates, scans and stores an uploaded file. Returns the generated filename (storage key). */
  async store(userId: string, file: IncomingUpload): Promise<string> {
    this.validateBuffer(file.buffer, file.originalname)
    await this.scan(file.buffer)
    const filename = this.buildFilename(userId, file.originalname)
    await this.storage.put(filename, file.buffer, file.mimetype)
    return filename
  }
}
