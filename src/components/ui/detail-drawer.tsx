"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";

// Canvas · Patterns › Drawer and dialog › Detail drawer.
// - Quick look and quick actions on a row without losing the list.
// - ≥1024px: right edge, under the app header, NOT modal (no scrim; the list
//   stays usable, clicking another row swaps the content).
// - <1024px: modal with a scrim, up to 560 wide; <640px: full screen.
// - Esc or × closes; focus goes back to where it was (the row).
// Widths: 480 narrow (vendor, room), 640 default, 960 wide (side by side).

export type DrawerWidth = 480 | 640 | 960;

const WIDTH: Record<DrawerWidth, string> = {
  480: "lg:w-[480px]",
  640: "lg:w-[640px]",
  960: "lg:w-[960px]",
};

export function DetailDrawer({
  open,
  onOpenChange,
  width = 640,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: DrawerWidth;
  /** DrawerHeader, DrawerBody, DrawerFooter. */
  children: ReactNode;
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const returnTo = useRef<HTMLElement | null>(null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={!desktop}>
      <DialogPrimitive.Portal>
        {!desktop && (
          <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-scrim) bg-scrim duration-(--dur-3) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        )}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            returnTo.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnTo.current?.focus();
          }}
          // On desktop the list stays usable: clicking outside doesn't close.
          onInteractOutside={(e) => {
            if (desktop) e.preventDefault();
          }}
          className={cn(
            "fixed right-0 bottom-0 flex flex-col border-l border-border bg-surface text-text shadow-3 outline-none",
            "z-(--z-drawer) max-lg:z-(--z-dialog)",
            // Phones: full screen. Tablets: up to 560. Desktop: chosen width, under the header.
            "top-0 w-full sm:w-[min(560px,100vw)] lg:top-14",
            WIDTH[width],
            "lg:max-w-[calc(100vw-64px)]",
            "duration-(--dur-3) data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-6 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-6 data-closed:duration-[190ms]",
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** ID, title, status chips and the main actions. Never scrolls. */
export function DrawerHeader({
  id,
  title,
  chips,
  actions,
  tools,
}: {
  /** The record number (WO-PM-2026-0042), in mono above the title. */
  id?: string;
  title: string;
  chips?: ReactNode;
  /** Primary and secondary buttons. */
  actions?: ReactNode;
  /** Small icon buttons beside Close (open as full page, more). */
  tools?: ReactNode;
}) {
  return (
    <div className="flex flex-none flex-col gap-3 border-b border-border px-6 pt-4 pb-4 max-sm:px-4">
      <div className="flex min-h-7 items-center justify-between gap-2">
        {id ? <span className="id text-text-2">{id}</span> : <span />}
        <span className="flex items-center gap-0.5">
          {tools}
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X aria-hidden />
            </Button>
          </DialogPrimitive.Close>
        </span>
      </div>
      <DialogPrimitive.Title className="text-section text-text">{title}</DialogPrimitive.Title>
      {chips && <div className="flex flex-wrap items-center gap-2">{chips}</div>}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** The scrolling part: DrawerSection blocks, 20px apart with a line between. */
export function DrawerBody({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <div aria-busy={busy || undefined} className="min-h-0 flex-1 overflow-y-auto px-6 max-sm:px-4">
      <div className="flex flex-col divide-y divide-border">{children}</div>
    </div>
  );
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 py-5">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children}
    </section>
  );
}

/** Label / value pairs (Location, Raised, Raised by…). */
export function DrawerFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2.5 text-[13.5px] max-sm:grid-cols-1 max-sm:gap-y-1">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-text-3 max-sm:pt-1.5">{item.label}</dt>
          <dd className="min-w-0 text-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Viewing: Previous / Next through the list (K / J). Editing: pass
 *  `children` instead (Cancel left, Save right). */
export function DrawerFooter({
  position,
  onPrevious,
  onNext,
  children,
}: {
  /** "3 of 12": where this row sits in the current list. */
  position?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  children?: ReactNode;
}) {
  const stepping = Boolean(onPrevious || onNext);

  // K / J step through rows, unless typing in a field.
  useEffect(() => {
    if (!stepping) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key.toLowerCase();
      if (key === "k" && onPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (key === "j" && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepping, onPrevious, onNext]);

  return (
    <div className="flex flex-none items-center gap-2 border-t border-border bg-surface px-6 py-3 max-sm:px-4">
      {children ?? (
        <>
          <Button variant="secondary" size="sm" disabled={!onPrevious} onClick={onPrevious} aria-keyshortcuts="K">
            <ChevronUp aria-hidden />
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={!onNext} onClick={onNext} aria-keyshortcuts="J">
            <ChevronDown aria-hidden />
            Next
          </Button>
          {position && <span className="text-small text-text-3 tabular-nums">{position}</span>}
          <span className="flex-1" />
          <span className="flex items-center gap-1 text-caption text-text-3 max-sm:hidden">
            <kbd className="kbd">K</kbd>
            <kbd className="kbd">J</kbd> · <kbd className="kbd">Esc</kbd>
          </span>
        </>
      )}
    </div>
  );
}
