import { Bot, ChevronDown, Loader2, Send, Sparkles, Trash2, X } from "lucide-react"
import * as React from "react"
import { useJobStore } from "../../store/useJobStore"

function MarkdownText({ text }: { text: string }) {
  // Simple markdown renderer for bold and bullets
  const lines = text.split("\n")
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-bold">
              {line.slice(2, -2)}
            </p>
          )
        }
        if (line.startsWith("• ") || line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 mt-0.5">•</span>
              <span
                dangerouslySetInnerHTML={{
                  __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                }}
              />
            </div>
          )
        }
        if (line.trim() === "") return <div key={i} className="h-1" />
        return (
          <p
            key={i}
            dangerouslySetInnerHTML={{
              __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        )
      })}
    </div>
  )
}

interface AiChatWidgetProps {
  role?: "SEEKER" | "RECRUITER"
}

export function AiChatWidget({ role = "SEEKER" }: AiChatWidgetProps) {
  const { aiChatMessages, aiChatLoading, aiChatOpen, sendAiChat, clearAiChat, setAiChatOpen } =
    useJobStore()
  const [input, setInput] = React.useState("")
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (aiChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [aiChatMessages, aiChatOpen])

  const handleSend = async () => {
    if (!input.trim() || aiChatLoading) return
    const msg = input.trim()
    setInput("")
    await sendAiChat(msg)
  }

  const quickPrompts =
    role === "SEEKER"
      ? [
          "Improve my resume",
          "Prepare for interviews",
          "Salary negotiation tips",
          "Write a cover letter",
        ]
      : [
          "Write a job description",
          "Interview questions for React dev",
          "Evaluate a candidate",
          "Pipeline best practices",
        ]

  return (
    <>
      {/* Floating trigger button */}
      <button
        id="ai-chat-trigger"
        onClick={() => setAiChatOpen(!aiChatOpen)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 50,
        }}
        className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_8px_32px_rgba(108,99,255,0.4)] hover:shadow-[0_12px_40px_rgba(108,99,255,0.5)] hover:scale-110 transition-all duration-200 cursor-pointer group"
        title="Ask Hyrr AI"
      >
        {aiChatOpen ? (
          <ChevronDown className="w-5 h-5" />
        ) : (
          <>
            <Bot className="w-6 h-6" />
            {aiChatMessages.length > 0 && !aiChatOpen && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-sec-green text-white text-[9px] font-bold flex items-center justify-center border-2 border-bg-primary">
                {aiChatMessages.filter((m) => m.role === "assistant").length}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat panel */}
      {aiChatOpen && (
        <div
          id="ai-chat-panel"
          style={{
            position: "fixed",
            bottom: "96px",
            right: "24px",
            zIndex: 50,
          }}
          className="w-[380px] h-[520px] bg-bg-secondary border border-bg-border/60 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-bg-border/40 bg-gradient-to-r from-primary/10 to-purple-500/5 shrink-0">
            <div className="w-9 h-9 rounded-[12px] bg-primary flex items-center justify-center shadow-button">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-txt-heading">Hyrr AI</p>
              <p className="text-[11px] text-txt-caption">
                {role === "SEEKER" ? "Career Assistant" : "Recruiting Assistant"} · Always online
              </p>
            </div>
            <div className="flex items-center gap-1">
              {aiChatMessages.length > 0 && (
                <button
                  onClick={clearAiChat}
                  className="p-1.5 rounded-full hover:bg-bg-hover text-txt-caption hover:text-txt-heading transition-colors cursor-pointer"
                  title="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setAiChatOpen(false)}
                className="p-1.5 rounded-full hover:bg-bg-hover text-txt-caption hover:text-txt-heading transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-primary/30">
            {aiChatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 pb-4">
                <div className="w-14 h-14 rounded-[18px] bg-primary-light border border-primary-border/30 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-txt-heading">Hi! I'm Hyrr AI</p>
                  <p className="text-[12px] text-txt-caption mt-1 leading-relaxed">
                    {role === "SEEKER"
                      ? "Your personal career assistant. Ask me anything about resumes, interviews, or job hunting."
                      : "Your recruiting assistant. Ask about candidates, job descriptions, or hiring strategies."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setInput(p)
                      }}
                      className="text-[11px] font-medium text-primary bg-primary-light border border-primary-border/30 rounded-[10px] px-3 py-2 hover:bg-primary hover:text-white transition-all cursor-pointer text-left leading-tight"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {aiChatMessages.map((msg, i) => {
                  const isUser = msg.role === "user"
                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Bot className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-[10px] text-txt-caption font-semibold">
                            Hyrr AI
                          </span>
                        </div>
                      )}
                      <div
                        className={`max-w-[88%] rounded-[16px] px-4 py-3 text-[12.5px] leading-relaxed ${
                          isUser
                            ? "bg-primary text-white rounded-tr-[4px]"
                            : "bg-bg-secondary border border-bg-border/60 text-txt-heading rounded-tl-[4px]"
                        }`}
                      >
                        {isUser ? msg.content : <MarkdownText text={msg.content} />}
                      </div>
                    </div>
                  )
                })}
                {aiChatLoading && (
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-bg-secondary border border-bg-border/60 rounded-[16px] rounded-tl-[4px] px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-bg-border/40 bg-bg-secondary shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                id="ai-chat-input"
                placeholder="Ask Hyrr AI anything…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={1}
                className="flex-1 resize-none h-10 px-3 py-2.5 rounded-[12px] border border-bg-border bg-bg-primary text-[12.5px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all leading-5"
                style={{ maxHeight: "80px", overflowY: "auto" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || aiChatLoading}
                className="w-10 h-10 rounded-[12px] bg-primary flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-all cursor-pointer shrink-0 shadow-button"
              >
                {aiChatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-txt-disabled text-center mt-2">
              Hyrr AI · Powered by Gemini
            </p>
          </div>
        </div>
      )}
    </>
  )
}
