import React from "react"

export interface RichTextRendererProps {
  content: string
  className?: string
}

/**
 * Converts simple Markdown syntax into HTML if the string isn't already HTML
 */
function parseContentToHtml(raw: string): string {
  if (!raw) return ""

  // If it's already HTML (contains tags like <h2>, <p>, <ul>, <div>, <strong>)
  const isHtml = /<[a-z][\s\S]*>/i.test(raw)
  if (isHtml) return raw

  // Convert Markdown syntax to clean HTML
  let lines = raw.split("\n")
  let html = ""
  let inList = false
  let isOrdered = false

  lines.forEach((line) => {
    let trimmed = line.trim()

    // Empty line
    if (!trimmed) {
      if (inList) {
        html += isOrdered ? "</ol>" : "</ul>"
        inList = false
      }
      return
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      if (inList) { html += isOrdered ? "</ol>" : "</ul>"; inList = false }
      html += `<h3>${parseInline(trimmed.slice(4))}</h3>`
      return
    }
    if (trimmed.startsWith("## ")) {
      if (inList) { html += isOrdered ? "</ol>" : "</ul>"; inList = false }
      html += `<h2>${parseInline(trimmed.slice(3))}</h2>`
      return
    }
    if (trimmed.startsWith("# ")) {
      if (inList) { html += isOrdered ? "</ol>" : "</ul>"; inList = false }
      html += `<h2>${parseInline(trimmed.slice(2))}</h2>`
      return
    }

    // Unordered List
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (!inList || isOrdered) {
        if (inList) html += isOrdered ? "</ol>" : "</ul>"
        html += "<ul>"
        inList = true
        isOrdered = false
      }
      html += `<li>${parseInline(trimmed.slice(2))}</li>`
      return
    }

    // Ordered List
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
    if (orderedMatch) {
      if (!inList || !isOrdered) {
        if (inList) html += isOrdered ? "</ol>" : "</ul>"
        html += "<ol>"
        inList = true
        isOrdered = true
      }
      html += `<li>${parseInline(orderedMatch[2])}</li>`
      return
    }

    // Normal paragraph
    if (inList) {
      html += isOrdered ? "</ol>" : "</ul>"
      inList = false
    }
    html += `<p>${parseInline(trimmed)}</p>`
  })

  if (inList) {
    html += isOrdered ? "</ol>" : "</ul>"
  }

  return html
}

function parseInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
}

export function RichTextRenderer({ content, className = "" }: RichTextRendererProps) {
  const formattedHtml = parseContentToHtml(content)

  return (
    <div
      className={`rich-text-rendered-content text-[13.5px] text-txt-body leading-relaxed space-y-3 ${className}`}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  )
}
