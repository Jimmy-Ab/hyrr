import { cva, type VariantProps } from "class-variance-authority"
import { motion, type HTMLMotionProps } from "framer-motion"
import * as React from "react"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none select-none cursor-pointer",
  {
    variants: {
      variant: {
        /* Solid violet — white text, always readable */
        primary:
          "bg-primary text-white shadow-button hover:bg-primary-hover active:scale-[0.98] border border-transparent",
        /* Outlined surface — strong dark heading text on white/light bg */
        secondary: [
          "bg-bg-secondary border border-bg-border",
          "text-[#23262F]" /* light mode: near-black */,
          "hover:bg-bg-hover hover:border-primary/30 hover:text-[#17181C]",
          "shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
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
          "bg-sec-red text-white hover:opacity-90 shadow-[0_4px_16px_rgba(217,48,48,0.22)] border border-transparent",
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
      whileHover={animateClick ? { scale: 1.015 } : undefined}
      whileTap={animateClick ? { scale: 0.985 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
