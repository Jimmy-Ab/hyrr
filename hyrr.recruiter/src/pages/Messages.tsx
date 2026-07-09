import * as React from "react"
import { Search, Send, CheckCheck } from "lucide-react"
import { Card } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { useToast } from "../components/ui/toast"

interface ChatContact {
  id: string
  name: string
  avatar: string
  lastMessage: string
  time: string
  unread: boolean
  online: boolean
}

export function Messages() {
  const { toast } = useToast()
  
  const contacts: ChatContact[] = [
    {
      id: "1",
      name: "Emily Carter",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
      lastMessage: "Thank you for the update! I look forward to the interview.",
      time: "10:30 AM",
      unread: true,
      online: true,
    },
    {
      id: "2",
      name: "James Wilson",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
      lastMessage: "I've uploaded my latest portfolio. Please review.",
      time: "Yesterday",
      unread: false,
      online: false,
    },
    {
      id: "3",
      name: "Robert Brown",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
      lastMessage: "Is the screening scheduled for Wednesday?",
      time: "2 days ago",
      unread: false,
      online: true,
    },
  ]

  const [activeContact, setActiveContact] = React.useState<ChatContact>(contacts[0])
  const [messages, setMessages] = React.useState<Record<string, { sender: "me" | "them"; text: string; time: string }[]>>({
    "1": [
      { sender: "me", text: "Hi Emily, we loved your profile! Are you available for a technical discussion this Thursday?", time: "10:15 AM" },
      { sender: "them", text: "Hi Sarah! Yes, I am free Thursday morning around 10 AM PST.", time: "10:20 AM" },
      { sender: "me", text: "Perfect! I will schedule the calendar invite shortly.", time: "10:25 AM" },
      { sender: "them", text: "Thank you for the update! I look forward to the interview.", time: "10:30 AM" },
    ],
    "2": [
      { sender: "them", text: "Hello, I wanted to follow up on my frontend developer application.", time: "Monday" },
      { sender: "me", text: "Hi James, we are reviewing portfolios this week and will update your status soon.", time: "Tuesday" },
      { sender: "them", text: "I've uploaded my latest portfolio. Please review.", time: "Yesterday" },
    ],
    "3": [
      { sender: "me", text: "Hi Robert, would Wednesday afternoon work for a brief intro call?", time: "Monday" },
      { sender: "them", text: "Is the screening scheduled for Wednesday?", time: "Tuesday" },
    ]
  })

  const [newMessage, setNewMessage] = React.useState("")

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const timeNow = "Just now"
    const chatMsg = { sender: "me" as const, text: newMessage, time: timeNow }
    
    setMessages((prev) => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), chatMsg]
    }))
    
    setNewMessage("")
    toast("Message Sent", `Your message was delivered to ${activeContact.name}`, "success")
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-210px)] select-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Contact List */}
      <Card className="w-[340px] flex flex-col border border-bg-border/60 bg-bg-secondary shadow-card overflow-hidden shrink-0">
        <div className="p-4 border-b border-bg-border/30 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption" />
            <input
              type="text"
              placeholder="Search chat history..."
              className="w-full h-10 pl-9 pr-4 rounded-input border border-bg-border bg-bg-primary/40 text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:bg-bg-secondary focus:border-primary/20 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar-none">
          {contacts.map((contact) => {
            const isSelected = activeContact.id === contact.id
            return (
              <button
                key={contact.id}
                onClick={() => setActiveContact(contact)}
                className={`w-full p-4 flex gap-3 text-left border-b border-bg-border/10 transition-colors cursor-pointer outline-none ${
                  isSelected ? "bg-primary-light/50" : "hover:bg-bg-hover"
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-11 h-11 rounded-full object-cover border border-bg-border/30"
                  />
                  {contact.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-sec-green border-2 border-bg-secondary" />
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className={`text-[14px] font-bold ${isSelected ? "text-primary" : "text-txt-heading"}`}>
                      {contact.name}
                    </span>
                    <span className="text-[11px] text-txt-caption font-semibold">{contact.time}</span>
                  </div>
                  <p className={`text-caption truncate ${contact.unread && !isSelected ? "font-bold text-txt-heading" : "text-txt-body font-medium"}`}>
                    {messages[contact.id]?.slice(-1)[0]?.text || contact.lastMessage}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Active Conversation Panel */}
      <Card className="flex-1 flex flex-col border border-bg-border/60 bg-bg-secondary shadow-card overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-bg-border/30 flex items-center justify-between bg-bg-primary/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={activeContact.avatar}
                alt={activeContact.name}
                className="w-10 h-10 rounded-full object-cover border border-bg-border/40"
              />
              {activeContact.online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-sec-green border-2 border-bg-secondary" />
              )}
            </div>
            <div>
              <h3 className="text-body font-bold text-txt-heading leading-tight">{activeContact.name}</h3>
              <span className="text-[11px] text-txt-caption font-semibold">
                {activeContact.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-bg-primary/10">
          {messages[activeContact.id]?.map((msg, index) => {
            const isMe = msg.sender === "me"
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
                    <span>{msg.time}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-primary" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-bg-border/30 bg-bg-secondary flex gap-3 shrink-0">
          <input
            type="text"
            placeholder={`Message ${activeContact.name}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 h-11 px-4 rounded-input border border-bg-border bg-bg-primary/40 text-body text-txt-heading placeholder:text-txt-caption focus:outline-none focus:bg-bg-secondary focus:border-primary/20 transition-all duration-200"
          />
          <Button type="submit" className="w-11 h-11 p-0 rounded-full flex items-center justify-center shrink-0 cursor-pointer">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  )
}
