import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import {
  assertSafeKey,
  DEFAULT_DOWNLOAD_TTL_SECONDS,
  DownloadUrlOptions,
  StorageDriver,
} from "./storage.driver"

export type S3StorageConfig = {
  bucket: string
  region?: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
  forcePathStyle?: boolean
  /** Optional key prefix inside the bucket (e.g. "uploads/"). */
  prefix?: string
}

export function s3ConfigFromEnv(): S3StorageConfig | null {
  const bucket = process.env.S3_BUCKET?.trim()
  if (!bucket) return null
  return {
    bucket,
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    prefix: process.env.S3_PREFIX?.trim() || "",
  }
}

const isNotFound = (err: any) =>
  err?.name === "NotFound" ||
  err?.name === "NoSuchKey" ||
  err?.Code === "NoSuchKey" ||
  err?.$metadata?.httpStatusCode === 404

/** S3-compatible object storage (AWS S3, Cloudflare R2, MinIO). Downloads use presigned GET URLs. */
export class S3StorageDriver implements StorageDriver {
  readonly kind = "s3" as const
  readonly client: S3Client

  constructor(
    private readonly config: S3StorageConfig,
    client?: S3Client
  ) {
    this.client =
      client ??
      new S3Client({
        region: config.region || "auto",
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        ...(config.accessKeyId && config.secretAccessKey
          ? {
              credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
              },
            }
          : {}),
      })
  }

  private objectKey(key: string) {
    return `${this.config.prefix || ""}${assertSafeKey(key)}`
  }

  async put(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.objectKey(key),
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
      })
    )
  }

  async getBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) })
    )
    const body: any = result.Body
    if (!body) return Buffer.alloc(0)
    if (typeof body.transformToByteArray === "function") {
      return Buffer.from(await body.transformToByteArray())
    }
    const chunks: Buffer[] = []
    for await (const chunk of body) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) })
      )
      return true
    } catch (err) {
      if (isNotFound(err)) return false
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.objectKey(key) })
      )
    } catch (err) {
      if (!isNotFound(err)) throw err
    }
  }

  async getDownloadUrl(key: string, opts: DownloadUrlOptions = {}): Promise<string> {
    const disposition = opts.filename
      ? `inline; filename="${opts.filename.replace(/["\\\r\n]/g, "_")}"`
      : undefined
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: this.objectKey(key),
        ...(disposition ? { ResponseContentDisposition: disposition } : {}),
        ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
      }),
      { expiresIn: opts.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS }
    )
  }
}
