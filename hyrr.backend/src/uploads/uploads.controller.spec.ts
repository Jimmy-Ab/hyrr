import * as fs from "fs"
import * as net from "net"
import * as os from "os"
import * as path from "path"
import { LocalStorageDriver } from "./storage/local-storage.driver"
import { S3StorageDriver } from "./storage/s3-storage.driver"
import { UploadsController } from "./uploads.controller"
import { UploadsService } from "./uploads.service"

const PDF = Buffer.from("%PDF-1.4\n%fake but valid header\n")
const file = (buffer: Buffer, originalname: string, mimetype: string) => ({
  buffer,
  originalname,
  mimetype,
  size: buffer.length,
})

describe("UploadsController / UploadsService", () => {
  let dir: string
  let service: UploadsService
  let controller: UploadsController
  const saved = { ...process.env }
  const req = { user: { userId: "user-1" } }

  beforeEach(() => {
    process.env.UPLOAD_URL_SECRET = "test-secret-test-secret-test-secret"
    process.env.PUBLIC_API_URL = "http://api.test"
    delete process.env.CLAMAV_HOST
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hyrr-uploads-"))
    service = new UploadsService(new LocalStorageDriver(dir))
    controller = new UploadsController(service)
  })
  afterEach(() => {
    process.env = { ...saved }
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("stores a genuine PDF and returns a signed URL", async () => {
    const result = await controller.uploadFile(file(PDF, "cv.pdf", "application/pdf"), req)
    expect(result.filename).toMatch(/^user-1_[0-9a-f-]{36}\.pdf$/)
    expect(result.url).toMatch(/^http:\/\/api\.test\/api\/uploads\/user-1_.*\.pdf\?token=/)
    expect(fs.readFileSync(path.join(dir, result.filename)).equals(PDF)).toBe(true)
    expect(service.assertOwnedUpload(result.url, "user-1")).toBe(result.filename)
    expect(() => service.assertOwnedUpload(result.url, "user-2")).toThrow()
  })

  it("rejects spoofed files and stores nothing", async () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>")
    await expect(
      controller.uploadFile(file(html, "cv.pdf", "application/pdf"), req)
    ).rejects.toMatchObject({ errorCode: "FILE_TYPE_MISMATCH" })
    await expect(
      controller.uploadFile(file(PDF, "photo.png", "image/png"), req)
    ).rejects.toMatchObject({ status: 400 })
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it("requires a file", async () => {
    await expect(controller.uploadFile(undefined, req)).rejects.toMatchObject({ status: 400 })
  })

  it("parseUploadUrl does not hit object storage and requires the generated filename shape", () => {
    const client = { send: jest.fn() }
    const s3 = new UploadsService(new S3StorageDriver({ bucket: "b" }, client as any))
    const name = "user-1_123e4567-e89b-12d3-a456-426614174000.pdf"
    expect(s3.parseUploadUrl(`http://api.test/api/uploads/${name}`)).toEqual({
      filename: name,
      ownerId: "user-1",
    })
    expect(s3.parseUploadUrl("http://api.test/api/uploads/legacy.pdf")).toBeNull()
    expect(s3.parseUploadUrl("https://evil.test/whatever")).toBeNull()
    expect(client.send).not.toHaveBeenCalled()
    expect(s3.signStoredUrl(`http://api.test/api/uploads/${name}`)).toContain("?token=")
  })

  it("download serves local files only with a valid token (images are public)", async () => {
    const { filename } = await controller.uploadFile(file(PDF, "cv.pdf", "application/pdf"), req)
    const res: any = { setHeader: jest.fn(), sendFile: jest.fn(), redirect: jest.fn() }
    await expect(controller.download(filename, undefined, res)).rejects.toMatchObject({
      status: 401,
    })
    const token = service.createAccessToken(filename)
    await controller.download(filename, token, res)
    expect(res.sendFile).toHaveBeenCalledWith(filename, { root: dir, dotfiles: "deny" })
  })

  it("download redirects to a presigned URL with the S3 driver", async () => {
    const driver = new S3StorageDriver({ bucket: "b" }, { send: jest.fn() } as any)
    jest.spyOn(driver, "getDownloadUrl").mockResolvedValue("https://s3.test/signed")
    const s3Service = new UploadsService(driver)
    const s3Controller = new UploadsController(s3Service)
    const name = "user-1_123e4567-e89b-12d3-a456-426614174000.pdf"
    const res: any = { setHeader: jest.fn(), sendFile: jest.fn(), redirect: jest.fn() }
    await s3Controller.download(name, s3Service.createAccessToken(name), res)
    expect(res.redirect).toHaveBeenCalledWith(302, "https://s3.test/signed")
  })

  describe("ClamAV", () => {
    let server: net.Server
    let reply: string
    let received: Buffer

    beforeEach(async () => {
      server = net.createServer((socket) => {
        const chunks: Buffer[] = []
        socket.on("data", (d) => {
          chunks.push(d)
          const all = Buffer.concat(chunks)
          // Request ends with a zero-length chunk.
          if (all.length >= 14 && all.subarray(-4).equals(Buffer.alloc(4))) {
            received = all
            socket.end(reply)
          }
        })
      })
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
      process.env.CLAMAV_HOST = "127.0.0.1"
      process.env.CLAMAV_PORT = String((server.address() as net.AddressInfo).port)
    })
    afterEach(() => new Promise<void>((r) => server.close(() => r())))

    it("accepts clean files using INSTREAM", async () => {
      reply = "stream: OK\0"
      const result = await controller.uploadFile(file(PDF, "cv.pdf", "application/pdf"), req)
      expect(result.filename).toBeTruthy()
      expect(received.subarray(0, 10).toString()).toBe("zINSTREAM\0")
      expect(received.readUInt32BE(10)).toBe(PDF.length)
    })

    it("rejects infected files with 400 FILE_INFECTED", async () => {
      reply = "stream: Eicar-Test-Signature FOUND\0"
      await expect(
        controller.uploadFile(file(PDF, "cv.pdf", "application/pdf"), req)
      ).rejects.toMatchObject({ errorCode: "FILE_INFECTED", status: 400 })
      expect(fs.readdirSync(dir)).toEqual([])
    })

    it("fails closed (503) when the scanner is unreachable", async () => {
      process.env.CLAMAV_PORT = "1"
      jest.spyOn((service as any).logger, "error").mockImplementation(() => undefined)
      await expect(
        controller.uploadFile(file(PDF, "cv.pdf", "application/pdf"), req)
      ).rejects.toMatchObject({ status: 503 })
    })
  })
})
