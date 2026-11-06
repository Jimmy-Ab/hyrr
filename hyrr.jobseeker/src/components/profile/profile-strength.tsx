import { Card, type SeekerView, useJobStore } from "hyrr.shared"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import type { ReactNode } from "react"

/** Where a "missing" item from GET /profile is fixed. */
function targetFor(item: string): SeekerView {
  return /resume|\bcv\b|document/i.test(item) ? "Documents" : "Profile"
}

function barColor(strength: number) {
  if (strength >= 80) return "bg-sec-green"
  if (strength >= 50) return "bg-primary"
  return "bg-sec-orange"
}

interface ProfileStrengthCardProps {
  /** Max "next steps" shown */
  limit?: number
  className?: string
  footer?: ReactNode
}

/** Server-computed profile strength (GET /profile) with next-step links. */
export function ProfileStrengthCard({ limit = 4, className, footer }: ProfileStrengthCardProps) {
  const profileStrength = useJobStore((s) => s.profileStrength)
  const profileMissing = useJobStore((s) => s.profileMissing)
  const activeView = useJobStore((s) => s.candidateActiveView)
  const setView = useJobStore((s) => s.setCandidateActiveView)
  const steps = profileMissing.slice(0, limit)

  return (
    <Card className={`p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-txt-heading">
          Profile strength
        </h3>
        <span className="text-[13px] font-extrabold text-primary">{profileStrength}%</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-bg-primary"
        role="progressbar"
        aria-label="Profile strength"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={profileStrength}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor(profileStrength)}`}
          style={{ width: `${profileStrength}%` }}
        />
      </div>
      {steps.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-semibold text-txt-caption">Next steps</p>
          <ul className="space-y-1">
            {steps.map((item) => {
              const target = targetFor(item)
              return (
                <li key={item}>
                  {target === activeView ? (
                    <span className="flex items-center gap-2 text-[12.5px] font-medium text-txt-body">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-sec-orange"
                        aria-hidden="true"
                      />
                      {item}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setView(target)}
                      className="group flex w-full items-center gap-2 rounded-lg py-0.5 text-left text-[12.5px] font-medium text-txt-body hover:text-primary cursor-pointer"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-sec-orange"
                        aria-hidden="true"
                      />
                      <span className="flex-1">{item}</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-sec-green">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Your profile is complete
        </p>
      )}
      {footer}
    </Card>
  )
}
