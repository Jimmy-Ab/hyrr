import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  RotateCw,
  Search,
  Send,
  Trash2,
} from "lucide-react"
import * as React from "react"
import { errorMessage } from "../../lib/api"
import { applicationStatusLabel } from "../../lib/contracts"
import { formatDateTime, useJobStore, type ChatMessage } from "../../store/useJobStore"
import { Button } from "../ui/button"
import { Card } from "../ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { useToast } from "../ui/toast"

export interface MessagesViewProps {
  /** Which app renders the inbox; drives labels and side-specific notices. */
  side: "RECRUITER" | "SEEKER"
  /** Optional call to action shown in the empty inbox. */
  emptyAction?: { label: string; onClick: () => void }
  /** Show the contact details column on extra-wide screens. */
  showDetailsPanel?: boolean
  /** Only show conversations about this job ("" or undefined = all). */
  jobId?: string
  className?: string
}

const NEAR_BOTTOM_PX = 120

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/**
 * Inbox + thread view shared by the recruiter and job seeker apps so both behave identically.
 * All data flows through the store (openConversation / sendMessage / retryMessage / …).
 */
export function MessagesView({
  side,
  emptyAction,
  showDetailsPanel = false,
  jobId,
  className,
}: MessagesViewProps) {
  const conversations = useJobStore((s) => s.conversations)
  const conversationsLoading = useJobStore((s) => s.conversationsLoading)
  const conversationMessages = useJobStore((s) => s.conversationMessages)
  const messagesLoading = useJobStore((s) => s.messagesLoading)
  const activeConversationId = useJobStore((s) => s.activeConversationId)
  const activeThreadMeta = useJobStore((s) => s.activeThreadMeta)
  const typingByThread = useJobStore((s) => s.typingByThread)
  const user = useJobStore((s) => s.user)
  const fetchConversations = useJobStore((s) => s.fetchConversations)
  const openConversation = useJobStore((s) => s.openConversation)
  const leaveConversation = useJobStore((s) => s.leaveConversation)
  const sendMessage = useJobStore((s) => s.sendMessage)
  const retryMessage = useJobStore((s) => s.retryMessage)
  const sendTyping = useJobStore((s) => s.sendTyping)
  const deleteConversation = useJobStore((s) => s.deleteConversation)

  const { toast } = useToast()
  const [input, setInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [booted, setBooted] = React.useState(conversations.length > 0)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const nearBottomRef = React.useRef(true)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const isRecruiter = side === "RECRUITER"

  // Refresh the inbox on mount; spinner only until the first response.
  React.useEffect(() => {
    fetchConversations().finally(() => setBooted(true))
  }, [fetchConversations])

  // Leave the chat room when navigating away.
  React.useEffect(() => () => leaveConversation(), [leaveConversation])

  const thread =
    (activeThreadMeta?.applicationId === activeConversationId ? activeThreadMeta : null) ??
    conversations.find((c) => c.applicationId === activeConversationId) ??
    null

  // Reset the composer when switching threads.
  React.useEffect(() => {
    setInput("")
    nearBottomRef.current = true
  }, [activeConversationId])

  // Jump to the bottom when a thread finishes loading.
  React.useEffect(() => {
    if (!activeConversationId || messagesLoading) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
    nearBottomRef.current = true
  }, [activeConversationId, messagesLoading])

  // New messages: follow only if already near the bottom (or the message is mine).
  const lastMessage = conversationMessages[conversationMessages.length - 1]
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el || !lastMessage) return
    const mine = !!lastMessage.senderId && lastMessage.senderId === user?.id
    if (nearBottomRef.current || mine) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }
  }, [lastMessage?.id, conversationMessages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  const handleOpen = (applicationId: string) => {
    if (applicationId === activeConversationId) return
    openConversation(applicationId).catch((err: unknown) =>
      toast("Couldn't load messages", errorMessage(err), "error")
    )
  }

  const handleSend = () => {
    if (!thread || !thread.canSend) return
    const text = input.trim()
    if (!text) return
    setInput("")
    nearBottomRef.current = true
    sendMessage(thread.applicationId, text).catch((err: unknown) =>
      toast("Message not sent", errorMessage(err, "Tap Retry to try again."), "error")
    )
    inputRef.current?.focus()
  }

  const handleRetry = (msg: ChatMessage) => {
    if (!msg.clientId) return
    retryMessage(msg.applicationId, msg.clientId).catch((err: unknown) =>
      toast("Message not sent", errorMessage(err, "Please try again."), "error")
    )
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteConversation(pendingDelete)
      toast("Conversation deleted", "Deleted for your account.", "success")
      setPendingDelete(null)
    } catch (err) {
      toast("Couldn't delete conversation", errorMessage(err), "error")
    } finally {
      setDeleting(false)
    }
  }

  const authorLabel = (msg: ChatMessage, mine: boolean) => {
    if (mine) return "You"
    if (isRecruiter) {
      if (msg.senderType === "SEEKER") return thread?.candidateName || "Candidate"
      return msg.senderName || "Teammate"
    }
    return msg.senderName || thread?.candidateName || "Hiring team"
  }

  const q = search.trim().toLowerCase()
  const filtered = conversations.filter(
    (c) =>
      (!jobId || c.jobId === jobId) &&
      (!q ||
        c.candidateName.toLowerCase().includes(q) ||
        c.jobTitle.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q))
  )

  const typing =
    activeConversationId && typingByThread[activeConversationId]?.until > Date.now()
      ? typingByThread[activeConversationId]
      : null

  const subtitle = thread
    ? [isRecruiter ? null : thread.company, thread.jobTitle].filter(Boolean).join(" · ")
    : ""

  const closedText =
    thread && !thread.canSend
      ? thread.closedReason === "SAVED"
        ? isRecruiter
          ? "This job is only saved — the candidate hasn't applied yet."
          : "Apply to this job to message the hiring team."
        : isRecruiter
          ? "The candidate withdrew this application. The conversation is read-only."
          : "You withdrew this application. The conversation is read-only."
      : null

  const showListSpinner = !booted && conversationsLoading && conversations.length === 0
  const inboxEmpty = !showListSpinner && conversations.length === 0

  return (
    <div className={`flex gap-3 lg:gap-4 min-w-0 ${className ?? ""}`}>
      {/* ── Conversation list ─────────────────────────────────────────── */}
      <Card
        className={`${thread ? "hidden lg:flex" : "flex"} w-full lg:w-[300px] xl:w-[320px] shrink-0 flex-col p-0 overflow-hidden rounded-xl shadow-none`}
      >
        <div className="p-3 border-b border-bg-border/40 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-caption pointer-events-none" />
            <input
              type="search"
              placeholder="Search conversations…"
              aria-label="Search conversations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-bg-border bg-bg-primary text-[12.5px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 transition-all"
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto" aria-label="Conversations">
          {showListSpinner ? (
            <li className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-primary" aria-label="Loading" />
            </li>
          ) : inboxEmpty ? (
            <li className="flex flex-col items-center justify-center h-full p-6 text-center gap-2">
              <MessageSquare className="w-8 h-8 text-txt-disabled" />
              <p className="text-[13px] font-semibold text-txt-heading">No conversations yet</p>
              <p className="text-[12px] text-txt-caption max-w-[220px]">
                {isRecruiter
                  ? "Start a conversation from a candidate."
                  : "Message a recruiter from your Applications."}
              </p>
              {emptyAction && (
                <Button size="sm" variant="secondary" onClick={emptyAction.onClick}>
                  {emptyAction.label}
                </Button>
              )}
            </li>
          ) : filtered.length === 0 ? (
            <li className="flex flex-col items-center justify-center h-full p-4 text-center">
              <MessageSquare className="w-8 h-8 text-txt-disabled mb-2" />
              <p className="text-[13px] text-txt-caption">No conversations found</p>
            </li>
          ) : (
            filtered.map((c) => {
              const selected = c.applicationId === activeConversationId
              const unread = !selected && c.unreadCount > 0
              return (
                <li
                  key={c.applicationId}
                  className={`relative group border-b border-bg-border/20 ${
                    selected ? "bg-primary-light" : "hover:bg-bg-hover"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleOpen(c.applicationId)}
                    aria-current={selected ? "true" : undefined}
                    className="w-full p-3 pr-10 flex items-start gap-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                  >
                    <img
                      src={c.candidateAvatar}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-bg-border/30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[13.5px] truncate ${unread ? "font-bold text-txt-heading" : "font-semibold text-txt-heading"}`}
                        >
                          {c.candidateName}
                        </span>
                        <span className="text-[10.5px] text-txt-caption shrink-0">
                          {c.lastMessageTime}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-txt-caption truncate">
                        {[isRecruiter ? null : c.company, c.jobTitle].filter(Boolean).join(" · ")}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p
                          className={`flex-1 min-w-0 text-[12px] truncate ${unread ? "font-semibold text-txt-heading" : "text-txt-body"}`}
                        >
                          {unread && <span className="sr-only">{c.unreadCount} unread. </span>}
                          {c.lastMessage || "No messages yet"}
                        </p>
                        {unread && (
                          <span
                            className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                            aria-hidden="true"
                          >
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(c.applicationId)}
                    aria-label={`Delete conversation with ${c.candidateName}`}
                    title="Delete conversation"
                    className="absolute right-2 top-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </Card>

      {/* ── Thread ────────────────────────────────────────────────────── */}
      <Card
        className={`${thread ? "flex" : "hidden lg:flex"} flex-1 min-w-0 flex-col p-0 overflow-hidden rounded-xl shadow-none`}
      >
        {thread ? (
          <>
            <div className="flex items-center gap-3 p-3 border-b border-bg-border/40 shrink-0">
              <button
                type="button"
                onClick={leaveConversation}
                aria-label="Back to conversations"
                className="lg:hidden p-1.5 -ml-1 rounded-full text-txt-caption hover:bg-bg-hover hover:text-txt-heading cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <img
                src={thread.candidateAvatar}
                alt=""
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-bold text-txt-heading truncate">
                  {thread.candidateName}
                </h2>
                <p className="text-[12px] text-txt-caption truncate">
                  {subtitle}
                  {isRecruiter && thread.status && <> · {applicationStatusLabel(thread.status)}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(thread.applicationId)}
                aria-label="Delete conversation"
                title="Delete conversation"
                className="p-2 rounded-full text-txt-caption hover:text-sec-red hover:bg-sec-red/10 transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {isRecruiter && thread.isGuest && (
              <div className="flex items-center gap-2 px-4 py-2 text-[12px] text-txt-body bg-bg-primary/60 border-b border-bg-border/40">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                Applied without an account — replies are sent by email.
              </div>
            )}

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
              aria-live="polite"
            >
              {messagesLoading && conversationMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" aria-label="Loading" />
                </div>
              ) : conversationMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <MessageSquare className="w-8 h-8 text-txt-disabled" />
                  <p className="text-[13px] text-txt-caption">
                    {thread.canSend
                      ? `No messages yet. Say hello to ${thread.candidateName}!`
                      : "No messages in this conversation."}
                  </p>
                </div>
              ) : (
                conversationMessages.map((msg) => {
                  if (msg.senderType === "SYSTEM") {
                    return (
                      <p
                        key={msg.id}
                        className="self-center max-w-[85%] text-center text-[11.5px] text-txt-caption px-3 py-1 rounded-full bg-bg-primary/60"
                      >
                        {msg.text}
                        <span className="ml-1.5 opacity-70">{formatDateTime(msg.createdAt)}</span>
                      </p>
                    )
                  }
                  const mine = !!msg.senderId && msg.senderId === user?.id
                  const ourSide = isRecruiter ? msg.senderType !== "SEEKER" : mine
                  const showLabel = !mine || isRecruiter
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${ourSide ? "items-end" : "items-start"}`}
                    >
                      {showLabel && (
                        <span className="text-[10.5px] text-txt-caption font-semibold px-1 mb-0.5">
                          {authorLabel(msg, mine)}
                        </span>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[72%] break-words whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[13px] leading-relaxed ${
                          mine
                            ? "bg-primary text-white rounded-tr-[4px]"
                            : ourSide
                              ? "bg-primary-light text-txt-heading border border-primary-border/30 rounded-tr-[4px]"
                              : "bg-bg-primary border border-bg-border text-txt-heading rounded-tl-[4px]"
                        } ${msg.status === "failed" ? "opacity-70" : ""}`}
                      >
                        {msg.text}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-txt-caption">
                        {msg.status === "sending" ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Sending…
                          </span>
                        ) : msg.status === "failed" ? (
                          <span className="flex items-center gap-1 text-sec-red font-semibold">
                            <AlertCircle className="w-3 h-3" /> Not delivered ·
                            <button
                              type="button"
                              onClick={() => handleRetry(msg)}
                              className="inline-flex items-center gap-0.5 underline cursor-pointer hover:text-sec-red/80"
                            >
                              <RotateCw className="w-3 h-3" /> Retry
                            </button>
                          </span>
                        ) : (
                          <>
                            <time dateTime={msg.createdAt}>{timeLabel(msg.createdAt)}</time>
                            {mine &&
                              (msg.read ? (
                                <CheckCheck className="w-3 h-3 text-primary" aria-label="Seen" />
                              ) : (
                                <Check className="w-3 h-3" aria-label="Sent" />
                              ))}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div
              className="h-5 px-4 text-[11px] text-txt-caption italic shrink-0"
              aria-live="polite"
            >
              {typing ? `${typing.name} is typing…` : ""}
            </div>

            {closedText ? (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-bg-border/40 text-[12.5px] text-txt-caption bg-bg-primary/40 shrink-0">
                <Lock className="w-4 h-4 shrink-0" />
                {closedText}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="flex items-end gap-3 px-4 py-4 border-t border-bg-border/40 shrink-0"
              >
                <label htmlFor="message-input" className="sr-only">
                  Message {thread.candidateName}
                </label>
                <textarea
                  id="message-input"
                  ref={inputRef}
                  rows={2}
                  maxLength={5000}
                  placeholder={`Message ${thread.candidateName}…`}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    sendTyping(thread.applicationId, e.target.value.trim().length > 0)
                  }}
                  onBlur={() => sendTyping(thread.applicationId, false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  className="flex-1 min-w-0 min-h-[64px] max-h-48 resize-none px-4 py-3.5 rounded-xl border border-bg-border bg-bg-primary text-[14px] leading-relaxed text-txt-heading placeholder:text-txt-caption focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all field-sizing-content"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!input.trim()}
                  className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white disabled:opacity-50 hover:bg-primary-hover transition-all cursor-pointer shrink-0 mb-1"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="flex-1 flex h-full items-center justify-center p-6">
            <div className="text-center">
              <MessageSquare className="w-10 h-10 text-txt-disabled mx-auto mb-2" />
              <p className="text-[14px] text-txt-caption">
                {activeConversationId && messagesLoading
                  ? "Loading conversation…"
                  : "Select a conversation to start messaging"}
              </p>
            </div>
          </div>
        )}
      </Card>

      {showDetailsPanel && (
        <aside className="hidden w-[220px] shrink-0 xl:block">
          <Card className="h-full rounded-xl p-4 shadow-none">
            {thread ? (
              <div className="flex h-full flex-col">
                <div className="flex flex-col items-center border-b border-bg-border pb-4 text-center">
                  <img
                    src={thread.candidateAvatar}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <p className="mt-2 text-[12.5px] font-bold text-txt-heading">
                    {thread.candidateName}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-txt-caption">
                    {isRecruiter ? "Candidate" : "Hiring contact"}
                  </p>
                </div>
                <dl className="space-y-3 py-4 text-[11.5px]">
                  {thread.company && (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-txt-caption">
                        Company
                      </dt>
                      <dd className="mt-1 font-medium text-txt-body">{thread.company}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-txt-caption">
                      Role
                    </dt>
                    <dd className="mt-1 font-medium text-txt-body">{thread.jobTitle}</dd>
                  </div>
                  {thread.status && (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-txt-caption">
                        Status
                      </dt>
                      <dd className="mt-1 font-medium text-txt-body">
                        {applicationStatusLabel(thread.status)}
                      </dd>
                    </div>
                  )}
                </dl>
                <button
                  type="button"
                  onClick={() => setPendingDelete(thread.applicationId)}
                  className="mt-auto w-full rounded-md border border-bg-border py-2 text-[11px] font-semibold text-txt-caption hover:bg-bg-hover cursor-pointer"
                >
                  Delete conversation
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-[11px] text-txt-caption">
                Select a conversation to view its details.
              </div>
            )}
          </Card>
        </aside>
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              {isRecruiter
                ? "The conversation is removed from your inbox only. The candidate and your teammates keep their copy."
                : "The conversation is removed from your inbox. The hiring team keeps their copy."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
