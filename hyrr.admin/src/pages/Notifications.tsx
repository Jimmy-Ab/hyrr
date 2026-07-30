import { Badge, Button, Card, Input, useToast } from "hyrr.shared"
import { Clock, Megaphone, Send, Trash2 } from "lucide-react"
import { useState } from "react"

interface Broadcast {
  id: string
  title: string
  content: string
  target: string
  date: string
  status: "sent" | "scheduled"
}

export function NotificationsPage() {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [target, setTarget] = useState("all")

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([
    {
      id: "b1",
      title: "Scheduled Maintenance — July 15",
      content: "Platform database engine updates will occur on Jul 15 between 2AM and 4AM UTC.",
      target: "All Users",
      date: "Jul 4, 2026",
      status: "sent",
    },
    {
      id: "b2",
      title: "New AI Matching Model active",
      content: "Matching models updated to use the latest LLM scoring rules.",
      target: "Recruiters",
      date: "Jul 2, 2026",
      status: "sent",
    },
    {
      id: "b3",
      title: "Promotional Credits Campaign",
      content: "Earn bonus Momentum credits on package updates next week.",
      target: "Recruiters",
      date: "Scheduled for Jul 10",
      status: "scheduled",
    },
  ])

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return
    const newBroadcast: Broadcast = {
      id: `b-${Date.now()}`,
      title,
      content,
      target:
        target === "all" ? "All Users" : target === "recruiter" ? "Recruiters" : "Job Seekers",
      date: "Just now",
      status: "sent",
    }
    setBroadcasts([newBroadcast, ...broadcasts])
    setTitle("")
    setContent("")
    toast("Announced", "Broadcast sent successfully.", "success")
  }

  const handleDelete = (id: string) => {
    setBroadcasts(broadcasts.filter((b) => b.id !== id))
    toast("Deleted", "Broadcast history removed.", "info")
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-[36px] font-bold text-txt-title tracking-tight">Platform Broadcasts</h1>
        <p className="text-body text-txt-body mt-1 font-medium">
          Broadcast system alerts, announcements, and push promotional notifications to target
          segments.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Creator */}
        <Card className="xl:col-span-1 p-5 h-fit">
          <h2 className="text-[15px] font-bold text-txt-heading mb-4">Create Broadcast</h2>
          <form onSubmit={handleBroadcast} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-txt-caption uppercase tracking-wider">
                Announcement Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled Maintenance Update…"
                className="h-9 text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-txt-caption uppercase tracking-wider">
                Message Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write message copy here…"
                className="w-full p-3 rounded-[12px] border border-bg-border bg-bg-primary text-[12px] text-txt-body placeholder:text-txt-caption resize-none focus:outline-none focus:border-primary/20 transition-colors"
                rows={4}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-txt-caption uppercase tracking-wider">
                Target Recipient Segment
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "all", label: "All Users" },
                  { value: "recruiter", label: "Recruiters" },
                  { value: "seeker", label: "Seekers" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTarget(opt.value)}
                    className={`p-2 rounded-[10px] text-[11.5px] font-semibold border cursor-pointer transition-all ${target === opt.value ? "bg-primary text-white border-primary" : "bg-bg-secondary text-txt-body border-bg-border hover:border-primary/30"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full cursor-pointer text-[12.5px] mt-2">
              <Send className="w-4 h-4 mr-2" /> Dispatch Announcement
            </Button>
          </form>
        </Card>

        {/* History */}
        <Card className="xl:col-span-2 p-5">
          <h2 className="text-[15px] font-bold text-txt-heading mb-4">Announcement History</h2>
          <div className="space-y-4">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-[14px] bg-bg-secondary border border-bg-border/60 flex items-start gap-4"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${b.status === "scheduled" ? "bg-sec-orange/10 text-sec-orange" : "bg-primary-light text-primary"}`}
                >
                  {b.status === "scheduled" ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <Megaphone className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-[13.5px] font-bold text-txt-heading leading-snug">
                        {b.title}
                      </h3>
                      <p className="text-[11px] text-txt-caption mt-0.5">
                        Sent to {b.target} · {b.date}
                      </p>
                    </div>
                    <Badge variant={b.status === "scheduled" ? "secondary" : "success"}>
                      {b.status}
                    </Badge>
                  </div>
                  <p className="text-[12.5px] text-txt-body mt-2 leading-relaxed">{b.content}</p>
                  <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-bg-border/30">
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="flex items-center gap-1 text-[11px] text-sec-red/70 hover:text-sec-red transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Entry
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
