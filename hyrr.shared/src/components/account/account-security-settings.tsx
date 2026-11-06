import { Download, Eye, EyeOff, Loader2, Lock, Trash2 } from "lucide-react"
import * as React from "react"
import { errorMessage, isApiError } from "../../lib/api"
import { useJobStore } from "../../store/useJobStore"
import { FieldError } from "../forms/structured-fields"
import { Button } from "../ui/button"
import { ConfirmDialog } from "../ui/confirm-dialog"
import { Input } from "../ui/input"
import { useToast } from "../ui/toast"
import { TwoFactorSettings } from "./two-factor-settings"

const labelCls = "block text-[13px] font-semibold text-txt-heading"
const sectionCls = "space-y-4 border-t border-bg-border/60 pt-6 first:border-t-0 first:pt-0"

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  placeholder?: string
}) {
  const [show, setShow] = React.useState(false)
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative max-w-sm">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-txt-caption hover:text-txt-heading"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export interface AccountSecuritySettingsProps {
  /** Text in the delete-account confirmation (defaults to a generic description). */
  deleteDescription?: string
}

/**
 * Change password, two-factor authentication, data export and account deletion.
 * Rendered by the Settings page of both apps.
 */
export function AccountSecuritySettings({ deleteDescription }: AccountSecuritySettingsProps) {
  const changePassword = useJobStore((s) => s.changePassword)
  const exportMyData = useJobStore((s) => s.exportMyData)
  const deleteAccount = useJobStore((s) => s.deleteAccount)
  const { toast } = useToast()
  const id = React.useId()

  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" })
  const [pwBusy, setPwBusy] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePassword, setDeletePassword] = React.useState("")

  const [pwErrors, setPwErrors] = React.useState<{
    current?: string
    next?: string
    confirm?: string
  }>({})

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const found: { current?: string; next?: string; confirm?: string } = {}
    if (!pw.current) found.current = "Enter your current password"
    if (pw.next.length < 8) found.next = "Use at least 8 characters"
    else if (pw.next.length > 128) found.next = "At most 128 characters"
    else if (pw.next === pw.current) found.next = "Choose a password different from the current one"
    if (pw.next && pw.confirm !== pw.next) found.confirm = "Passwords don't match"
    setPwErrors(found)
    if (Object.keys(found).length) return
    setPwBusy(true)
    try {
      await changePassword(pw.current, pw.next)
      toast("Password changed", "Other devices have been signed out.", "success")
      setPw({ current: "", next: "", confirm: "" })
    } catch (err) {
      // A wrong current password is shown on that field; anything else as a toast.
      if (
        isApiError(err) &&
        (err.status === 401 || err.status === 400) &&
        /current/i.test(err.message)
      )
        setPwErrors({ current: err.message })
      else toast("Couldn't change password", errorMessage(err), "error")
    } finally {
      setPwBusy(false)
    }
  }

  const onExport = async () => {
    setExporting(true)
    try {
      await exportMyData()
      toast("Export ready", "Your data has been downloaded as a JSON file.", "success")
    } catch (err) {
      toast("Couldn't export your data", errorMessage(err), "error")
    } finally {
      setExporting(false)
    }
  }

  const onDelete = async () => {
    try {
      await deleteAccount(deletePassword || undefined)
      toast("Account deleted", "Your account and data have been removed.", "success")
    } catch (err) {
      toast("Couldn't delete account", errorMessage(err), "error")
      throw err
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby={`${id}-pw`} className={sectionCls}>
        <div>
          <h3
            id={`${id}-pw`}
            className="flex items-center gap-2 text-[15px] font-semibold text-txt-heading"
          >
            <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
            Password
          </h3>
          <p className="mt-1 text-[13px] text-txt-caption">
            Changing your password signs you out everywhere else.
          </p>
        </div>
        <form onSubmit={onChangePassword} className="space-y-4">
          <PasswordField
            id={`${id}-pw-current`}
            label="Current password"
            value={pw.current}
            onChange={(v) => setPw((p) => ({ ...p, current: v }))}
            autoComplete="current-password"
          />
          <FieldError id={`${id}-pw-current-error`} message={pwErrors.current} />
          <PasswordField
            id={`${id}-pw-new`}
            label="New password"
            value={pw.next}
            onChange={(v) => setPw((p) => ({ ...p, next: v }))}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
          />
          <FieldError id={`${id}-pw-new-error`} message={pwErrors.next} />
          <PasswordField
            id={`${id}-pw-confirm`}
            label="Confirm new password"
            value={pw.confirm}
            onChange={(v) => setPw((p) => ({ ...p, confirm: v }))}
            autoComplete="new-password"
          />
          <FieldError id={`${id}-pw-confirm-error`} message={pwErrors.confirm} />
          <Button type="submit" size="sm" disabled={pwBusy}>
            {pwBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </section>

      <div className={sectionCls}>
        <TwoFactorSettings />
      </div>

      <section aria-labelledby={`${id}-data`} className={sectionCls}>
        <div>
          <h3
            id={`${id}-data`}
            className="flex items-center gap-2 text-[15px] font-semibold text-txt-heading"
          >
            <Download className="h-4 w-4 text-primary" aria-hidden="true" />
            Your data
          </h3>
          <p className="mt-1 text-[13px] text-txt-caption">
            Download a copy of your profile, applications, messages and other data as JSON.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onExport} disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download my data
        </Button>
      </section>

      <section aria-labelledby={`${id}-danger`} className={sectionCls}>
        <div>
          <h3 id={`${id}-danger`} className="text-[15px] font-semibold text-sec-red">
            Delete account
          </h3>
          <p className="mt-1 text-[13px] text-txt-caption">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDeletePassword("")
            setDeleteOpen(true)
          }}
          className="border-sec-red/30 text-sec-red hover:bg-sec-red/5"
        >
          <Trash2 className="h-4 w-4" /> Delete account
        </Button>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description={
          deleteDescription ??
          "This permanently deletes your profile and all data that belongs to your account. This cannot be undone."
        }
        confirmLabel="Delete account"
        onConfirm={onDelete}
      >
        <div className="mt-4 space-y-2">
          <label htmlFor={`${id}-delete-pw`} className={labelCls}>
            Confirm with your password
          </label>
          <Input
            id={`${id}-delete-pw`}
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Your password"
          />
          <p className="text-[12px] text-txt-caption">
            Signed up with Google, GitHub or LinkedIn and never set a password? Leave this empty.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  )
}
