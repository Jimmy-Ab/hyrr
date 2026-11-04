import { Check, Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react"
import * as React from "react"
import { errorMessage } from "../../lib/api"
import type { TwoFactorSetup } from "../../store/types"
import { useJobStore } from "../../store/useJobStore"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { useToast } from "../ui/toast"

type Step =
  | { kind: "idle" }
  | { kind: "setup"; setup: TwoFactorSetup }
  | { kind: "codes"; codes: string[] }
  | { kind: "disable" }
  | { kind: "regenerate" }

const labelCls = "block text-[13px] font-semibold text-txt-heading"

/** Recovery codes with copy + download; shown exactly once after enable/regenerate. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { toast } = useToast()
  const [copied, setCopied] = React.useState(false)
  const text = codes.join("\n")

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast("Couldn't copy", "Select the codes and copy them manually.", "error")
    }
  }

  const download = () => {
    const blob = new Blob([`Hyrr recovery codes\n\n${text}\n`], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "hyrr-recovery-codes.txt"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-3 rounded-2xl border border-bg-border bg-bg-primary p-4">
      <div>
        <p className="text-[14px] font-semibold text-txt-heading">Save your recovery codes</p>
        <p className="mt-1 text-[12.5px] text-txt-caption">
          Each code works once if you lose access to your authenticator app. They won't be shown
          again.
        </p>
      </div>
      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-2 rounded-xl border border-bg-border bg-bg-secondary p-3 font-mono text-[13px] text-txt-heading"
      >
        {codes.map((c) => (
          <li key={c} className="select-all">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="secondary" onClick={download}>
          <Download className="h-4 w-4" /> Download
        </Button>
        <Button size="sm" onClick={onDone}>
          I've saved them
        </Button>
      </div>
    </div>
  )
}

/** Enable / disable two-factor authentication and manage recovery codes. */
export function TwoFactorSettings() {
  const enabled = useJobStore((s) => !!s.user?.twoFactorEnabled)
  const startTwoFactorSetup = useJobStore((s) => s.startTwoFactorSetup)
  const enableTwoFactor = useJobStore((s) => s.enableTwoFactor)
  const disableTwoFactor = useJobStore((s) => s.disableTwoFactor)
  const regenerateRecoveryCodes = useJobStore((s) => s.regenerateRecoveryCodes)
  const { toast } = useToast()

  const [step, setStep] = React.useState<Step>({ kind: "idle" })
  const [code, setCode] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const id = React.useId()

  const reset = () => {
    setStep({ kind: "idle" })
    setCode("")
    setPassword("")
  }

  const run = async (fn: () => Promise<void>, failTitle: string) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast(failTitle, errorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  const onStart = () =>
    run(async () => {
      const setup = await startTwoFactorSetup()
      setCode("")
      setStep({ kind: "setup", setup })
    }, "Couldn't start setup")

  const onEnable = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) {
      toast("Enter the 6-digit code", "Use the code shown in your authenticator app.", "error")
      return
    }
    void run(async () => {
      const codes = await enableTwoFactor(code)
      toast(
        "Two-factor authentication on",
        "Your account now asks for a code at sign-in.",
        "success"
      )
      setCode("")
      setStep({ kind: "codes", codes })
    }, "Couldn't enable two-factor")
  }

  const onDisable = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    void run(async () => {
      await disableTwoFactor(code, password || undefined)
      toast("Two-factor authentication off", "Sign-in only needs your password now.", "success")
      reset()
    }, "Couldn't disable two-factor")
  }

  const onRegenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    void run(async () => {
      const codes = await regenerateRecoveryCodes(code)
      toast("New recovery codes", "Your old recovery codes no longer work.", "success")
      setCode("")
      setStep({ kind: "codes", codes })
    }, "Couldn't create new codes")
  }

  const codeField = (label: string, hint: string, allowRecovery: boolean) => (
    <div className="space-y-1.5">
      <label htmlFor={`${id}-code`} className={labelCls}>
        {label}
      </label>
      <Input
        id={`${id}-code`}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode={allowRecovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        maxLength={allowRecovery ? 32 : 6}
        placeholder={allowRecovery ? "123456 or recovery code" : "123456"}
        className="max-w-xs font-mono tracking-widest"
        autoFocus
      />
      <p className="text-[12px] text-txt-caption">{hint}</p>
    </div>
  )

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={`${id}-title`}
            className="flex items-center gap-2 text-[15px] font-semibold text-txt-heading"
          >
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
            Two-factor authentication
            <Badge variant={enabled ? "success" : "secondary"}>{enabled ? "On" : "Off"}</Badge>
          </h3>
          <p className="mt-1 text-[13px] text-txt-caption">
            Require a code from an authenticator app (Google Authenticator, 1Password, Authy…) when
            you sign in with your password.
          </p>
        </div>
        {step.kind === "idle" &&
          (enabled ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setStep({ kind: "regenerate" })}>
                New recovery codes
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setStep({ kind: "disable" })}
                className="text-sec-red"
              >
                <ShieldOff className="h-4 w-4" /> Turn off
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={onStart} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Set up
            </Button>
          ))}
      </div>

      {step.kind === "setup" && (
        <form
          onSubmit={onEnable}
          className="space-y-4 rounded-2xl border border-bg-border bg-bg-primary p-4"
        >
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-txt-body">
            <li>Scan the QR code with your authenticator app.</li>
            <li>Enter the 6-digit code it shows to confirm.</li>
          </ol>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {step.setup.qrDataUrl ? (
              <img
                src={step.setup.qrDataUrl}
                alt="QR code for your authenticator app"
                width={168}
                height={168}
                className="h-[168px] w-[168px] shrink-0 rounded-xl border border-bg-border bg-white p-2"
              />
            ) : null}
            <div className="min-w-0 space-y-1.5">
              <p className="text-[12.5px] text-txt-caption">Can't scan? Enter this key manually:</p>
              <code className="block break-all rounded-lg bg-bg-secondary px-2 py-1.5 font-mono text-[13px] text-txt-heading select-all">
                {step.setup.secret}
              </code>
            </div>
          </div>
          {codeField("Verification code", "The code refreshes every 30 seconds.", false)}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Turn on
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step.kind === "codes" && <RecoveryCodes codes={step.codes} onDone={reset} />}

      {step.kind === "disable" && (
        <form
          onSubmit={onDisable}
          className="space-y-4 rounded-2xl border border-bg-border bg-bg-primary p-4"
        >
          {codeField(
            "Authenticator or recovery code",
            "Confirm it's you before turning two-factor off.",
            true
          )}
          <div className="space-y-1.5">
            <label htmlFor={`${id}-password`} className={labelCls}>
              Password
            </label>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-[12px] text-txt-caption">
              Leave empty if you only sign in with Google, GitHub or LinkedIn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" variant="danger" disabled={busy || !code.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Turn off two-factor
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step.kind === "regenerate" && (
        <form
          onSubmit={onRegenerate}
          className="space-y-4 rounded-2xl border border-bg-border bg-bg-primary p-4"
        >
          {codeField(
            "Authenticator code",
            "New codes replace all of your current recovery codes.",
            true
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={busy || !code.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Create new codes
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
