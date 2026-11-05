import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUp, Loader2, RotateCcw, Sparkles, X } from "lucide-react"
import * as React from "react"
import { escapeHtml, sanitizeHtml } from "../../lib/sanitize"
import { cn } from "../../lib/utils"
import { useJobStore } from "../../store/useJobStore"
import { EASE_APPLE, EASE_OUT_EXPO } from "./motion"

function formatBold(text: string): string {
  return sanitizeHtml(escapeHtml(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"))
}

/** Minimal markdown: **bold** lines/inline, "-"/"•" bullets, numbered lists, blank lines. */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (trimmed === "") return <div key={i} className="h-0.5" />
        if (/^\*\*[^*]+\*\*:?$/.test(trimmed))
          return (
            <p key={i} className="font-semibold text-txt-title">
              {trimmed.replace(/\*\*/g, "")}
            </p>
          )
        const bullet = /^([•\-*]|\d+\.)\s+(.*)$/.exec(trimmed)
        if (bullet)
          return (
            <div key={i} className="flex gap-2">
              <span
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70"
                aria-hidden="true"
              />
              <span dangerouslySetInnerHTML={{ __html: formatBold(bullet[2]) }} />
            </div>
          )
        return <p key={i} dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
      })}
    </div>
  )
}

/** Three dots that breathe (opacity wave), Apple-style, instead of bouncing. */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Hyrr AI is typing" role="status">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary"
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
        />
      ))}
    </div>
  )
}

interface AiChatWidgetProps {
  role?: "SEEKER" | "RECRUITER"
}

const PROMPTS = {
  SEEKER: [
    "How can I improve my profile?",
    "Prepare me for an interview",
    "Help me negotiate salary",
    "Write a cover letter",
  ],
  RECRUITER: [
    "Write a job description",
    "Interview questions for a React developer",
    "How do I evaluate a candidate?",
    "Pipeline best practices",
  ],
}

export function AiChatWidget({ role = "SEEKER" }: AiChatWidgetProps) {
  const { aiChatMessages, aiChatLoading, aiChatOpen, sendAiChat, clearAiChat, setAiChatOpen } =
    useJobStore()
  const reduce = useReducedMotion()
  const [input, setInput] = React.useState("")
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  // Replies that arrived while the panel was closed (the badge), not every reply ever.
  const assistantCount = aiChatMessages.filter((m) => m.role === "assistant").length
  const [seen, setSeen] = React.useState(assistantCount)
  const unread = aiChatOpen ? 0 : Math.max(0, assistantCount - seen)

  React.useEffect(() => {
    if (aiChatOpen) setSeen(assistantCount)
  }, [aiChatOpen, assistantCount])

  // Keep the newest message in view.
  React.useEffect(() => {
    const el = listRef.current
    if (aiChatOpen && el)
      el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" })
  }, [aiChatMessages.length, aiChatLoading, aiChatOpen, reduce])

  // Focus the input on open; Escape closes and returns focus to the button.
  React.useEffect(() => {
    if (!aiChatOpen) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 120)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAiChatOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKey)
    }
  }, [aiChatOpen, setAiChatOpen])

  // Auto-grow the composer up to 5 lines.
  React.useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input, aiChatOpen])

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg || aiChatLoading) return
    setInput("")
    await sendAiChat(msg)
  }

  const subtitle = role === "SEEKER" ? "Career assistant" : "Recruiting assistant"

  return (
    <>
      {/* ─── Floating button ─── */}
      <motion.button
        ref={triggerRef}
        id="ai-chat-trigger"
        type="button"
        onClick={() => setAiChatOpen(!aiChatOpen)}
        aria-label={aiChatOpen ? "Close Hyrr AI" : "Ask Hyrr AI"}
        aria-expanded={aiChatOpen}
        aria-controls="ai-chat-panel"
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={reduce ? undefined : { scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
        className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:bottom-6 sm:right-6"
      >
        {/* Soft breathing halo (off with reduced motion and while open). */}
        {!aiChatOpen && !reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-primary/40"
            animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", repeatDelay: 1.2 }}
          />
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,#8b7dff,#6c63ff,#4f8ef7,#8b7dff)] shadow-[0_10px_30px_-6px_rgba(108,99,255,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] transition-shadow duration-300 group-hover:shadow-[0_16px_40px_-8px_rgba(108,99,255,0.8),inset_0_1px_0_rgba(255,255,255,0.4)]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-[1.5px] rounded-full bg-gradient-to-b from-white/20 to-transparent"
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={aiChatOpen ? "close" : "open"}
            initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_APPLE }}
            className="relative"
          >
            {aiChatOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-6 w-6" />}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg-primary bg-sec-green px-1 text-[10px] font-bold text-white"
            >
              <span className="sr-only">New replies: </span>
              {unread}
            </motion.span>
          )}
        </AnimatePresence>
        {/* Hover label */}
        {!aiChatOpen && (
          <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 hidden -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-full glass border border-bg-border/70 px-3 py-1.5 text-[12px] font-semibold text-txt-heading opacity-0 shadow-card transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0 group-hover:opacity-100 sm:block">
            Ask Hyrr AI
          </span>
        )}
      </motion.button>

      {/* ─── Panel ─── */}
      <AnimatePresence>
        {aiChatOpen && (
          <motion.div
            id="ai-chat-panel"
            role="dialog"
            aria-label="Hyrr AI assistant"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16, filter: "blur(8px)" }
            }
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={
              reduce
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    scale: 0.95,
                    y: 10,
                    filter: "blur(6px)",
                    transition: { duration: 0.2, ease: EASE_APPLE },
                  }
            }
            transition={{ duration: 0.42, ease: EASE_OUT_EXPO }}
            style={{ transformOrigin: "bottom right" }}
            className="glass fixed inset-x-3 bottom-[84px] z-50 flex h-[min(72vh,600px)] flex-col overflow-hidden rounded-[24px] border border-bg-border/70 shadow-floating sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[400px]"
          >
            {/* Header */}
            <div className="relative flex shrink-0 items-center gap-3 border-b border-bg-border/50 px-4 py-3.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-[12px] bg-[conic-gradient(from_180deg_at_50%_50%,#8b7dff,#6c63ff,#4f8ef7,#8b7dff)] shadow-button">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tracking-[-0.01em] text-txt-title">
                  Hyrr AI
                </p>
                <p className="text-[11.5px] text-txt-caption">{subtitle}</p>
              </div>
              {aiChatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={clearAiChat}
                  className="press rounded-full p-2 text-txt-caption transition-colors hover:bg-bg-hover hover:text-txt-heading cursor-pointer"
                  title="New conversation"
                  aria-label="New conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setAiChatOpen(false)}
                className="press rounded-full p-2 text-txt-caption transition-[color,background-color,transform] duration-300 hover:rotate-90 hover:bg-bg-hover hover:text-txt-heading cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages (native scroll, contained) */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" data-lenis-prevent>
              {aiChatMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-5 pb-2 text-center">
                  <motion.div
                    initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                    className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary-light ring-1 ring-primary-border/50"
                  >
                    <Sparkles className="h-7 w-7 text-primary" />
                  </motion.div>
                  <div>
                    <p className="text-[16px] font-semibold tracking-[-0.01em] text-txt-title">
                      How can I help?
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-txt-caption">
                      {role === "SEEKER"
                        ? "Ask about your job search, applications, interviews or your profile."
                        : "Ask about hiring, job descriptions, candidates or your pipeline."}
                    </p>
                  </div>
                  <div className="stagger flex w-full flex-col gap-2">
                    {PROMPTS[role].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => void send(p)}
                        className="spotlight press flex w-full items-center justify-between rounded-[14px] border border-bg-border/70 bg-bg-secondary/70 px-3.5 py-2.5 text-left text-[12.5px] font-medium text-txt-heading transition-[border-color,background-color] duration-200 hover:border-primary/30 hover:bg-bg-secondary cursor-pointer"
                      >
                        {p}
                        <ArrowUp
                          className="h-3.5 w-3.5 rotate-45 text-txt-caption"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {aiChatMessages.map((msg, i) => {
                    const isUser = msg.role === "user"
                    return (
                      <motion.div
                        key={`${msg.timestamp}-${i}`}
                        initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                        style={{ transformOrigin: isUser ? "bottom right" : "bottom left" }}
                        className={cn("flex", isUser ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[86%] px-3.5 py-2.5 text-[13px] leading-relaxed",
                            isUser
                              ? "rounded-[18px] rounded-br-[6px] bg-gradient-to-b from-[#7a72ff] to-primary text-white shadow-[0_4px_14px_-6px_rgba(108,99,255,0.6)]"
                              : "rounded-[18px] rounded-bl-[6px] border border-bg-border/60 bg-bg-secondary text-txt-heading shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                          )}
                        >
                          {isUser ? (
                            <span className="whitespace-pre-wrap">{msg.content}</span>
                          ) : (
                            <MarkdownText text={msg.content} />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                  <AnimatePresence>
                    {aiChatLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE_APPLE }}
                        className="flex justify-start"
                      >
                        <div className="rounded-[18px] rounded-bl-[6px] border border-bg-border/60 bg-bg-secondary px-4 py-2.5">
                          <TypingDots />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-bg-border/50 p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void send(input)
                }}
                className="flex items-end gap-2 rounded-[18px] border border-bg-border bg-bg-secondary p-1.5 pl-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-200 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10"
              >
                <label htmlFor="ai-chat-input" className="sr-only">
                  Message Hyrr AI
                </label>
                <textarea
                  ref={inputRef}
                  id="ai-chat-input"
                  placeholder="Ask Hyrr AI…"
                  value={input}
                  maxLength={2000}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void send(input)
                    }
                  }}
                  rows={1}
                  className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[13px] leading-5 text-txt-heading placeholder:text-txt-caption focus:outline-none"
                />
                <motion.button
                  type="submit"
                  disabled={!input.trim() || aiChatLoading}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Send"
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gradient-to-b from-[#7a72ff] to-primary text-white shadow-button transition-opacity disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
                >
                  {aiChatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </motion.button>
              </form>
              <p className="mt-2 text-center text-[10.5px] text-txt-disabled">
                AI can make mistakes. Check important details.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
