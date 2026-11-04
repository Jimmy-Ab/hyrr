import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import { S3StorageDriver, s3ConfigFromEnv } from "./s3-storage.driver"

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://bucket.s3.test/u1_a.pdf?X-Amz-Signature=abc"),
}))
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")

describe("S3StorageDriver", () => {
  let client: { send: jest.Mock }
  let driver: S3StorageDriver

  beforeEach(() => {
    client = { send: jest.fn() }
    driver = new S3StorageDriver({ bucket: "hyrr", prefix: "uploads/" }, client as any)
  })

  it("puts objects with content type under the prefix", async () => {
    client.send.mockResolvedValue({})
    await driver.put("u1_a.pdf", Buffer.from("%PDF-"), "application/pdf")
    const cmd = client.send.mock.calls[0][0]
    expect(cmd).toBeInstanceOf(PutObjectCommand)
    expect(cmd.input).toMatchObject({
      Bucket: "hyrr",
      Key: "uploads/u1_a.pdf",
      ContentType: "application/pdf",
      ContentLength: 5,
    })
  })

  it("reads objects into a buffer", async () => {
    client.send.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    })
    const buffer = await driver.getBuffer("u1_a.pdf")
    expect(client.send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand)
    expect([...buffer]).toEqual([1, 2, 3])
  })

  it("exists → HeadObject; 404 means false, other errors propagate", async () => {
    client.send.mockResolvedValueOnce({})
    expect(await driver.exists("u1_a.pdf")).toBe(true)
    expect(client.send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand)
    client.send.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } })
    expect(await driver.exists("u1_a.pdf")).toBe(false)
    client.send.mockRejectedValueOnce(new Error("AccessDenied"))
    await expect(driver.exists("u1_a.pdf")).rejects.toThrow("AccessDenied")
  })

  it("delete ignores missing objects", async () => {
    client.send.mockRejectedValueOnce({ name: "NoSuchKey" })
    await expect(driver.delete("u1_a.pdf")).resolves.toBeUndefined()
    expect(client.send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand)
  })

  it("presigns GET URLs for 15 minutes by default", async () => {
    const url = await driver.getDownloadUrl("u1_a.pdf", { filename: 'my "cv".pdf' })
    expect(url).toContain("X-Amz-Signature")
    const [, command, opts] = getSignedUrl.mock.calls[0]
    expect(command).toBeInstanceOf(GetObjectCommand)
    expect(command.input.Key).toBe("uploads/u1_a.pdf")
    expect(command.input.ResponseContentDisposition).toBe('inline; filename="my _cv_.pdf"')
    expect(opts).toEqual({ expiresIn: 900 })
  })

  it("rejects unsafe keys", async () => {
    await expect(driver.getBuffer("../x")).rejects.toThrow(/Invalid storage key/)
  })

  it("reads config from env (R2/MinIO endpoint + path style)", () => {
    const saved = { ...process.env }
    try {
      delete process.env.S3_BUCKET
      expect(s3ConfigFromEnv()).toBeNull()
      Object.assign(process.env, {
        S3_BUCKET: "b",
        S3_ENDPOINT: "http://minio:9000",
        S3_FORCE_PATH_STYLE: "true",
      })
      expect(s3ConfigFromEnv()).toMatchObject({
        bucket: "b",
        endpoint: "http://minio:9000",
        forcePathStyle: true,
        region: "auto",
      })
      // Constructing a real client must not throw or hit the network.
      expect(() => new S3StorageDriver(s3ConfigFromEnv()!)).not.toThrow()
    } finally {
      process.env = saved
    }
  })
})
