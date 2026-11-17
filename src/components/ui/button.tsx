import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Canvas · Controls: 32px default, 6px radius, 13px medium label, 16px icons.
// Variant names stay shadcn-compatible (other generated components use them):
//   default = Primary, secondary/outline = Secondary, ghost, destructive = Danger, link.
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm border border-transparent",
    "text-[13px] leading-none font-medium whitespace-nowrap select-none",
    "transition-[background-color,border-color,color] duration-(--dur-1) ease-standard",
    "disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken disabled:text-text-3",
    "aria-invalid:border-danger",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed",
        secondary:
          "border-border-strong bg-surface text-text hover:bg-sunken active:border-primary active:bg-primary-weak aria-expanded:bg-sunken",
        outline:
          "border-border-strong bg-surface text-text hover:bg-sunken active:border-primary active:bg-primary-weak aria-expanded:bg-sunken",
        ghost:
          "bg-transparent text-text-2 hover:bg-sunken hover:text-text active:bg-primary-weak active:text-primary-ink aria-expanded:bg-sunken aria-expanded:text-text disabled:border-transparent disabled:bg-transparent",
        destructive:
          "bg-danger-solid text-white hover:bg-danger-hover active:bg-danger-pressed",
        link: "h-auto border-0 px-0 text-primary-ink underline underline-offset-2 hover:no-underline",
      },
      size: {
        default: "h-8 px-3",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 px-2.5 text-[12.5px]",
        lg: "h-10 px-4 text-sm",
        icon: "size-8 p-0",
        "icon-xs": "size-6 p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 p-0",
        "icon-lg": "size-10 p-0 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, keeps the width, and blocks clicks. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(
        buttonVariants({ variant, size }),
        loading && "pointer-events-none text-transparent!",
        className
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {children}
          {loading && (
            <span
              aria-hidden
              className={cn(
                "absolute size-3.5 animate-spin rounded-full border-[1.5px]",
                variant === "default" || variant === "destructive"
                  ? "border-white/90 border-b-white/25 border-l-white/25"
                  : "border-text-2 border-b-border border-l-border"
              )}
            />
          )}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
