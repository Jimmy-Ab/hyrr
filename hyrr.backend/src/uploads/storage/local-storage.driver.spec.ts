import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { LocalStorageDriver } from "./local-storage.driver"
import { verifyUploadToken } from "./upload-signing"

describe("LocalStorageDriver", () => {
  let dir: string
  let driver: LocalStorageDriver
  const saved = { ...process.env }

  beforeEach(() => {
    process.env.UPLOAD_URL_SECRET = "test-secret-test-secret-test-secret"
    process.env.PUBLIC_API_URL = "http://api.test"
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hyrr-storage-"))
    driver = new LocalStorageDriver(path.join(dir, "nested"))
  })
  afterEach(() => {
    process.env = { ...saved }
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("round-trips put / exists / getBuffer / delete", async () => {
    const data = Buffer.from("%PDF-1.4 hello")
    await driver.put("u1_file.pdf", data, "application/pdf")
    expect(await driver.exists("u1_file.pdf")).toBe(true)
    expect(driver.existsSync("u1_file.pdf")).toBe(true)
    expect((await driver.getBuffer("u1_file.pdf")).equals(data)).toBe(true)
    await driver.delete("u1_file.pdf")
    expect(await driver.exists("u1_file.pdf")).toBe(false)
    await expect(driver.delete("u1_file.pdf")).resolves.toBeUndefined()
  })

  it("never overwrites an existing key", async () => {
    await driver.put("k.pdf", Buffer.from("a"), "application/pdf")
    await expect(driver.put("k.pdf", Buffer.from("b"), "application/pdf")).rejects.toThrow()
  })

  it("rejects path traversal keys", async () => {
    await expect(driver.getBuffer("../secret")).rejects.toThrow(/Invalid storage key/)
    await expect(driver.put(".env", Buffer.from("x"), "text/plain")).rejects.toThrow()
    expect(driver.existsSync("../../etc/passwd")).toBe(false)
  })

  it("issues HMAC-signed API download URLs", async () => {
    const url = new URL(await driver.getDownloadUrl("u1_file.pdf"))
    expect(url.origin + url.pathname).toBe("http://api.test/api/uploads/u1_file.pdf")
    const token = url.searchParams.get("token")!
    expect(verifyUploadToken("u1_file.pdf", token)).toBe(true)
    expect(verifyUploadToken("u2_other.pdf", token)).toBe(false)
    expect(verifyUploadToken("u1_file.pdf", token + "x")).toBe(false)
  })
})
