import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import * as React from "react"
import { cn } from "../../lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[#0B0C12]/35 backdrop-blur-[10px] backdrop-saturate-150 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * `variant="sheet"`: the same dialog as a full-height panel sliding in from the right — used for
 * detail views (candidate, application, job) so all three apps open details the same way.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { variant?: "center" | "sheet" }
>(({ className, children, variant = "center", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        variant === "sheet" ? "items-stretch justify-end" : "items-center justify-center p-4"
      )}
    >
      <DialogPrimitive.Content asChild ref={ref} {...props}>
        <motion.div
          initial={
            variant === "sheet"
              ? { opacity: 0, x: 48 }
              : { opacity: 0, scale: 0.965, y: 10, filter: "blur(6px)" }
          }
          animate={
            variant === "sheet"
              ? { opacity: 1, x: 0 }
              : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
          }
          exit={
            variant === "sheet"
              ? { opacity: 0, x: 32 }
              : { opacity: 0, scale: 0.98, y: 6, filter: "blur(4px)" }
          }
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative w-full overflow-hidden border border-bg-border bg-bg-secondary shadow-floating focus:outline-none z-50",
            variant === "sheet"
              ? "h-full max-w-[640px] rounded-l-[24px] border-y-0 border-r-0 p-6"
              : "max-w-lg p-6 rounded-card",
            className
          )}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-5 top-5 rounded-full p-1 text-txt-caption hover:bg-bg-hover hover:text-txt-heading hover:rotate-90 transition-[color,background-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 shrink-0">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </motion.div>
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 border-t border-bg-border/30 pt-4 mt-6 gap-2 sm:gap-0",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-section font-semibold text-txt-heading leading-tight tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body text-txt-body mt-2 leading-relaxed", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
