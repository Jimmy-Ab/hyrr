import { Info } from "lucide-react"
import { AI_UNAVAILABLE_MESSAGE } from "../lib/ai-availability"

/** Shown next to a disabled AI action so the seeker knows why it can't be used. */
export function AiUnavailableNote({ id }: { id?: string }) {
  return (
    <p id={id} role="note" className="flex items-start gap-1.5 text-[12px] text-txt-caption">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {AI_UNAVAILABLE_MESSAGE}
    </p>
  )
}
