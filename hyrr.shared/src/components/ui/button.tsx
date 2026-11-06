import { cva, type VariantProps } from "class-variance-authority"
import { motion, type HTMLMotionProps } from "framer-motion"
import * as React from "react"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-semibold tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none select-none cursor-pointer",
  {
    variants: {
      variant: {
        /* Solid violet — white text, always readable */
        primary:
          "btn-shine bg-gradient-to-b from-[#7a72ff] to-primary text-white shadow-button hover:from-[#7068ff] hover:to-primary-hover hover:-translate-y-px hover:shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_2px_4px_rgba(76,64,220,0.3),0_10px_24px_-8px_rgba(108,99,255,0.65)] border border-transparent",
        /* Outlined surface — strong dark heading text on white/light bg */
        secondary: [
          "bg-bg-secondary border border-bg-border",
          "text-[#23262F]" /* light mode: near-black */,
          "hover:bg-bg-hover hover:border-primary/30 hover:text-[#17181C]",
          "shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.12)]",
          /* dark mode: flip to bright text */
          "dark:text-[#E4E6EB] dark:hover:text-white dark:border-[#1E2028] dark:hover:border-[#2D2A5E]",
        ].join(" "),
        /* Ghost — medium-contrast body text, no border */
        ghost: [
          "bg-transparent border border-transparent",
          "text-[#505668] hover:bg-bg-hover hover:text-[#23262F]",
          "dark:text-[#9BA2AE] dark:hover:text-[#E4E6EB]",
        ].join(" "),
        /* Danger — red bg, always white text */
        danger:
          "btn-shine bg-sec-red text-white hover:brightness-105 hover:-translate-y-px shadow-[0_1px_2px_rgba(217,48,48,0.3),0_6px_16px_-6px_rgba(217,48,48,0.5)] border border-transparent",
      },
      size: {
        sm: "h-9 px-4 rounded-[14px] text-[12.5px] gap-1.5",
        md: "h-11 px-5 rounded-button text-[13.5px] gap-2",
        lg: "h-13 px-6 rounded-button text-[14px] gap-2.5",
        icon: "h-11 w-11 rounded-button",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onDrag" | "onDragStart" | "onDragEnd" | "style"
    >,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  animateClick?: boolean
}

const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & Omit<HTMLMotionProps<"button">, "ref" | "color" | "children">
>(({ className, variant, size, animateClick = true, ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      whileTap={animateClick ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})
Button.displayName = "Button"

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
