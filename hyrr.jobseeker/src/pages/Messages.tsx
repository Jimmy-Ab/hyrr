import * as React from "react"
import { Search, Send, CheckCheck, Pin } from "lucide-react"
import { Card } from "hyrr.shared"
import { Button } from "hyrr.shared"
import { Badge } from "hyrr.shared"
import { useToast } from "hyrr.shared"

interface Conversation {
  id: string
  name: string
  role: string
  company: string
  avatar: string
  lastMessage: string
  time: string
  unread: boolean
  online: boolean
  pinned?: boolean
}

type Message = { sender: "me" | "them"; text: string; time: string }

export function CandidateMessages() {
  const { toast } = useToast()
  const conversations: Conversation[] = [
    { id: "1", name: "Sarah Kim", role: "Engineering Recruiter", company: "Stripe", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", lastMessage: "Your technical interview is scheduled for Jul 5!", time: "10:30 AM", unread: true, online: true, pinned: true },
    { id: "2", name: "Marcus Chen", role: "Product Recruiter", company: "Vercel", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", lastMessage: "We're reviewing your portfolio now.", time: "Yesterday", unread: true, online: false },
    { id: "3", name: "Priya Nair", role: "Talent Partner", company: "Figma", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150", lastMessage: "Congratulations! We'd like to extend an offer.", time: "2 days ago", unread: false, online: true },
  ]

  const [active, setActive] = React.useState(conversations[0])
  const [messages, setMessages] = React.useState<Record<string, Message[]>>({
    "1": [
      { sender: "them", text: "Hi Emily! We loved your profile. Are you available for a technical screen this week?", time: "9:00 AM" },
      { sender: "me",   text: "Hi Sarah! Absolutely, I'm free Thursday morning.", time: "9:15 AM" },
      { sender: "them", text: "Perfect! I'll send a calendar invite for Thursday at 10 AM PST.", time: "9:20 AM" },
      { sender: "me",   text: "Looking forward to it! Should I prepare anything specific?", time: "9:25 AM" },
      { sender: "them", text: "Your technical interview is scheduled for Jul 5! We'll cover React architecture and system design.", time: "10:30 AM" },
    ],
    "2": [
      { sender: "them", text: "Hi Emily, thanks for applying to the Product Designer role at Vercel.", time: "Monday" },
      { sender: "me",   text: "Thank you! I'm really excited about the opportunity.", time: "Monday" },
      { sender: "them", text: "We're reviewing your portfolio now.", time: "Yesterday" },
    ],
    "3": [
      { sender: "them", text: "Emily, your interviews went exceptionally well!", time: "2 days ago" },
      { sender: "them", text: "Congratulations! We'd like to extend an offer for the Data Scientist role.", time: "2 days ago" },
      { sender: "me",   text: "Wow, thank you so much! I'm thrilled. Could you share the details?", time: "2 days ago" },
    ],
  })
  const [input, setInput] = React.useState("")
  const [search, setSearch] = React.useState("")

  const send = () => {
    if (!input.trim()) return
    const msg: Message = { sender: "me", text: input.trim(), time: "Just now" }
    setMessages((prev) => ({ ...prev, [active.id]: [...(prev[active.id] ?? []), msg] }))
    setInput("")
    setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [active.id]: [...(prev[active.id] ?? []), { sender: "them", text: "Thanks for your message! I'll get back to you shortly.", time: "Just now" }]
      }))
    }, 1200)
  }

  const filtered = conversations.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.company.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Messages</h1>
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
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className={`w-full text-left p-4 flex items-start gap-3 border-b border-bg-border/20 transition-colors cursor-pointer ${active.id === c.id ? "bg-primary-light" : "hover:bg-bg-hover"}`}
              >
                <div className="relative shrink-0">
                  <img src={c.avatar} alt={c.name} className="w-9 h-9 rounded-full object-cover" />
                  {c.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sec-green border-2 border-bg-secondary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-txt-heading flex items-center gap-1">
                      {c.pinned && <Pin className="w-3 h-3 text-primary" />}
                      {c.name}
                    </span>
                    <span className="text-[10.5px] text-txt-caption">{c.time}</span>
                  </div>
                  <p className="text-[11.5px] text-txt-caption mt-0.5">{c.company} · {c.role}</p>
                  <p className="text-[12px] text-txt-body mt-0.5 truncate">{c.lastMessage}</p>
                </div>
                {c.unread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
              </button>
            ))}
          </div>
        </Card>

        {/* Chat window */}
        <Card className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-3 p-4 border-b border-bg-border/40">
            <div className="relative">
              <img src={active.avatar} alt={active.name} className="w-9 h-9 rounded-full object-cover" />
              {active.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sec-green border-2 border-bg-secondary" />}
            </div>
            <div>
              <p className="text-[14px] font-bold text-txt-heading">{active.name}</p>
              <p className="text-[12px] text-txt-caption">{active.role} at {active.company}</p>
            </div>
            {active.online && (
              <Badge variant="success" className="ml-auto text-[10.5px]">Online</Badge>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {(messages[active.id] ?? []).map((msg, i) => {
              const isMe = msg.sender === "me"
              return (
                <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[72%] rounded-[18px] px-4 py-2.5 text-[13px] leading-relaxed ${
                    isMe
                      ? "bg-primary text-white rounded-tr-none"
                      : "bg-bg-primary border border-bg-border text-txt-heading rounded-tl-none"
                  }`}>
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[10px] text-txt-caption">{msg.time}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-txt-caption" />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Input */}
          <div className="flex gap-2 p-4 border-t border-bg-border/40">
            <input
              type="text"
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1 h-10 px-4 rounded-[11px] border border-bg-border bg-bg-primary text-[13px] placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <Button variant="primary" onClick={send} className="h-10 px-4 cursor-pointer">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
