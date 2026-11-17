"use client"

import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-scrim duration-(--dur-2) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// Canvas · Drawer and dialog › Dialog: sm 400 · md 560 · lg 800. With a size,
// the dialog follows the full rules: max 85% of the screen height with the
// body scrolling and the footer staying put, and below 640px it becomes a
// bottom sheet (top corners rounded, 44px buttons).
const DIALOG_SIZE = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[800px]",
} as const

const SHEET_ON_PHONES =
  "max-h-[85dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[calc(100dvh-24px)] max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-lg max-sm:data-open:slide-in-from-bottom-10 max-sm:data-open:zoom-in-100 max-sm:[&_[data-slot=dialog-footer]_button]:h-11"

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  size?: keyof typeof DIALOG_SIZE
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-md border border-border bg-popover p-6 text-body text-popover-foreground shadow-3 duration-(--dur-3) outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-98 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-98",
          size && cn(DIALOG_SIZE[size], SHEET_ON_PHONES),
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // Cancel left, the action right, always (canvas). Stays in view
        // while a long body scrolls.
        "sticky -bottom-6 -mx-6 -mb-6 flex flex-row gap-2 rounded-b-md border-t bg-raised px-6 py-3 *:max-sm:flex-1 sm:justify-end sm:[&>:first-child:not(:only-child)]:mr-auto",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
