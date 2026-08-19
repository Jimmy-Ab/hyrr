import { Badge, Card, useJobStore, useToast } from "hyrr.shared"
import { CheckCheck, Loader2, MessageSquare, Search, Send, Trash2 } from "lucide-react"
import * as React from "react"

export function CandidateMessages() {
  const {
    conversations,
    conversationsLoading,
    conversationMessages,
    messagesLoading,
    activeConversationId,
    fetchConversations,
    fetchMessages,
    sendMessage,
    setActiveConversation,
    deleteConversation,
    user,
  } = useJobStore()

  const { toast } = useToast()

  const [input, setInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    fetchConversations()
  }, []) // eslint-disable-line

  // Auto-load messages when arriving with a pre-selected conversation
  // (e.g., clicking "Message Recruiter" from the Applications board)
  React.useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId)
    }
  }, [activeConversationId]) // eslint-disable-line

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversationMessages])

  const activeConv = conversations.find((c) => c.applicationId === activeConversationId)

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
    } catch {
      setInput(text)
      toast("Message not sent", "Please check your connection and try again.", "error")
    } finally {
      setSending(false)
    }
  }

  const filtered = conversations.filter(
    (c) =>
      !search ||
      c.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      c.jobTitle.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
      {/* Ambient glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />
      <div>
        <h1 className="text-[21px] font-bold tracking-tight text-txt-title">Messages</h1>
        <p className="text-[11px] text-txt-caption mt-0.5 font-medium">
          Your conversations with recruiters and hiring teams.
        </p>
      </div>

      <div className="flex gap-3 h-[calc(100vh-150px)] min-h-[520px] max-h-[680px]">
        {/* Conversation list */}
        <Card className="w-[278px] shrink-0 flex flex-col p-0 overflow-hidden rounded-xl shadow-none">
          <div className="p-3 border-b border-bg-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-3 rounded-lg border border-bg-border bg-bg-primary text-[11px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 transition-all"
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
                <div
                  key={c.applicationId}
                  onClick={() => handleSelectConversation(c.applicationId)}
                  className={`w-full text-left p-3 flex items-start gap-2.5 border-b border-bg-border/20 transition-colors cursor-pointer group relative ${
                    activeConv?.applicationId === c.applicationId
                      ? "bg-primary-light"
                      : "hover:bg-bg-hover"
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={c.candidateAvatar}
                      alt={c.candidateName}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    {c.online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sec-green border-2 border-bg-secondary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-txt-heading">
                        {c.candidateName}
                      </span>
                      <span className="text-[10.5px] text-txt-caption">{c.lastMessageTime}</span>
                    </div>
                    <p className="text-[11.5px] text-txt-caption mt-0.5">
                      {c.company} · {c.jobTitle}
                    </p>
                    <p className="text-[12px] text-txt-body mt-0.5 truncate">{c.lastMessage}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(c.applicationId)
                      toast("Conversation Deleted", "Deleted for your account.", "success")
                    }}
                    title="Delete Conversation"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {c.unreadCount > 0 && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Chat window */}
        <Card className="flex-1 p-0 overflow-hidden rounded-xl shadow-none">
          {activeConv ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 p-3 border-b border-bg-border/40 shrink-0">
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
                <div className="ml-auto flex items-center gap-2">
                  {activeConv.online && (
                    <Badge variant="success" className="text-[10.5px]">
                      Online
                    </Badge>
                  )}
                  <button
                    onClick={() => {
                      deleteConversation(activeConv.applicationId)
                      toast("Conversation Deleted", "Deleted for your account.", "success")
                    }}
                    title="Delete Conversation"
                    className="p-2 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : conversationMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                    <MessageSquare className="w-8 h-8 text-txt-disabled" />
                    <p className="text-[13px] text-txt-caption">
                      No messages yet. Send the first message!
                    </p>
                  </div>
                ) : (
                  conversationMessages.map((msg, i) => {
                    const isMe = msg.senderId === user?.id
                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[72%] rounded-[18px] px-4 py-2.5 text-[13px] leading-relaxed ${
                            isMe
                              ? "bg-primary text-white rounded-tr-none"
                              : "bg-bg-primary border border-bg-border text-txt-heading rounded-tl-none"
                          }`}
                        >
                          {msg.text}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[10px] text-txt-caption">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isMe && <CheckCheck className="w-3 h-3 text-txt-caption" />}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2 p-3 border-t border-bg-border/40 shrink-0">
                <input
                  type="text"
                  placeholder="Type your message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 h-9 px-3 rounded-lg border border-bg-border bg-bg-primary text-[12px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white disabled:opacity-50 hover:bg-primary-hover transition-all cursor-pointer shadow-button shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-txt-disabled mx-auto mb-2" />
                <p className="text-[14px] text-txt-caption">
                  Select a conversation to start messaging
                </p>
              </div>
            </div>
          )}
        </Card>

        <aside className="hidden w-[210px] shrink-0 xl:block">
          <Card className="h-full rounded-xl p-4 shadow-none">
            {activeConv ? (
              <div className="flex h-full flex-col">
                <div className="flex flex-col items-center border-b border-bg-border pb-4 text-center">
                  <img
                    src={activeConv.candidateAvatar}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <p className="mt-2 text-[12px] font-bold text-txt-heading">
                    {activeConv.candidateName}
                  </p>
                  <p className="mt-0.5 text-[9px] text-txt-caption">Hiring contact</p>
                </div>
                <div className="space-y-3 py-4 text-[10px]">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-txt-caption">
                      Company
                    </p>
                    <p className="mt-1 font-medium text-txt-body">{activeConv.company}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-txt-caption">
                      Role
                    </p>
                    <p className="mt-1 font-medium text-txt-body">{activeConv.jobTitle}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-txt-caption">
                      Conversation
                    </p>
                    <p className="mt-1 font-medium text-sec-green">
                      {activeConv.online ? "Available now" : "Messages saved"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteConversation(activeConv.applicationId)}
                  className="mt-auto w-full rounded-md border border-bg-border py-2 text-[10px] font-semibold text-txt-caption hover:bg-bg-hover"
                >
                  Delete conversation
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-[10px] text-txt-caption">
                Select a conversation to view its details.
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}
