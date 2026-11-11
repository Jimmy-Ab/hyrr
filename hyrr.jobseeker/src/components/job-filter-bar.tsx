import {
  Button,
  POSTED_WITHIN_OPTIONS,
  SalaryRangeInput,
  apiFetch,
  emptySalaryRange,
  salaryFilterSchema,
  validate,
  type FieldErrors,
  type JobFilterInput,
  type SalaryRangeValue,
} from "hyrr.shared"
import { ChevronDown, X } from "lucide-react"
import { useEffect, useState } from "react"

export type JobCategoryOption = { id: string; name: string }

let categoriesCache: Promise<JobCategoryOption[]> | null = null

/** Job categories (public list), fetched once per page load. */
export function useJobCategories(): JobCategoryOption[] {
  const [list, setList] = useState<JobCategoryOption[]>([])
  useEffect(() => {
    categoriesCache ??= apiFetch("/jobs/categories")
      .then((rows) =>
        (Array.isArray(rows) ? rows : []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name),
        }))
      )
      .catch(() => {
        categoriesCache = null
        return []
      })
    let alive = true
    void categoriesCache.then((rows) => alive && setList(rows))
    return () => {
      alive = false
    }
  }, [])
  return list
}

export const WEB_TYPE_OPTIONS = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
] as const

const selectClass =
  "h-9 rounded-xl border border-bg-border bg-bg-secondary px-3 text-[13px] text-txt-body focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/** Category, (type), posted within and a structured salary range for a Discover list. */
export function JobFilterBar({
  id,
  value,
  onChange,
  showType = false,
  showLanguages = false,
}: {
  id: string
  value: JobFilterInput
  onChange: (next: JobFilterInput) => void
  showType?: boolean
  /** Hyrr jobs only: web providers send no language data. */
  showLanguages?: boolean
}) {
  const categories = useJobCategories()
  const [salaryOpen, setSalaryOpen] = useState(false)
  const [salary, setSalary] = useState<SalaryRangeValue>(value.salary ?? emptySalaryRange("USD"))
  const [errors, setErrors] = useState<FieldErrors>({})
  const salaryOn = !!value.salary && (value.salary.min != null || value.salary.max != null)
  const active =
    !!value.categoryId || !!value.type || !!value.postedWithin || salaryOn || !!value.remote

  const applySalary = () => {
    const found = validate(salaryFilterSchema, salary)
    setErrors(found)
    if (Object.keys(found).length) return
    onChange({ ...value, salary: salary.min == null && salary.max == null ? null : salary })
    setSalaryOpen(false)
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`${id}-filters`}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-category`} className="sr-only">
          Category
        </label>
        <select
          id={`${id}-category`}
          value={value.categoryId ?? ""}
          onChange={(e) => onChange({ ...value, categoryId: e.target.value || undefined })}
          className={selectClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {showType && (
          <>
            <label htmlFor={`${id}-type`} className="sr-only">
              Employment type
            </label>
            <select
              id={`${id}-type`}
              value={value.type ?? ""}
              onChange={(e) => onChange({ ...value, type: e.target.value || undefined })}
              className={selectClass}
            >
              <option value="">Any type</option>
              {WEB_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor={`${id}-posted`} className="sr-only">
          Posted within
        </label>
        <select
          id={`${id}-posted`}
          value={value.postedWithin ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              postedWithin: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className={selectClass}
        >
          <option value="">Any time</option>
          {POSTED_WITHIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant={salaryOn ? "primary" : "secondary"}
          aria-expanded={salaryOpen}
          aria-controls={`${id}-salary-panel`}
          onClick={() => setSalaryOpen((o) => !o)}
          className="gap-1"
        >
          {salaryOn ? "Salary filter on" : "Salary"}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
        {showLanguages && (
          <button
            type="button"
            aria-pressed={!!value.matchLanguages}
            onClick={() =>
              onChange({ ...value, matchLanguages: !value.matchLanguages || undefined })
            }
            title="Only jobs in a language from your profile"
            className={`h-9 rounded-xl border px-3 text-[13px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              value.matchLanguages
                ? "border-primary-border bg-primary-light text-primary"
                : "border-bg-border bg-bg-secondary text-txt-body hover:bg-bg-hover"
            }`}
          >
            Match my languages
          </button>
        )}
        {active && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setSalary(emptySalaryRange("USD"))
              setErrors({})
              // Language matching is a standing preference with its own toggle: keep it.
              onChange(value.matchLanguages ? { matchLanguages: true } : {})
            }}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </Button>
        )}
      </div>
      {salaryOpen && (
        <div
          id={`${id}-salary-panel`}
          className="flex flex-col gap-3 rounded-2xl border border-bg-border bg-bg-secondary p-4 sm:max-w-[520px]"
        >
          <SalaryRangeInput
            id={`${id}-salary`}
            label="Salary between"
            value={salary}
            errors={errors}
            onChange={(next) => {
              setSalary(next)
              setErrors({})
            }}
          />
          <div className="flex justify-end gap-2">
            {salaryOn && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSalary(emptySalaryRange("USD"))
                  onChange({ ...value, salary: null })
                  setSalaryOpen(false)
                }}
              >
                Remove
              </Button>
            )}
            <Button type="button" size="sm" onClick={applySalary}>
              Apply salary
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
