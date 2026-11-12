/** Structured blocks parsed from a provider's plain-text job description. */
export type DescriptionBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }

const BULLET = /^\s*(?:[-•*·–▪◦]|\d{1,2}[.)])\s+/
/** A short line on its own that reads like a section title ("What you'll bring", "Benefits:"). */
const isHeading = (line: string, next: string | undefined) => {
  const t = line.trim()
  if (!t || BULLET.test(t) || t.length > 60) return false
  if (/:$/.test(t)) return true
  if (/[.,;!?]$/.test(t)) return false
  const words = t.split(/\s+/).length
  // Followed by content, and short enough to be a title rather than a sentence.
  return words <= 8 && !!next?.trim()
}

/**
 * Turns plain text (lines + blank lines, as stored for jobs from the web) into headings,
 * paragraphs and bullet lists. Purely presentational: no text is added or removed.
 */
export function descriptionBlocks(text: string): DescriptionBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const blocks: DescriptionBlock[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", text: para.join(" ") })
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ kind: "list", items: list })
    list = []
  }
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
      return
    }
    if (BULLET.test(line)) {
      flushPara()
      list.push(line.replace(BULLET, ""))
      return
    }
    flushList()
    const next = lines.slice(i + 1).find((l) => l.trim())
    if (isHeading(line, next) && para.length === 0) {
      blocks.push({ kind: "heading", text: line.replace(/:$/, "") })
      return
    }
    // Lines inside one paragraph that each end a sentence read better as separate paragraphs.
    if (para.length && /[.!?]$/.test(para[para.length - 1])) flushPara()
    para.push(line)
  })
  flushPara()
  flushList()
  return blocks
}
