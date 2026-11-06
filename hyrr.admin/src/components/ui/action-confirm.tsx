import { ConfirmDialog, errorMessage, useToast } from "hyrr.shared"
import * as React from "react"

/** Non-destructive one-click action behind a confirm (verify, reactivate, send reset…). */
export function ActionConfirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  successTitle,
  destructive = false,
  run,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  successTitle: string
  destructive?: boolean
  run: () => Promise<unknown>
}) {
  const { toast } = useToast()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      onConfirm={async () => {
        try {
          await run()
          toast(successTitle, undefined, "success")
        } catch (err: any) {
          toast("Couldn't complete the action", errorMessage(err), "error")
          throw err
        }
      }}
    />
  )
}
