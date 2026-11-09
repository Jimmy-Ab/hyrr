import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FieldError,
  Input,
  PageHeader,
  errorMessage,
  useJobStore,
  useToast,
  type TalentCard,
  type TalentProfile,
} from "hyrr.shared"
import { Briefcase, Loader2, MapPin, Search, Send, Sparkles, UserSearch } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { avatarFallback } from "../../lib/recruiter"

const EXAMPLES = [
  "Backend engineer NestJS PostgreSQL",
  "Product designer Figma",
  "Data analyst SQL Python",
]

function ProfileSheet({ card, onClose }: { card: TalentCard | null; onClose: () => void }) {
  const fetchTalentProfile = useJobStore((s) => s.fetchTalentProfile)
  const reachOut = useJobStore((s) => s.reachOut)
  const jobs = useJobStore((s) => s.jobs)
  const wallet = useJobStore((s) => s.wallet)
  const pricing = useJobStore((s) => s.pricing)
  const { toast } = useToast()
  const [profile, setProfile] = useState<TalentProfile | null>(null)
  const [jobId, setJobId] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const openJobs = jobs.filter((j) => j.status === "Active" && !j.removedAt)
  const cost = pricing?.outreachCost ?? 5

  useEffect(() => {
    setProfile(null)
    setError(null)
    setSent(false)
    setMessage(card ? `Hi ${card.name.split(" ")[0]}, ` : "")
    setJobId(openJobs.find((j) => !card?.existingJobIds.includes(j.id))?.id ?? "")
    if (card)
      fetchTalentProfile(card.id)
        .then(setProfile)
        .catch((err) => setError(errorMessage(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!card) return
    if (!jobId) return setError("Choose one of your open jobs")
    if (message.trim().length < 20)
      return setError("Write a short personal message (at least 20 characters)")
    setSending(true)
    setError(null)
    try {
      await reachOut(card.id, jobId, message.trim())
      setSent(true)
      toast(
        "Message sent",
        `${card.name} will see it in Hyrr. ${cost} credits were used.`,
        "success"
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent variant="sheet" className="max-w-lg overflow-y-auto">
        {card && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <img
                  src={card.avatar || avatarFallback(card.name)}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <DialogTitle>{card.name}</DialogTitle>
                  <DialogDescription>
                    {card.title}
                    {card.location ? ` · ${card.location}` : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-5 space-y-4 text-[13px]">
              {card.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {card.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-bg-hover px-2.5 py-1 text-[12px] text-txt-body"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {!profile && !error && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {profile?.bio && <p className="whitespace-pre-line text-txt-body">{profile.bio}</p>}
              {!!profile?.experiences.length && (
                <section>
                  <p className="mb-1 font-semibold text-txt-heading">Experience</p>
                  <ul className="space-y-1">
                    {profile.experiences.map((e, i) => (
                      <li key={i} className="text-txt-body">
                        {e.role} · {e.company}
                        <span className="text-txt-caption">
                          {" "}
                          {e.startDate ? new Date(e.startDate).getFullYear() : ""}–
                          {e.current ? "now" : e.endDate ? new Date(e.endDate).getFullYear() : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!!profile?.educations.length && (
                <section>
                  <p className="mb-1 font-semibold text-txt-heading">Education</p>
                  <ul className="space-y-1">
                    {profile.educations.map((e, i) => (
                      <li key={i} className="text-txt-body">
                        {e.degree} · {e.school}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className="text-[12px] text-txt-caption">
                Contact details and CV are shared only after {card.name.split(" ")[0]} says they're
                interested.
              </p>
            </div>

            <form onSubmit={send} className="mt-6 space-y-3 border-t border-bg-border/50 pt-5">
              <p className="text-[13px] font-semibold text-txt-heading">
                Reach out · {cost} credits
              </p>
              {sent ? (
                <p className="rounded-xl bg-bg-hover/60 p-3 text-[13px] text-txt-body">
                  Sent. They'll find your message in Hyrr and can answer Interested or Not
                  interested. Their card is in your board's "Reached out" column.
                </p>
              ) : openJobs.length === 0 ? (
                <p className="text-[13px] text-txt-caption">
                  Publish a job first to reach out about it.
                </p>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="outreach-job"
                      className="text-[12.5px] font-medium text-txt-heading"
                    >
                      About which job?
                    </label>
                    <select
                      id="outreach-job"
                      value={jobId}
                      onChange={(e) => setJobId(e.target.value)}
                      className="h-11 w-full rounded-input border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-heading"
                    >
                      <option value="">Choose a job</option>
                      {openJobs.map((j) => (
                        <option
                          key={j.id}
                          value={j.id}
                          disabled={card.existingJobIds.includes(j.id)}
                        >
                          {j.title}
                          {card.existingJobIds.includes(j.id) ? " (already in your pipeline)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="outreach-message"
                      className="text-[12.5px] font-medium text-txt-heading"
                    >
                      Your message
                    </label>
                    <textarea
                      id="outreach-message"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full rounded-input border border-bg-border bg-bg-secondary px-3 py-2 text-[13px] text-txt-heading"
                    />
                  </div>
                  <FieldError id="outreach-error" message={error ?? undefined} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-txt-caption">
                      Balance: {wallet?.balance ?? "–"} credits
                    </span>
                    <Button type="submit" disabled={sending} className="gap-1.5">
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send · {cost} credits
                    </Button>
                  </div>
                </>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Find seekers who opted in to being contacted ("Open to recruiters") and reach out. */
export function TalentSearch() {
  const searchTalent = useJobStore((s) => s.searchTalent)
  const [q, setQ] = useState("")
  const [location, setLocation] = useState("")
  const [results, setResults] = useState<TalentCard[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<TalentCard | null>(null)

  const run = async (query = q) => {
    setLoading(true)
    setError(null)
    try {
      setResults((await searchTalent(query, location)).results)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={UserSearch}
        tone="violet"
        title="Talent search"
        subtitle="People who chose to be found by recruiters. Describe who you're looking for."
      />
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-caption" />
          <label htmlFor="talent-q" className="sr-only">
            Search
          </label>
          <Input
            id="talent-q"
            className="pl-10"
            placeholder="e.g. Full-stack engineer NestJS PostgreSQL"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="relative sm:w-56">
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-caption" />
          <label htmlFor="talent-location" className="sr-only">
            Location
          </label>
          <Input
            id="talent-location"
            className="pl-10"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-[13px] text-sec-red">
          {error}
        </p>
      )}

      {results === null ? (
        <EmptyState
          icon={Sparkles}
          title="Search Hyrr's open talent"
          description="Only people who turned on “Open to recruiters” appear here. Try:"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <Button
                  key={ex}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setQ(ex)
                    void run(ex)
                  }}
                >
                  {ex}
                </Button>
              ))}
            </div>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title="No matches yet"
          description="Try fewer or broader words. More people open their profiles every day."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpen(c)}
                className="spotlight flex h-full w-full cursor-pointer flex-col gap-3 rounded-card border border-bg-border/70 bg-bg-secondary p-4 text-left transition-shadow hover:shadow-card-hover"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={c.avatar || avatarFallback(c.name)}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-txt-heading">{c.name}</p>
                    <p className="truncate text-[12.5px] text-txt-body">{c.title}</p>
                  </div>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-txt-caption">
                  {c.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {c.location}
                    </span>
                  )}
                  {c.yearsExperience > 0 && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> {c.yearsExperience} yrs
                    </span>
                  )}
                  {c.existingJobIds.length > 0 && (
                    <span className="text-primary">In your pipeline</span>
                  )}
                </p>
                {c.headline && <p className="text-[12.5px] text-txt-body">{c.headline}</p>}
                <div className="flex flex-wrap gap-1">
                  {c.skills.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-bg-hover px-2 py-0.5 text-[11.5px] text-txt-body"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ProfileSheet card={open} onClose={() => setOpen(null)} />
    </div>
  )
}
