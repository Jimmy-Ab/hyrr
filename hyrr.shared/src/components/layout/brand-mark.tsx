import { toneClass, type Tone } from "../../lib/tones"
import { cn } from "../../lib/utils"

/** HYRR monogram: geometric "H" with the accent mark. */
export function HyrrIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="#7C5CFC" />
      <rect x="8" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="24" y="9" width="4" height="18" rx="2" fill="white" />
      <rect x="8" y="15.5" width="20" height="4" rx="2" fill="white" />
      <circle cx="28.5" cy="8.5" r="3" fill="#FFB547" />
    </svg>
  )
}

/** Same brand in every app's header: icon + HYRR + an app badge ("Recruiter", "Careers", "Admin"). */
export function BrandMark({
  app,
  tone = "violet",
  className,
}: {
  app: string
  tone?: Tone
  className?: string
}) {
  return (
    <span className={cn("flex shrink-0 items-center gap-2", className)}>
      <HyrrIcon size={30} />
      <span className="hidden text-[15px] font-bold tracking-[-0.01em] text-txt-title sm:inline">
        HYRR
      </span>
      <span
        className={cn(
          toneClass(tone),
          "hidden rounded-full bg-[var(--tone-bg)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--tone-fg)] ring-1 ring-[var(--tone-ring)] sm:inline"
        )}
      >
        {app}
      </span>
    </span>
  )
}

/** Shared header height for all three apps (keep in sync with the e2e shell check). */
export const APP_HEADER_CLASS =
  "glass relative z-30 flex h-[64px] shrink-0 select-none items-center gap-3 border-b border-bg-border/70 px-4 md:px-6"
