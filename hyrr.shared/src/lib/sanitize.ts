import DOMPurify from "dompurify"

/** Sanitize untrusted HTML before it reaches innerHTML / dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  if (!html) return ""
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) as unknown as string
}

/** Escape text so it can be safely embedded into an HTML string. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Plain-text length of an HTML string, computed without executing it. */
export function htmlTextLength(html: string): number {
  if (!html) return 0
  const doc = new DOMParser().parseFromString(html, "text/html")
  return (doc.body.textContent || "").length
}
