import {
  Bold,
  Code,
  Code2,
  Eraser,
  Eye,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Sparkles,
  Strikethrough,
  Type,
  Underline,
} from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"

export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  className?: string
  error?: string
}

// Pre-packaged professional job description templates
const TEMPLATES = [
  {
    name: "Standard Role Template",
    content: `<h2>Role Overview</h2>
<p>We are seeking a talented and passionate professional to join our fast-growing team. In this role, you will lead key initiatives, build impactful solutions, and collaborate closely with cross-functional squads.</p>

<h2>Key Responsibilities</h2>
<ul>
  <li>Design, develop, and deploy scalable solutions across core product surfaces.</li>
  <li>Partner with product managers, designers, and engineers to define technical roadmaps.</li>
  <li>Ensure high code quality through technical code reviews and automated testing.</li>
  <li>Troubleshoot production issues and optimize application performance.</li>
</ul>

<h2>Requirements & Qualifications</h2>
<ul>
  <li><strong>3+ years</strong> of relevant industry experience in software or product engineering.</li>
  <li>Strong proficiency in modern development stacks, frameworks, and APIs.</li>
  <li>Excellent communication and problem-solving skills.</li>
</ul>

<h2>Benefits & Perks</h2>
<ul>
  <li>Competitive base salary + equity compensation package.</li>
  <li>Flexible remote / hybrid working model.</li>
  <li>Comprehensive health, dental, and vision insurance.</li>
</ul>`,
  },
]

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your job description here...",
  minHeight = "220px",
  className = "",
  error,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isRawMode, setIsRawMode] = useState(false)
  const [rawText, setRawText] = useState(value || "")
  const [isFocused, setIsFocused] = useState(false)
  const isInternalUpdate = useRef(false)

  // Sync internal editor content with incoming value prop if changed externally
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || ""
      }
    }
    setRawText(value || "")
    isInternalUpdate.current = false
  }, [value])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      // Clean empty break tags
      const cleaned = html === "<br>" || html === "<div><br></div>" ? "" : html
      isInternalUpdate.current = true
      onChange(cleaned)
      setRawText(cleaned)
    }
  }, [onChange])

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (isRawMode) return
    editorRef.current?.focus()
    document.execCommand(command, false, arg)
    handleInput()
  }

  const insertTemplate = () => {
    const template = TEMPLATES[0].content
    if (editorRef.current) {
      editorRef.current.innerHTML = template
      handleInput()
    }
  }

  const toggleRawMode = () => {
    if (isRawMode) {
      // Switching from raw mode back to visual editor
      if (editorRef.current) {
        editorRef.current.innerHTML = rawText
      }
      isInternalUpdate.current = true
      onChange(rawText)
      setIsRawMode(false)
    } else {
      // Switching to raw mode
      setIsRawMode(true)
    }
  }

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setRawText(val)
    isInternalUpdate.current = true
    onChange(val)
  }

  // Calculate plain text char count for indicator
  const getCharCount = () => {
    const tmp = document.createElement("DIV")
    tmp.innerHTML = value || ""
    return (tmp.textContent || tmp.innerText || "").length
  }

  const isEmpty = !value || value.trim() === "" || value === "<br>" || value === "<div><br></div>"

  return (
    <div
      className={`w-full rounded-input border transition-all duration-200 overflow-hidden bg-bg-secondary ${
        error
          ? "border-sec-red ring-2 ring-sec-red/10"
          : isFocused
            ? "border-primary/40 ring-2 ring-primary/10 shadow-sm"
            : "border-bg-border hover:border-primary/20"
      } ${className}`}
    >
      {/* ── Toolbar Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-1 px-3 py-2 border-b border-bg-border/60 bg-bg-primary/70 backdrop-blur-sm select-none">
        <div className="flex items-center flex-wrap gap-0.5">
          {/* Formatting Controls */}
          <ToolbarButton
            icon={<Bold className="w-4 h-4" />}
            title="Bold (Ctrl+B)"
            disabled={isRawMode}
            onClick={() => executeCommand("bold")}
          />
          <ToolbarButton
            icon={<Italic className="w-4 h-4" />}
            title="Italic (Ctrl+I)"
            disabled={isRawMode}
            onClick={() => executeCommand("italic")}
          />
          <ToolbarButton
            icon={<Underline className="w-4 h-4" />}
            title="Underline (Ctrl+U)"
            disabled={isRawMode}
            onClick={() => executeCommand("underline")}
          />
          <ToolbarButton
            icon={<Strikethrough className="w-4 h-4" />}
            title="Strikethrough"
            disabled={isRawMode}
            onClick={() => executeCommand("strikeThrough")}
          />

          <ToolbarDivider />

          {/* Headings */}
          <ToolbarButton
            icon={<Heading2 className="w-4 h-4" />}
            title="Section Heading (H2)"
            disabled={isRawMode}
            onClick={() => executeCommand("formatBlock", "<h2>")}
          />
          <ToolbarButton
            icon={<Heading3 className="w-4 h-4" />}
            title="Subheading (H3)"
            disabled={isRawMode}
            onClick={() => executeCommand("formatBlock", "<h3>")}
          />
          <ToolbarButton
            icon={<Type className="w-4 h-4" />}
            title="Normal Paragraph"
            disabled={isRawMode}
            onClick={() => executeCommand("formatBlock", "<p>")}
          />

          <ToolbarDivider />

          {/* Lists & Blocks */}
          <ToolbarButton
            icon={<List className="w-4 h-4" />}
            title="Bulleted List"
            disabled={isRawMode}
            onClick={() => executeCommand("insertUnorderedList")}
          />
          <ToolbarButton
            icon={<ListOrdered className="w-4 h-4" />}
            title="Numbered List"
            disabled={isRawMode}
            onClick={() => executeCommand("insertOrderedList")}
          />
          <ToolbarButton
            icon={<Quote className="w-4 h-4" />}
            title="Quote Block"
            disabled={isRawMode}
            onClick={() => executeCommand("formatBlock", "<blockquote>")}
          />
          <ToolbarButton
            icon={<Code className="w-4 h-4" />}
            title="Inline Code"
            disabled={isRawMode}
            onClick={() => executeCommand("formatBlock", "<pre>")}
          />

          <ToolbarDivider />

          {/* Clear Formatting */}
          <ToolbarButton
            icon={<Eraser className="w-4 h-4 text-txt-disabled hover:text-txt-heading" />}
            title="Clear Selection Formatting"
            disabled={isRawMode}
            onClick={() => executeCommand("removeFormat")}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={insertTemplate}
            disabled={isRawMode}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary bg-primary-light hover:bg-primary-light/80 border border-primary-border/40 px-2.5 py-1 rounded-[8px] transition-all cursor-pointer disabled:opacity-50"
            title="Insert a pre-formatted professional job structure"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Template</span>
          </button>

          <button
            type="button"
            onClick={toggleRawMode}
            className={`inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-1 rounded-[8px] border transition-all cursor-pointer ${
              isRawMode
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-bg-primary text-txt-body border-bg-border hover:bg-bg-hover hover:text-txt-heading"
            }`}
            title={
              isRawMode ? "Switch to Visual Rich Text Editor" : "Switch to Raw HTML/Markdown View"
            }
          >
            {isRawMode ? <Eye className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
            <span>{isRawMode ? "Visual" : "HTML"}</span>
          </button>
        </div>
      </div>

      {/* ── Content Canvas Area ───────────────────────────────────────── */}
      <div className="relative">
        {!isRawMode ? (
          <>
            <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{ minHeight }}
              className="w-full p-4 text-[13.5px] text-txt-heading focus:outline-none leading-relaxed overflow-y-auto rich-text-content"
            />
            {isEmpty && (
              <div
                className="absolute top-4 left-4 text-[13.5px] text-txt-disabled pointer-events-none select-none font-normal"
                style={{ pointerEvents: "none" }}
              >
                {placeholder}
              </div>
            )}
          </>
        ) : (
          <textarea
            value={rawText}
            onChange={handleRawChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{ minHeight }}
            placeholder="Write HTML or plain text content..."
            className="w-full p-4 font-mono text-[12.5px] text-txt-heading bg-bg-secondary/80 focus:outline-none leading-relaxed resize-none border-0"
          />
        )}
      </div>

      {/* ── Footer Info Line ─────────────────────────────────────────── */}
      <div className="px-3 py-1.5 bg-bg-primary/50 border-t border-bg-border/40 flex items-center justify-between text-[11px] text-txt-disabled select-none">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sec-green" />
          Rich Text Editor Active
        </span>
        <span className="font-semibold">{getCharCount()} text characters</span>
      </div>
    </div>
  )
}

function ToolbarButton({
  icon,
  title,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-[6px] text-txt-body hover:text-txt-heading hover:bg-bg-hover disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
    >
      {icon}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-bg-border/70 mx-1 self-center" />
}
