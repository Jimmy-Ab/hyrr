import * as React from "react"
import { Search, Send, CheckCheck, Pin, Loader2, MessageSquare } from "lucide-react"
import { Card, Badge, useJobStore } from "hyrr.shared"

export function CandidateMessages() {
  const {
    conversations, conversationsLoading,
    conversationMessages, messagesLoading,
    activeConversationId,
    fetchConversations, fetchMessages, sendMessage, setActiveConversation,
    user,
  } = useJobStore()

  const [input, setInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    fetchConversations()
  }, []) // eslint-disable-line

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversationMessages])

  const activeConv = conversations.find(c => c.applicationId === activeConversationId) || conversations[0]

  const handleSelectConversation = (appId: string) => {
    setActiveConversation(appId)
    fetchMessages(appId)
  }

  const handleSend = async () => {
    if (!input.trim() || !activeConv || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)
    try {
      await sendMessage(activeConv.applicationId, text)
    } finally {
      setSending(false)
    }
  }

  const filtered = conversations.filter(c =>
    !search || c.candidateName.toLowerCase().includes(search.toLowerCase()) || c.jobTitle.toLowerCase().includes(search.toLowerCase())
  )

  // Use mock data when no real conversations exist (fallback UX)
  const showMock = conversations.length === 0 && !conversationsLoading

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div>
        <h1 className="text-[36px] font-extrabold tracking-tight">
            <span className="premium-gradient-text text-glow">Messages</span>
          </h1>
        <p className="text-body text-txt-body mt-1 font-medium">Your conversations with recruiters and hiring teams.</p>
      </div>

      <div className="flex gap-5 h-[600px]">
        {/* Conversation list */}
        <Card className="w-[300px] shrink-0 flex flex-col p-0 overflow-hidden">
          <div className="p-4 border-b border-bg-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-[10px] border border-bg-border bg-bg-primary text-[12.5px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <MessageSquare className="w-8 h-8 text-txt-disabled mb-2" />
                <p className="text-[13px] text-txt-caption">No conversations found</p>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.applicationId}
                  onClick={() => handleSelectConversation(c.applicationId)}
                  className={`w-full text-left p-4 flex items-start gap-3 border-b border-bg-border/20 transition-colors cursor-pointer ${
                    activeConv?.applicationId === c.applicationId ? "bg-primary-light" : "hover:bg-bg-hover"
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={c.candidateAvatar} alt={c.candidateName} className="w-9 h-9 rounded-full object-cover" />
                    {c.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sec-green border-2 border-bg-secondary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-txt-heading">{c.candidateName}</span>
                      <span className="text-[10.5px] text-txt-caption">{c.lastMessageTime}</span>
                    </div>
                    <p className="text-[11.5px] text-txt-caption mt-0.5">{c.company} · {c.jobTitle}</p>
                    <p className="text-[12px] text-txt-body mt-0.5 truncate">{c.lastMessage}</p>
                  </div>
                  {c.unreadCount > 0 && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat window */}
        <Card className="flex-1 p-0 overflow-hidden">
          {activeConv ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 p-4 border-b border-bg-border/40 shrink-0">
                <div className="relative">
                  <img
                    src={activeConv.candidateAvatar}
                    alt="avatar"
                    className="w-9 h-9 rounded-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-txt-heading">
                    {activeConv.candidateName}
                  </p>
                  <p className="text-[12px] text-txt-caption">
                    {activeConv.company} · {activeConv.jobTitle}
                  </p>
                </div>
                {activeConv.online && <Badge variant="success" className="ml-auto text-[10.5px]">Online</Badge>}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : conversationMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                    <MessageSquare className="w-8 h-8 text-txt-disabled" />
                    <p className="text-[13px] text-txt-caption">No messages yet. Send the first message!</p>
                  </div>
                ) : (
                  conversationMessages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id || msg.senderType === "SEEKER"
                    return (
                      <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className={`max-w-[72%] rounded-[18px] px-4 py-2.5 text-[13px] leading-relaxed ${
                          isMe ? "bg-primary text-white rounded-tr-none" : "bg-bg-primary border border-bg-border text-txt-heading rounded-tl-none"
                        }`}>
                          {msg.text}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[10px] text-txt-caption">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMe && <CheckCheck className="w-3 h-3 text-txt-caption" />}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2 p-4 border-t border-bg-border/40 shrink-0">
                <input
                  type="text"
                  placeholder="Type your message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 h-10 px-4 rounded-[11px] border border-bg-border bg-bg-primary text-[13px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="w-10 h-10 rounded-[11px] bg-primary flex items-center justify-center text-white disabled:opacity-50 hover:bg-primary-hover transition-all cursor-pointer shadow-button shrink-0"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-txt-disabled mx-auto mb-2" />
                <p className="text-[14px] text-txt-caption">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
