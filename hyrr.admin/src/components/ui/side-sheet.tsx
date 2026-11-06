import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "hyrr.shared"
import { X } from "lucide-react"
import * as React from "react"

/**
 * Right-hand detail drawer (users, companies, reports). Radix dialog underneath: focus trap,
 * Escape and outside click close it; the list behind stays in place.
 */
export function SideSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  header,
  footer,
  children,
  width = "max-w-[600px]",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: React.ReactNode
  /** Extra header content under the title (pills, avatar row). */
  header?: React.ReactNode
  /** Sticky action bar. */
  footer?: React.ReactNode
  children: React.ReactNode
  width?: string
}) {
  const reduce = useReducedMotion()
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0B0C12]/30 backdrop-blur-[6px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content asChild aria-describedby={undefined}>
          <motion.aside
            initial={reduce ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-bg-border bg-bg-secondary shadow-floating focus:outline-none",
              width
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-bg-border/70 px-6 pb-4 pt-5">
              <div className="min-w-0">
                <DialogPrimitive.Title className="truncate text-[18px] font-bold tracking-[-0.01em] text-txt-title">
                  {title}
                </DialogPrimitive.Title>
                {subtitle && <div className="mt-0.5 text-[13px] text-txt-body">{subtitle}</div>}
                {header && <div className="mt-3 flex flex-wrap items-center gap-2">{header}</div>}
              </div>
              <DialogPrimitive.Close
                className="shrink-0 cursor-pointer rounded-full p-1.5 text-txt-caption transition-[color,background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:rotate-90 hover:bg-bg-hover hover:text-txt-heading focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5" data-lenis-prevent>
              {children}
            </div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-bg-border/70 bg-bg-secondary px-6 py-4">
                {footer}
              </div>
            )}
          </motion.aside>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Titled block inside a sheet. */
export function SheetSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-txt-caption">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Two-column label/value list. */
export function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 rounded-2xl border border-bg-border/70 bg-bg-primary/50 p-4 text-[13px]">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-txt-caption">{k}</dt>
          <dd className="min-w-0 break-words font-medium text-txt-heading">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}
