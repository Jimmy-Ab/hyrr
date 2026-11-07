import * as React from "react"
import { errorMessage, isApiError } from "../../lib/api"
import {
  creditAdjustmentSchema,
  fieldErrorsOf,
  noteSchema,
  reasonSchema,
  validate,
  type FieldErrors,
} from "../../lib/validation"
import { FieldError } from "../forms/structured-fields"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { useToast } from "./toast"

const textareaCls =
  "w-full min-h-[96px] resize-y rounded-input border bg-bg-secondary px-3.5 py-2.5 text-[13px] text-txt-heading placeholder:text-txt-caption focus:outline-none focus:ring-2 transition-all duration-200"
const okCls = "border-bg-border focus:border-primary/40 focus:ring-primary/15"
const badCls = "border-sec-red/70 focus:border-sec-red focus:ring-sec-red/15"

export type ReasonMode = "reason" | "note" | "credits"

/**
 * Confirmation for destructive and monetary admin actions.
 * - "reason": a required reason (3..500), sent as `{ reason }`.
 * - "note": an optional note, sent as `{ note }`.
 * - "credits": a signed credit amount + reason, sent as `{ amount, reason }`.
 * Validation errors (zod, then the API's per-field errors) show under the field.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  mode = "reason",
  destructive = true,
  successTitle,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel: string
  mode?: ReasonMode
  destructive?: boolean
  /** Toast shown after the action succeeds. */
  successTitle: string
  onConfirm: (body: { reason?: string; note?: string; amount?: number }) => Promise<unknown>
}) {
  const { toast } = useToast()
  const [text, setText] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [busy, setBusy] = React.useState(false)
  const textRef = React.useRef<HTMLTextAreaElement>(null)
  const amountRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (open) {
      setText("")
      setAmount("")
      setErrors({})
    }
  }, [open])

  const textKey = mode === "note" ? "note" : "reason"

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const parsedAmount = amount.trim() === "" ? Number.NaN : Number(amount.replace(/[, ]/g, ""))
    const body =
      mode === "credits"
        ? { amount: parsedAmount, reason: text }
        : mode === "note"
          ? { note: text.trim() || undefined }
          : { reason: text }
    const schema =
      mode === "credits" ? creditAdjustmentSchema : mode === "note" ? noteSchema : reasonSchema
    const found = validate(schema, body)
    setErrors(found)
    if (Object.keys(found).length) {
      if (found.amount) amountRef.current?.focus()
      else textRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const clean =
        mode === "credits"
          ? { amount: parsedAmount, reason: text.trim() }
          : mode === "note"
            ? text.trim()
              ? { note: text.trim() }
              : {}
            : { reason: text.trim() }
      await onConfirm(clean)
      toast(successTitle, undefined, "success")
      onOpenChange(false)
    } catch (err: any) {
      const fields = fieldErrorsOf(err)
      if (Object.keys(fields).length) setErrors(fields)
      else if (isApiError(err) && err.errorCode === "INSUFFICIENT_CREDITS")
        setErrors({ amount: "The wallet doesn't have that many credits to remove" })
      else toast("Couldn't complete the action", errorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="mt-5 flex flex-col gap-4">
            {mode === "credits" && (
              <div>
                <label
                  htmlFor={`${id}-amount`}
                  className="mb-1.5 block text-[12px] font-semibold text-txt-heading"
                >
                  Credits <span className="text-sec-red">*</span>
                </label>
                <input
                  ref={amountRef}
                  id={`${id}-amount`}
                  inputMode="numeric"
                  placeholder="e.g. 50 or -20"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    if (errors.amount) setErrors(({ amount: _a, ...rest }) => rest)
                  }}
                  aria-invalid={!!errors.amount || undefined}
                  aria-describedby={errors.amount ? `${id}-amount-error` : `${id}-amount-hint`}
                  className={`h-11 w-full rounded-input border bg-bg-secondary px-3.5 text-[13px] tabular-nums text-txt-heading placeholder:text-txt-caption focus:outline-none focus:ring-2 transition-all duration-200 ${errors.amount ? badCls : okCls}`}
                />
                {!errors.amount && (
                  <p id={`${id}-amount-hint`} className="mt-1 text-[11.5px] text-txt-caption">
                    Positive adds credits, negative removes them.
                  </p>
                )}
                <FieldError id={`${id}-amount-error`} message={errors.amount} />
              </div>
            )}

            <div>
              <label
                htmlFor={`${id}-text`}
                className="mb-1.5 block text-[12px] font-semibold text-txt-heading"
              >
                {mode === "note" ? "Note (optional)" : "Reason"}
                {mode !== "note" && <span className="text-sec-red"> *</span>}
              </label>
              <textarea
                ref={textRef}
                id={`${id}-text`}
                value={text}
                maxLength={600}
                autoFocus={mode !== "credits"}
                placeholder={
                  mode === "note"
                    ? "Visible in the audit log"
                    : "Recorded in the audit log and shared with the account owner"
                }
                onChange={(e) => {
                  setText(e.target.value)
                  if (errors[textKey])
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next[textKey]
                      return next
                    })
                }}
                aria-invalid={!!errors[textKey] || undefined}
                aria-describedby={errors[textKey] ? `${id}-text-error` : undefined}
                className={`${textareaCls} ${errors[textKey] ? badCls : okCls}`}
              />
              <div className="flex items-start justify-between gap-2">
                <FieldError id={`${id}-text-error`} message={errors[textKey]} />
                <span className="ml-auto mt-1 text-[11px] tabular-nums text-txt-caption">
                  {text.trim().length}/500
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? "danger" : "primary"}
              size="sm"
              disabled={busy}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
