import {
  APPLICATION_STATUS,
  Button,
  ConfirmDialog,
  errorMessage,
  useJobStore,
  useToast,
  type JobApplication,
} from "hyrr.shared"
import { Ban, Loader2, MessageCircle, Sparkles, UserCheck } from "lucide-react"
import { useEffect, useState } from "react"

/** Recruiters who reached out from talent search; the seeker answers here (Applications page). */
export function OutreachInvitations() {
  const apps = useJobStore((s) => s.jobApplications).filter(
    (a) => a.status === APPLICATION_STATUS.SOURCED
  )
  const respondToOutreach = useJobStore((s) => s.respondToOutreach)
  const blockOutreachCompany = useJobStore((s) => s.blockOutreachCompany)
  const openConversation = useJobStore((s) => s.openConversation)
  const setCandidateActiveView = useJobStore((s) => s.setCandidateActiveView)
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [blocking, setBlocking] = useState<JobApplication | null>(null)

  if (!apps.length) return null

  const answer = async (a: JobApplication, interested: boolean) => {
    setBusy(a.id)
    try {
      await respondToOutreach(a.id, interested)
      toast(
        interested ? "Great, you're in" : "Thanks for letting them know",
        interested
          ? `${a.company} now sees your application for ${a.title}, at no cost to you.`
          : `${a.company} won't contact you about ${a.title} again.`,
        "success"
      )
    } catch (err) {
      toast("Could not answer", errorMessage(err), "error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Recruiters who reached out" className="flex flex-col gap-2">
      {apps.map((a) => (
        <div
          key={a.id}
          className="tone-violet flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--tone-ring)] bg-[var(--tone-bg)] p-4"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-[var(--tone-fg)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-txt-heading">
              {a.company} reached out about {a.title}
            </p>
            <p className="text-[12.5px] text-txt-body">
              {a.recruiterName ? `${a.recruiterName} sent you a message. ` : ""}Interested? Your
              application is free, the company paid to contact you.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                openConversation?.(a.id)
                setCandidateActiveView("Messages")
              }}
              className="gap-1.5"
            >
              <MessageCircle className="h-4 w-4" /> Read message
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy === a.id}
              onClick={() => answer(a, false)}
            >
              Not interested
            </Button>
            <Button
              size="sm"
              disabled={busy === a.id}
              onClick={() => answer(a, true)}
              className="gap-1.5"
            >
              {busy === a.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Interested
            </Button>
            <button
              type="button"
              onClick={() => setBlocking(a)}
              aria-label={`Block ${a.company}`}
              title={`Block ${a.company}`}
              className="rounded-full p-2 text-txt-caption hover:bg-sec-red/10 hover:text-sec-red cursor-pointer"
            >
              <Ban className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        title={`Block ${blocking?.company ?? "this company"}?`}
        description="They won't find you in talent search or contact you again. You can unblock them in Settings → Privacy."
        confirmLabel="Block company"
        onConfirm={async () => {
          if (!blocking) return
          try {
            await blockOutreachCompany(blocking.id)
            toast("Company blocked", undefined, "success")
          } catch (err) {
            toast("Could not block", errorMessage(err), "error")
            throw err
          }
        }}
      />
    </section>
  )
}

/** Settings → Privacy: opt in to talent search, and manage blocked companies. */
export function OpenToRecruiters() {
  const visibility = useJobStore((s) => s.talentVisibility)
  const fetchTalentVisibility = useJobStore((s) => s.fetchTalentVisibility)
  const setTalentVisibility = useJobStore((s) => s.setTalentVisibility)
  const unblockCompany = useJobStore((s) => s.unblockCompany)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetchTalentVisibility().catch(() => undefined)
  }, [fetchTalentVisibility])

  const open = !!visibility?.open
  const toggle = async () => {
    setSaving(true)
    try {
      await setTalentVisibility(!open)
      toast(
        open ? "You're hidden from recruiters" : "You're open to recruiters",
        open ? undefined : "Recruiters can now find your profile and reach out.",
        "success"
      )
    } catch (err) {
      toast("Could not update", errorMessage(err), "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 rounded-[14px] border border-bg-border/60 bg-bg-secondary space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id="open-to-recruiters" className="text-[13px] font-semibold text-txt-heading">
            Open to recruiters
          </p>
          <p className="text-[12.5px] text-txt-caption mt-0.5">
            Let hiring teams find you in talent search and message you about their jobs. They see
            your name, title, location, skills, experience and education, never your e-mail, phone
            or CV until you say you're interested.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-labelledby="open-to-recruiters"
          disabled={saving || !visibility}
          onClick={toggle}
          className={`relative w-12 h-6 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-60 ${open ? "bg-primary" : "bg-bg-border"}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-bg-secondary shadow transition-transform ${open ? "translate-x-6" : "translate-x-0.5"}`}
          />
        </button>
      </div>
      {!!visibility?.blockedCompanies.length && (
        <div>
          <p className="text-[12.5px] font-semibold text-txt-heading">Blocked companies</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {visibility.blockedCompanies.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-full bg-bg-hover px-3 py-1 text-[12.5px] text-txt-body"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() =>
                    unblockCompany(c.id).catch((err) =>
                      toast("Could not unblock", errorMessage(err), "error")
                    )
                  }
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
