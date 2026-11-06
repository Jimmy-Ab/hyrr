import { motion, type HTMLMotionProps } from "framer-motion"
import * as React from "react"
import { cn } from "../../lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean
}

// We typecast props to omit motion/React conflicts
const Card = React.forwardRef<
  HTMLDivElement,
  CardProps & Omit<HTMLMotionProps<"div">, "ref" | "color" | "children">
>(({ className, hoverEffect = false, ...props }, ref) => (
  <motion.div
    ref={ref}
    whileHover={hoverEffect ? { y: -3 } : undefined}
    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    className={cn(
      "spotlight rounded-card border border-bg-border/80 bg-bg-card text-txt-body shadow-card transition-[box-shadow,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
      hoverEffect &&
        "hover:shadow-card-hover hover:border-primary-border dark:hover:border-[#2d2a5e]",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-card-title font-semibold text-txt-heading leading-tight", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-caption text-txt-caption", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0 border-t border-bg-border/30 mt-4", className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
