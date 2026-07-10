import * as React from "react"
import { Search, Send, CheckCheck, Loader2, MessageSquare } from "lucide-react"
import { Card } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { useJobStore } from "../store/useJobStore"
import { useToast } from "../components/ui/toast"

export function Messages() {
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

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversationMessages])

  const activeConv = conversations.find(c => c.applicationId === activeConversationId) || conversations[0]

  const handleSelectConversation = (appId: string) => {
    setActiveConversation(appId)
    fetchMessages(appId)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !activeConv || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)
    try {
      await sendMessage(activeConv.applicationId, text)
      toast("Message Sent", `Your message was delivered to ${activeConv.candidateName}`, "success")
    } catch {
      toast("Error", "Could not send message. Please try again.", "error")
    } finally {
      setSending(false)
    }
  }

  const filtered = conversations.filter(c =>
    !search || c.candidateName.toLowerCase().includes(search.toLowerCase()) || c.jobTitle.toLowerCase().includes(search.toLowerCase())
  )

  const showMock = conversations.length === 0 && !conversationsLoading

  return (
    <div className="flex gap-6 h-[calc(100vh-210px)] select-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Contact List */}
      <Card className="w-[340px] flex flex-col border border-bg-border/60 bg-bg-secondary shadow-card overflow-hidden shrink-0">
        <div className="p-4 border-b border-bg-border/30 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-input border border-bg-border bg-bg-primary/40 text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:bg-bg-secondary focus:border-primary/20 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar-none">
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
            filtered.map((contact) => {
              const isSelected = activeConv?.applicationId === contact.applicationId
              return (
                <button
                  key={contact.applicationId}
                  onClick={() => handleSelectConversation(contact.applicationId)}
                  className={`w-full p-4 flex gap-3 text-left border-b border-bg-border/10 transition-colors cursor-pointer outline-none ${
                    isSelected ? "bg-primary-light/50" : "hover:bg-bg-hover"
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={contact.candidateAvatar}
                      alt={contact.candidateName}
                      className="w-11 h-11 rounded-full object-cover border border-bg-border/30"
                    />
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-sec-green border-2 border-bg-secondary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className={`text-[14px] font-bold ${isSelected ? "text-primary" : "text-txt-heading"}`}>
                        {contact.candidateName}
                      </span>
                      <span className="text-[11px] text-txt-caption font-semibold">{contact.lastMessageTime}</span>
                    </div>
                    <p className={`text-caption truncate ${contact.unreadCount > 0 && !isSelected ? "font-bold text-txt-heading" : "text-txt-body font-medium"}`}>
                      {contact.lastMessage}
                    </p>
                  </div>
                  {contact.unreadCount > 0 && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                </button>
              )
            })
          )}
        </div>
      </Card>

      {/* Active Conversation Panel */}
      <Card className="flex-1 flex flex-col border border-bg-border/60 bg-bg-secondary shadow-card overflow-hidden">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-bg-border/30 flex items-center justify-between bg-bg-primary/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={activeConv.candidateAvatar}
                    alt="avatar"
                    className="w-10 h-10 rounded-full object-cover border border-bg-border/40"
                  />
                  {activeConv.online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-sec-green border-2 border-bg-secondary" />
                  )}
                </div>
                <div>
                  <h3 className="text-body font-bold text-txt-heading leading-tight">
                    {activeConv.candidateName}
                  </h3>
                  <span className="text-[11px] text-txt-caption font-semibold">
                    {activeConv.jobTitle}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-bg-primary/10">
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
                conversationMessages.map((msg, index) => {
                  const isMe = msg.senderId === user?.id || msg.senderType === "RECRUITER"
                  return (
                    <div key={index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                        <div
                          className={`p-3.5 rounded-[18px] text-[14px] leading-relaxed font-medium ${
                            isMe
                              ? "bg-primary text-white rounded-tr-[4px] shadow-button"
                              : "bg-bg-secondary border border-bg-border/60 text-txt-heading rounded-tl-[4px] shadow-[0_1px_4px_rgba(0,0,0,0.02)]"
                          }`}
                        >
                          {msg.text}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-txt-caption font-bold mt-0.5">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMe && <CheckCheck className="w-3 h-3 text-primary" />}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSend} className="p-4 border-t border-bg-border/30 bg-bg-secondary flex gap-3 shrink-0">
              <input
                type="text"
                placeholder={`Message ${activeConv.candidateName}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 h-11 px-4 rounded-input border border-bg-border bg-bg-primary/40 text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:bg-bg-secondary focus:border-primary/20 transition-all duration-200"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-11 h-11 p-0 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50 transition-all shadow-button"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </>
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
  )
}
