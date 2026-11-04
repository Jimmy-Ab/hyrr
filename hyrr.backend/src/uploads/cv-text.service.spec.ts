import { spawnSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { CvTextService, normalizeCvText } from "./cv-text.service"
import { UploadsService } from "./uploads.service"

/** Minimal single-page PDF with one Helvetica text line. */
function buildPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, "latin1")
}

/** Minimal DOCX (word/document.xml + content types + rels), zipped with mammoth's own jszip. */
async function buildDocx(paragraphs: string[]): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSZip = require("jszip")
  const zip = new JSZip()
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  )
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  )
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  )
  return zip.generateAsync({ type: "nodebuffer" })
}

describe("CvTextService", () => {
  let dir: string
  let service: CvTextService
  const savedDir = process.env.UPLOAD_DIR

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cv-text-"))
    process.env.UPLOAD_DIR = dir
    service = new CvTextService(new UploadsService())
  })

  afterAll(() => {
    if (savedDir === undefined) delete process.env.UPLOAD_DIR
    else process.env.UPLOAD_DIR = savedDir
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const store = (name: string, data: Buffer) => {
    fs.writeFileSync(path.join(dir, name), data)
    return `http://localhost:3000/api/uploads/${name}`
  }

  /**
   * pdfjs (inside pdf-parse) loads its worker with a dynamic import(), which Jest's VM cannot run
   * without --experimental-vm-modules. Real PDFs are therefore extracted in a plain Node child
   * process running this same service through ts-node.
   */
  const extractInNode = (value: string) => {
    const script = `
      const { CvTextService } = require("./src/uploads/cv-text.service")
      const { UploadsService } = require("./src/uploads/uploads.service")
      new CvTextService(new UploadsService()).extract(${JSON.stringify(value)})
        .then((r) => { process.stdout.write("RESULT" + JSON.stringify(r)); process.exit(0) })
    `
    const child = spawnSync(
      process.execPath,
      ["-r", "ts-node/register/transpile-only", "-e", script],
      {
        cwd: path.resolve(__dirname, "../.."),
        env: { ...process.env, UPLOAD_DIR: dir, TS_NODE_TRANSPILE_ONLY: "true" },
        encoding: "utf8",
        timeout: 30_000,
      }
    )
    const out = String(child.stdout || "")
    const at = out.lastIndexOf("RESULT")
    if (at === -1) throw new Error(`child failed: ${child.stderr || out}`)
    return JSON.parse(out.slice(at + "RESULT".length))
  }

  it("extracts text from a real PDF", () => {
    const url = store("u1_cv.pdf", buildPdf("Senior TypeScript Engineer"))
    expect(extractInNode(url)).toEqual({ text: "Senior TypeScript Engineer" })
  }, 30_000)

  it("extracts text from a real DOCX", async () => {
    const url = store("u1_cv.docx", await buildDocx(["Jane Doe", "Kubernetes   expert"]))
    const result = await service.extract(url)
    expect(result.text).toContain("Jane Doe")
    expect(result.text).toContain("Kubernetes expert")
  })

  it("accepts a bare stored filename", async () => {
    store("u2_cv.docx", await buildDocx(["Hello CV"]))
    expect((await service.extract("u2_cv.docx")).text).toBe("Hello CV")
  })

  it("skips legacy .doc files with a note", async () => {
    const url = store("u1_cv.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    expect(await service.extract(url)).toEqual({
      text: null,
      note: "Legacy .doc files can't be read",
    })
  })

  it("never throws for missing or corrupt files", async () => {
    expect((await service.extract("http://localhost:3000/api/uploads/missing.pdf")).text).toBeNull()
    expect((await service.extract(null)).text).toBeNull()
    const corrupt = store("u1_bad.docx", Buffer.from("PK not really a zip"))
    const result = await service.extract(corrupt)
    expect(result.text).toBeNull()
    expect(result.note).toBeTruthy()
  })

  it("normalizes whitespace, drops page markers and caps the length", () => {
    expect(normalizeCvText("a  \t b\r\n\n\n\nc\n-- 1 of 2 --\n")).toBe("a b\n\nc")
    expect(normalizeCvText("x".repeat(30_000))).toHaveLength(20_000)
  })
})
