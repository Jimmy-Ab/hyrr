import * as React from "react"
import { cn } from "../../lib/utils"
import {
  CURRENCIES,
  CURRENCY_NAME,
  formatAmount,
  MONTH_NAMES,
  monthOf,
  parseAmount,
  SALARY_PERIOD_LABEL,
  SALARY_PERIODS,
  thisYear,
  toMonth,
  type Currency,
  type FieldErrors,
  type SalaryPeriod,
  type SalaryRangeValue,
} from "../../lib/validation"

/**
 * Structured form inputs (salary range, month range, year range) with inline errors.
 * Errors are keyed by the value's own field names (`min`, `max`, `currency`, `startDate`, …);
 * use `scopeErrors(errors, "salary")` to pass a nested slice. See the hyrr-validation skill.
 */

export const fieldCls =
  "h-11 w-full rounded-input border bg-bg-secondary px-3.5 text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-60"
const okCls = "border-bg-border focus:border-primary/40 focus:ring-primary/15"
const badCls = "border-sec-red/70 focus:border-sec-red focus:ring-sec-red/15"
export const inputStateCls = (error?: string) => (error ? badCls : okCls)

/** Small error line under a field; give the field `aria-describedby={id}` + `aria-invalid`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 text-[12px] font-medium text-sec-red">
      {message}
    </p>
  )
}

/** Field label + control + error, wired for screen readers. */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-txt-heading">
        {label}
        {required && <span className="text-sec-red"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11.5px] text-txt-caption">{hint}</p>}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

/** Props that link a control to its FormField error. */
export const describedBy = (id: string, error?: string) => ({
  "aria-invalid": !!error || undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
})

// ─── Salary range ─────────────────────────────────────────────────────────────

/**
 * Currency + minimum – maximum + period. Amounts are typed as numbers and shown with thousands
 * separators; the "–" between them is part of the layout, never typed. "Clear" empties the range.
 */
export function SalaryRangeInput({
  id,
  value,
  onChange,
  errors = {},
  label = "Salary range",
  required,
  disabled,
  stacked,
}: {
  id: string
  /** Narrow containers: currency on its own row, then min – max. */
  stacked?: boolean
  value: SalaryRangeValue
  onChange: (next: SalaryRangeValue) => void
  errors?: FieldErrors
  label?: string
  required?: boolean
  disabled?: boolean
}) {
  // Local text so the user can type freely ("120,0"); committed as a number on every change.
  const [minText, setMinText] = React.useState(formatAmount(value.min))
  const [maxText, setMaxText] = React.useState(formatAmount(value.max))
  React.useEffect(() => setMinText(formatAmount(value.min)), [value.min])
  React.useEffect(() => setMaxText(formatAmount(value.max)), [value.max])

  const set = (patch: Partial<SalaryRangeValue>) => onChange({ ...value, ...patch })
  const amountChange = (key: "min" | "max", setText: (t: string) => void) => (text: string) => {
    setText(text)
    set({ [key]: parseAmount(text) } as Partial<SalaryRangeValue>)
  }
  const firstError = errors.currency || errors.min || errors.max || errors.period
  const hasValue = value.min != null || value.max != null

  return (
    <fieldset className="min-w-0" aria-describedby={firstError ? `${id}-error` : undefined}>
      <legend className="mb-1.5 flex w-full items-center justify-between text-[12px] font-semibold text-txt-heading">
        <span>
          {label}
          {required && <span className="text-sec-red"> *</span>}
        </span>
        {hasValue && !disabled && (
          <button
            type="button"
            onClick={() => onChange({ ...value, min: null, max: null })}
            className="text-[11.5px] font-medium text-txt-caption hover:text-txt-heading cursor-pointer"
          >
            Clear
          </button>
        )}
      </legend>
      <div
        className={cn(
          "grid items-center gap-2",
          stacked
            ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
            : "grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto_minmax(0,1fr)] max-sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
        )}
      >
        <select
          id={`${id}-currency`}
          aria-label="Currency"
          value={value.currency}
          disabled={disabled}
          onChange={(e) => set({ currency: e.target.value as Currency })}
          className={cn(
            fieldCls,
            inputStateCls(errors.currency),
            "cursor-pointer",
            stacked ? "col-span-3" : "max-sm:col-span-3"
          )}
          aria-invalid={!!errors.currency || undefined}
        >
          <option value="">Currency</option>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} · {CURRENCY_NAME[c]}
            </option>
          ))}
        </select>
        <input
          id={id}
          aria-label="Minimum"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Min, e.g. 50,000"
          value={minText}
          disabled={disabled}
          onChange={(e) => amountChange("min", setMinText)(e.target.value)}
          onBlur={() => setMinText(formatAmount(value.min))}
          className={cn(fieldCls, inputStateCls(errors.min), "tabular-nums")}
          aria-invalid={!!errors.min || undefined}
        />
        <span aria-hidden="true" className="text-txt-caption">
          –
        </span>
        <input
          id={`${id}-max`}
          aria-label="Maximum"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Max, e.g. 70,000"
          value={maxText}
          disabled={disabled}
          onChange={(e) => amountChange("max", setMaxText)(e.target.value)}
          onBlur={() => setMaxText(formatAmount(value.max))}
          className={cn(fieldCls, inputStateCls(errors.max), "tabular-nums")}
          aria-invalid={!!errors.max || undefined}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pay period">
        {SALARY_PERIODS.map((p: SalaryPeriod) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={value.period === p}
            disabled={disabled}
            onClick={() => set({ period: p })}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors cursor-pointer",
              value.period === p
                ? "border-primary bg-primary-light text-primary"
                : "border-bg-border text-txt-body hover:bg-bg-hover"
            )}
          >
            {SALARY_PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      <FieldError id={`${id}-error`} message={firstError} />
    </fieldset>
  )
}

// ─── Month / year pickers ────────────────────────────────────────────────────

const yearOptions = (from: number, to: number) => {
  const out: number[] = []
  for (let y = to; y >= from; y--) out.push(y)
  return out
}

/** Month + year selects producing "YYYY-MM" (or "" while incomplete). */
export function MonthYearSelect({
  id,
  value,
  onChange,
  error,
  disabled,
  maxYear = thisYear(),
  label,
}: {
  id: string
  value: string | null
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  maxYear?: number
  label: string
}) {
  const parsed = monthOf(value)
  const [month, setMonth] = React.useState<number | null>(parsed.month)
  const [year, setYear] = React.useState<number | null>(parsed.year)
  React.useEffect(() => {
    const p = monthOf(value)
    if (p.month) setMonth(p.month)
    if (p.year) setYear(p.year)
    if (!value) {
      setMonth(null)
      setYear(null)
    }
  }, [value])
  const commit = (m: number | null, y: number | null) => onChange(toMonth(y, m))
  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        id={id}
        aria-label={`${label} month`}
        value={month ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const m = e.target.value ? Number(e.target.value) : null
          setMonth(m)
          commit(m, year)
        }}
        className={cn(fieldCls, inputStateCls(error), "cursor-pointer")}
        {...describedBy(id, error)}
      >
        <option value="">Month</option>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} year`}
        value={year ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const y = e.target.value ? Number(e.target.value) : null
          setYear(y)
          commit(month, y)
        }}
        className={cn(fieldCls, inputStateCls(error), "cursor-pointer")}
        aria-invalid={!!error || undefined}
      >
        <option value="">Year</option>
        {yearOptions(1950, maxYear).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Start month – end month, or "I currently work here". */
export function MonthRangeInput({
  id,
  startDate,
  endDate,
  current,
  onChange,
  errors = {},
}: {
  id: string
  startDate: string
  endDate: string | null
  current: boolean
  onChange: (next: { startDate: string; endDate: string | null; current: boolean }) => void
  errors?: FieldErrors
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField id={`${id}-start`} label="Start" required error={errors.startDate}>
        <MonthYearSelect
          id={`${id}-start`}
          label="Start"
          value={startDate}
          error={errors.startDate}
          onChange={(v) => onChange({ startDate: v, endDate, current })}
        />
      </FormField>
      <FormField id={`${id}-end`} label="End" required={!current} error={errors.endDate}>
        <MonthYearSelect
          id={`${id}-end`}
          label="End"
          value={current ? null : endDate}
          disabled={current}
          error={errors.endDate}
          onChange={(v) => onChange({ startDate, endDate: v, current })}
        />
        <label className="mt-2 inline-flex items-center gap-2 text-[12.5px] text-txt-body cursor-pointer">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) =>
              onChange({
                startDate,
                endDate: e.target.checked ? null : endDate,
                current: e.target.checked,
              })
            }
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          I currently work here
        </label>
      </FormField>
    </div>
  )
}

/** Start year – end year (end optional = still studying / expected later). */
export function YearRangeInput({
  id,
  startYear,
  endYear,
  onChange,
  errors = {},
}: {
  id: string
  startYear: number | null
  endYear: number | null
  onChange: (next: { startYear: number | null; endYear: number | null }) => void
  errors?: FieldErrors
}) {
  const sel = (key: "startYear" | "endYear", max: number, placeholder: string) => (
    <select
      id={`${id}-${key}`}
      value={(key === "startYear" ? startYear : endYear) ?? ""}
      onChange={(e) => {
        const v = e.target.value ? Number(e.target.value) : null
        onChange(key === "startYear" ? { startYear: v, endYear } : { startYear, endYear: v })
      }}
      className={cn(fieldCls, inputStateCls(errors[key]), "cursor-pointer")}
      {...describedBy(`${id}-${key}`, errors[key])}
    >
      <option value="">{placeholder}</option>
      {yearOptions(1950, max).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  )
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField id={`${id}-startYear`} label="Start year" required error={errors.startYear}>
        {sel("startYear", thisYear(), "Year")}
      </FormField>
      <FormField
        id={`${id}-endYear`}
        label="End year (or expected)"
        hint="Leave empty if you're still studying"
        error={errors.endYear}
      >
        {sel("endYear", thisYear() + 8, "Still studying")}
      </FormField>
    </div>
  )
}
