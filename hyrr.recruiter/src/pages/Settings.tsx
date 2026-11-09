import {
  AccountSecuritySettings,
  Card,
  newApplicantSoundEnabled,
  playChime,
  setNewApplicantSound,
  useToast,
  VerifiedBadge,
  type TeamMember,
  type UserTheme,
} from "hyrr.shared"
import { Monitor, Moon, Sun } from "lucide-react"
import * as React from "react"
import { CompanyProfileSettings } from "../components/settings/company-profile-settings"
import { LabelsManager } from "../components/settings/labels-manager"
import { avatarFallback, errorMessage, useCompanyVerified } from "../lib/recruiter"
import { useJobStore } from "../store/useJobStore"

const COMPANY_ROLE_LABEL: Record<TeamMember["role"], string> = {
  OWNER: "Owner",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  VIEWER: "Viewer",
}

const THEME_OPTIONS: { value: UserTheme; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-bg-border/40 last:border-b-0">
      <dt className="sm:w-40 shrink-0 text-[12px] font-semibold uppercase tracking-wider text-txt-caption">
        {label}
      </dt>
      <dd className="text-[14px] text-txt-heading min-w-0 break-words">{children}</dd>
    </div>
  )
}

export function Settings() {
  const { user, team, fetchTeam, workspaceName, theme, setTheme } = useJobStore()
  const companyVerified = useCompanyVerified()
  const { toast } = useToast()
  const [themeBusy, setThemeBusy] = React.useState(false)

  // The company role comes from the team list; load it once if nobody opened the Team dialog yet.
  React.useEffect(() => {
    if (team.length === 0) fetchTeam().catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const companyRole = team.find((m) => m.userId === user?.id)?.role

  const changeTheme = async (next: UserTheme) => {
    if (next === theme) return
    setThemeBusy(true)
    try {
      await setTheme(next)
    } catch (err) {
      toast("Could not save theme", errorMessage(err), "error")
    } finally {
      setThemeBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl animate-in fade-in duration-200 min-w-0">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-txt-title">Settings</h1>
        <p className="text-[14px] text-txt-body mt-1">
          Manage your account, company, labels, security and appearance.
        </p>
      </div>

      <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
        <section aria-labelledby="settings-account">
          <h2 id="settings-account" className="text-[16px] font-semibold text-txt-heading">
            Account
          </h2>
          <div className="flex items-center gap-4 mt-4">
            <img
              src={user?.avatar || avatarFallback(user?.name || user?.email || "Recruiter")}
              alt=""
              className="w-14 h-14 rounded-full object-cover border border-bg-border/60 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-txt-heading truncate">
                {user?.name || "Recruiter"}
              </p>
              <p className="text-[13px] text-txt-caption truncate">{user?.email}</p>
            </div>
          </div>
          <dl className="mt-4">
            <Row label="Name">{user?.name || "—"}</Row>
            <Row label="Email">{user?.email || "—"}</Row>
            <Row label="Role">
              Recruiter
              {companyRole && (
                <span className="text-txt-caption"> · {COMPANY_ROLE_LABEL[companyRole]}</span>
              )}
            </Row>
            {workspaceName && (
              <Row label="Company">
                <span className="inline-flex items-center gap-1.5">
                  {workspaceName}
                  {companyVerified && <VerifiedBadge size="md" />}
                </span>
              </Row>
            )}
          </dl>
        </section>
      </Card>

      <CompanyProfileSettings />

      <LabelsManager />

      <LiveSoundSetting />

      <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
        <section aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="text-[16px] font-semibold text-txt-heading">
            Appearance
          </h2>
          <p className="text-[13px] text-txt-caption mt-1">
            Choose a theme. System follows your device setting.
          </p>
          <div
            role="radiogroup"
            aria-labelledby="settings-appearance"
            className="mt-4 grid grid-cols-3 gap-2 max-w-md"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={themeBusy}
                  onClick={() => changeTheme(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[13px] font-medium transition-colors cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    selected
                      ? "border-primary bg-primary-light text-primary"
                      : "border-bg-border bg-bg-secondary text-txt-body hover:bg-bg-hover hover:text-txt-heading"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      </Card>

      <AccountSecuritySettings />
    </div>
  )
}

/** "Sound for new applicants": off by default, remembered in this browser only. */
function LiveSoundSetting() {
  const [on, setOn] = React.useState(() => newApplicantSoundEnabled())
  const toggle = () => {
    const next = !on
    setOn(next)
    setNewApplicantSound(next)
    if (next) playChime()
  }
  return (
    <Card className="p-6 rounded-2xl border border-bg-border/60 bg-bg-card">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h2 id="settings-live-sound" className="text-[16px] font-semibold text-txt-heading">
            Sound for new applicants
          </h2>
          <p className="text-[13px] text-txt-caption mt-1">
            Play a short chime when someone applies while Hyrr is open. Saved on this browser.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="settings-live-sound"
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
            on ? "bg-primary" : "bg-bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg-secondary shadow transition-transform ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </section>
    </Card>
  )
}
