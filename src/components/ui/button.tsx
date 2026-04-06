import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/src/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-[background-color,color,box-shadow,transform,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-zinc-50 text-zinc-900 hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/10 active:scale-[0.98]",
        destructive:
          "bg-red-600 text-zinc-50 hover:bg-red-700 shadow-lg shadow-red-900/20 active:scale-[0.98]",
        outline:
          "border border-zinc-800 bg-transparent hover:bg-zinc-800/50 hover:text-zinc-50 backdrop-blur-sm active:scale-[0.98]",
        secondary:
          "bg-zinc-800/50 backdrop-blur-md text-zinc-50 hover:bg-zinc-800/80 border border-white/5 shadow-inner active:scale-[0.98]",
        ghost: "hover:bg-zinc-800/50 hover:text-zinc-50 active:scale-[0.98]",
        link: "text-zinc-50 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-14 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
