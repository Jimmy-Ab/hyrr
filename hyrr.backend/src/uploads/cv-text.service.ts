import { Injectable, Logger } from "@nestjs/common"
import * as path from "path"
import { UploadsService } from "./uploads.service"

export const CV_TEXT_MAX_CHARS = 20_000
export const CV_EXTRACT_TIMEOUT_MS = 10_000

export type CvTextResult = { text: string | null; note?: string }

/** Collapses whitespace, drops pdf-parse page markers and caps the length. */
export function normalizeCvText(raw: string, max = CV_TEXT_MAX_CHARS): string {
  const clean = raw
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*-- \d+ of \d+ --\s*$/gm, "")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return clean.length > max ? clean.slice(0, max) : clean
}

/** Extracts plain text from stored CV uploads (PDF / DOCX) for AI analysis. Never throws. */
@Injectable()
export class CvTextService {
  private readonly logger = new Logger(CvTextService.name)

  constructor(private readonly uploads: UploadsService) {}

  async extract(urlOrFilename: string | null | undefined): Promise<CvTextResult> {
    if (!urlOrFilename) return { text: null, note: "No CV attached" }
    const parsed = this.uploads.parseUploadUrl(urlOrFilename)
    if (!parsed) return { text: null, note: "CV file not found" }
    const filename = path.basename(parsed.filename)
    let timer: NodeJS.Timeout | undefined
    try {
      const timeout = new Promise<CvTextResult>((resolve) => {
        timer = setTimeout(
          () => resolve({ text: null, note: "Reading the CV took too long" }),
          CV_EXTRACT_TIMEOUT_MS
        )
      })
      return await Promise.race([this.read(filename), timeout])
    } catch (err) {
      this.logger.warn(`CV text extraction failed for ${parsed.filename}: ${(err as Error)?.message}`)
      return { text: null, note: "The CV file could not be read" }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private async read(filename: string): Promise<CvTextResult> {
    const buffer = await this.uploads.readFile(filename)
    return this.extractFromBuffer(buffer, path.extname(filename))
  }

  async extractFromBuffer(buffer: Buffer, extension: string): Promise<CvTextResult> {
    const ext = extension.toLowerCase()
    let raw: string
    if (ext === ".pdf") raw = await this.pdfText(buffer)
    else if (ext === ".docx") raw = await this.docxText(buffer)
    else if (ext === ".doc") return { text: null, note: "Legacy .doc files can't be read" }
    else return { text: null, note: `Unsupported CV format (${ext || "unknown"})` }

    const text = normalizeCvText(raw || "")
    if (!text) return { text: null, note: "No readable text in the CV (scanned image?)" }
    return { text }
  }

  private async pdfText(buffer: Buffer): Promise<string> {
    // pdf-parse v2 is CommonJS-exported; required lazily so startup never depends on pdfjs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const result = await parser.getText()
      return result?.text || ""
    } finally {
      await Promise.resolve(parser.destroy()).catch(() => undefined)
    }
  }

  private async docxText(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return result?.value || ""
  }
}
