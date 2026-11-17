"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

// Canvas · Drawer and dialog: "Discard your changes?" (sm 400, alertdialog,
// focus starts on the safe choice). Also the typed confirmation for deletes
// that can't be undone (docs/context/05-design.md, gap 5): the button stays
// off until the person types the record's name or number.

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel,
  tone = "danger",
  typeToConfirm,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** The safe choice; focus starts here ("Keep editing", "Cancel"). */
  cancelLabel?: string;
  /** Names the action: "Discard", "Delete room". */
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** When set, the person must type exactly this to enable the button. */
  typeToConfirm?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const ready = !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) return; // ignored while the request settles
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-(--z-scrim) bg-scrim duration-(--dur-3) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-(--z-dialog) flex w-[calc(100%-2rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-md border border-border bg-popover p-6 text-body shadow-3 duration-(--dur-3) outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-98 data-closed:animate-out data-closed:fade-out-0">
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-card">{title}</AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="text-small text-text-2">{description}</AlertDialog.Description>
            )}
          </div>

          {typeToConfirm && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={inputId} className="text-[13px] leading-[18px] font-medium">
                Type <span className="id">{typeToConfirm}</span> to confirm
              </label>
              <input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                className={inputClass}
              />
            </div>
          )}

          <div className="-mx-6 -mb-6 flex gap-2 rounded-b-md border-t border-border bg-raised px-6 py-3 *:max-sm:flex-1">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <span className="flex-1 max-sm:hidden" />
            <Button
              variant={tone === "danger" ? "destructive" : "default"}
              disabled={!ready}
              loading={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
