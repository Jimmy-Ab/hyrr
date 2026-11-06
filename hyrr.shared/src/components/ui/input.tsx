import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-input border border-bg-border bg-bg-secondary px-4 py-2 text-body text-txt-heading placeholder:text-txt-caption shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-[color-mix(in_srgb,var(--color-primary)_25%,var(--color-bg-border))] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12 focus-visible:border-primary/60 disabled:cursor-not-allowed disabled:bg-bg-primary disabled:text-txt-disabled transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] aria-[invalid=true]:border-sec-red/70 aria-[invalid=true]:focus-visible:ring-sec-red/12",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
