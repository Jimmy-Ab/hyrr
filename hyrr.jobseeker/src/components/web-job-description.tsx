import { CheckCircle2 } from "lucide-react"
import { useMemo } from "react"
import { descriptionBlocks } from "../lib/description-blocks"

/**
 * A web job's plain-text description laid out like a Hyrr job: section headings, readable
 * paragraphs and check-mark lists. Starts with "About the role" when the text has no heading.
 */
export function WebJobDescription({ text }: { text: string }) {
  const blocks = useMemo(() => descriptionBlocks(text), [text])
  const startsWithHeading = blocks[0]?.kind === "heading"
  return (
    <div
      className="space-y-3 text-[13.5px] leading-relaxed text-txt-body"
      data-testid="web-job-description"
    >
      {!startsWithHeading && (
        <h3 className="text-[14px] font-bold text-txt-heading">About the role</h3>
      )}
      {blocks.map((b, i) =>
        b.kind === "heading" ? (
          <h3
            key={i}
            className={`text-[14px] font-bold text-txt-heading ${i > 0 ? "border-t border-bg-border/40 pt-5 mt-5" : ""}`}
          >
            {b.text}
          </h3>
        ) : b.kind === "list" ? (
          <ul key={i} className="space-y-2">
            {b.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        )
      )}
    </div>
  )
}
