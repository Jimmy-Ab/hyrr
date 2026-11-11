import { Badge } from "hyrr.shared"
import { Globe2, Tag } from "lucide-react"

/** Remote badge, category and the first key skills on a job list card. */
export function JobCardMeta({
  remote,
  category,
  skills = [],
  maxSkills = 3,
}: {
  remote?: boolean
  category?: string | null
  skills?: string[]
  maxSkills?: number
}) {
  const shown = skills.slice(0, maxSkills)
  const more = skills.length - shown.length
  if (!remote && !category && shown.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="job-card-meta">
      {remote && (
        <Badge variant="info" className="gap-1">
          <Globe2 className="h-3 w-3" aria-hidden />
          Remote
        </Badge>
      )}
      {category && (
        <span className="inline-flex max-w-[160px] items-center gap-1 truncate text-[11.5px] font-medium text-txt-caption">
          <Tag className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{category}</span>
        </span>
      )}
      {shown.length > 0 && (
        <ul aria-label="Key skills" className="flex flex-wrap gap-1">
          {shown.map((s) => (
            <li
              key={s}
              className="rounded-full border border-bg-border px-2 py-0.5 text-[11px] font-medium text-txt-body"
            >
              {s}
            </li>
          ))}
          {more > 0 && <li className="px-1 py-0.5 text-[11px] text-txt-caption">+{more}</li>}
        </ul>
      )}
    </div>
  )
}
