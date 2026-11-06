import { X } from "lucide-react"
import { type KeyboardEvent, useState } from "react"

interface ChipsInputProps {
  id: string
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  max?: number
  hint?: string
}

/** Free-text chips: Enter or comma adds, Backspace on an empty field removes the last one. */
export function ChipsInput({
  id,
  label,
  values,
  onChange,
  placeholder,
  max,
  hint,
}: ChipsInputProps) {
  const [draft, setDraft] = useState("")
  const full = max !== undefined && values.length >= max

  const commit = () => {
    const value = draft.trim().replace(/,+$/, "").trim()
    if (!value || full) return
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...values, value])
    setDraft("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      commit()
    } else if (e.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-txt-heading">
        {label}
      </label>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-bg-border bg-bg-primary px-2 py-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-primary-border/40 bg-primary-light px-2.5 py-0.5 text-[12px] font-semibold text-primary"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="rounded-full hover:text-sec-red cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          disabled={full}
          placeholder={full ? `Up to ${max}` : placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {hint && <p className="text-[12px] text-txt-caption">{hint}</p>}
    </div>
  )
}
