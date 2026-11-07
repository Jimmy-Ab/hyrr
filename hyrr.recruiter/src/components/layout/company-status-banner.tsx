import { ShieldAlert } from "lucide-react"
import { useJobStore } from "../../store/useJobStore"

/** Whether an admin suspended the signed-in recruiter's company (updates live via socket). */
export function useCompanySuspended() {
  return useJobStore((s) => s.user?.company?.status === "SUSPENDED")
}

/** Full-width notice while the company is suspended: read-only access, how to get help. */
export function CompanyStatusBanner() {
  const suspended = useCompanySuspended()
  const supportEmail = useJobStore((s) => s.user?.supportEmail)
  if (!suspended) return null
  return (
    <div
      role="alert"
      className="tone-rose flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--tone-ring)] bg-[var(--tone-bg)] px-4 py-2.5 text-[13px] text-txt-heading md:px-6 animate-rise"
    >
      <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--tone-fg)]" aria-hidden="true" />
      <span className="font-semibold text-[var(--tone-fg)]">Your company is suspended.</span>
      <span className="text-txt-body">
        You can view your jobs and candidates, but you can't post, edit or message until Hyrr
        restores access. The reason is in your notifications.
      </span>
      {supportEmail && (
        <a
          href={`mailto:${supportEmail}`}
          className="ml-auto font-semibold text-[var(--tone-fg)] underline-offset-2 hover:underline"
        >
          Contact support
        </a>
      )}
    </div>
  )
}
