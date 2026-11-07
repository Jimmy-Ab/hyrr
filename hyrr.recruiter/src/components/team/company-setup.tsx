import {
  BrandMark,
  Button,
  FieldError,
  Input,
  companySetupSchema,
  errorMessage,
  useJobStore,
  useToast,
  validate,
  type CompanyMatch,
  type FieldErrors,
} from "hyrr.shared"
import { Building2, Clock, Loader2, LogOut, Users } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

/**
 * Recruiters without a company (OAuth sign-up, left a team, declined join request) choose here:
 * create a company, or ask to join the verified company on their e-mail domain.
 */
export function CompanySetupScreen() {
  const user = useJobStore((s) => s.user)
  const logout = useJobStore((s) => s.logout)
  const setupCompany = useJobStore((s) => s.setupCompany)
  const myJoinRequest = useJobStore((s) => s.myJoinRequest)
  const fetchMyJoinRequest = useJobStore((s) => s.fetchMyJoinRequest)
  const requestToJoin = useJobStore((s) => s.requestToJoin)
  const cancelJoinRequest = useJobStore((s) => s.cancelJoinRequest)
  const findCompanyByEmail = useJobStore((s) => s.findCompanyByEmail)
  const { toast } = useToast()

  const [match, setMatch] = useState<CompanyMatch | null>(null)
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState<"create" | "join" | "cancel" | null>(null)

  // An owner approving the request arrives as a live notification: re-check the account then.
  const notificationCount = useJobStore((s) => s.notifications.length)
  const loadAccount = useJobStore((s) => s.loadAccount)
  const fetchInitialData = useJobStore((s) => s.fetchInitialData)
  useEffect(() => {
    if (notificationCount === 0) return
    void loadAccount()
      .then(() => {
        if (useJobStore.getState().user?.company) return fetchInitialData({ force: true })
        return fetchMyJoinRequest()
      })
      .catch(() => undefined)
  }, [notificationCount, loadAccount, fetchInitialData, fetchMyJoinRequest])

  useEffect(() => {
    void fetchMyJoinRequest().catch(() => undefined)
    if (user?.email) void findCompanyByEmail(user.email).then(setMatch)
  }, [fetchMyJoinRequest, findCompanyByEmail, user?.email])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(companySetupSchema, { name, website })
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy("create")
    try {
      await setupCompany({ name: name.trim(), website: website.trim() || undefined })
      toast("Company created", `Welcome to ${name.trim()}.`, "success")
    } catch (err) {
      toast("Could not create the company", errorMessage(err), "error")
    } finally {
      setBusy(null)
    }
  }

  const join = async (companyId: string) => {
    setBusy("join")
    try {
      await requestToJoin(companyId)
      toast("Request sent", "An owner will review it. We'll notify you.", "success")
    } catch (err) {
      toast("Could not send the request", errorMessage(err), "error")
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    setBusy("cancel")
    try {
      await cancelJoinRequest()
    } catch (err) {
      toast("Could not cancel the request", errorMessage(err), "error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen w-full bg-bg-primary flex flex-col">
      <div className="flex h-[64px] items-center justify-between px-4 md:px-6 border-b border-bg-border/70">
        <BrandMark app="Recruiter" />
        <Button variant="ghost" size="sm" onClick={() => void logout()} className="gap-1.5">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[520px] flex flex-col gap-5">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-txt-title">
              Set up your company
            </h1>
            <p className="mt-1 text-body text-txt-body">
              Hi {user?.name?.split(" ")[0] || "there"}, your jobs, candidates and team live in a
              company workspace. Create one, or join your colleagues.
            </p>
          </div>

          {myJoinRequest ? (
            <section
              aria-live="polite"
              className="tone-amber rounded-2xl border border-[var(--tone-ring)] bg-[var(--tone-bg)] p-4"
            >
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tone-fg)]" />
                <div className="flex-1">
                  <p className="font-semibold text-txt-heading">
                    Waiting for {myJoinRequest.company.name} to approve you
                  </p>
                  <p className="mt-0.5 text-[13px] text-txt-body">
                    An owner gets a notification. You can also create your own company below.
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={cancel} disabled={busy === "cancel"}>
                  Cancel request
                </Button>
              </div>
            </section>
          ) : (
            match && (
              <section className="rounded-2xl border border-bg-border bg-bg-secondary p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-txt-heading truncate">
                      {match.name} is already on Hyrr
                    </p>
                    <p className="text-[13px] text-txt-caption">
                      Your e-mail matches their verified domain.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => join(match.id)} disabled={!!busy}>
                    {busy === "join" && <Loader2 className="h-4 w-4 animate-spin" />}
                    Ask to join
                  </Button>
                </div>
              </section>
            )
          )}

          <form
            onSubmit={create}
            noValidate
            className="rounded-2xl border border-bg-border bg-bg-secondary p-5 flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold text-txt-heading">
              <Building2 className="h-4 w-4 text-primary" /> Create a new company
            </div>
            <div>
              <label htmlFor="setup-company" className="text-[13px] font-medium text-txt-heading">
                Company name
              </label>
              <Input
                id="setup-company"
                className="mt-1"
                placeholder="Acme Inc."
                autoComplete="organization"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setErrors((c) => ({ ...c, name: "" }))
                }}
                aria-invalid={!!errors.name || undefined}
                aria-describedby={errors.name ? "setup-company-error" : undefined}
              />
              <FieldError id="setup-company-error" message={errors.name || undefined} />
            </div>
            <div>
              <label htmlFor="setup-website" className="text-[13px] font-medium text-txt-heading">
                Website <span className="font-normal text-txt-caption">(optional)</span>
              </label>
              <Input
                id="setup-website"
                className="mt-1"
                placeholder="https://acme.com"
                inputMode="url"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value)
                  setErrors((c) => ({ ...c, website: "" }))
                }}
                aria-invalid={!!errors.website || undefined}
                aria-describedby={errors.website ? "setup-website-error" : "setup-website-hint"}
              />
              <FieldError id="setup-website-error" message={errors.website || undefined} />
              {!errors.website && (
                <p id="setup-website-hint" className="mt-1 text-[12px] text-txt-caption">
                  Your company gets a verified badge when your e-mail matches this website.
                </p>
              )}
            </div>
            <Button type="submit" disabled={!!busy} className="self-start gap-1.5">
              {busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />}
              Create company
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
