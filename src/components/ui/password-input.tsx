"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { inputClass } from "./field";

// Canvas · Sign-in: 44px field, show/hide eye inside, "Caps Lock is on"
// warning under it (announced politely), aria-describedby wired to both.
export function PasswordInput({
  id,
  className,
  describedBy,
  onCapsChange,
  ...input
}: Omit<ComponentProps<"input">, "type"> & {
  id: string;
  describedBy?: string;
  onCapsChange?: (on: boolean) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const capsId = `${id}-caps`;

  function readCaps(e: React.KeyboardEvent<HTMLInputElement>) {
    const on = e.getModifierState?.("CapsLock") ?? false;
    if (on !== caps) {
      setCaps(on);
      onCapsChange?.(on);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={[describedBy, caps ? capsId : null].filter(Boolean).join(" ") || undefined}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCaps(false)}
          className={cn(inputClass, "h-11 pr-11", className)}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-xs text-text-2 hover:bg-sunken hover:text-text"
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {caps && (
        <span id={capsId} role="status" className="flex items-center gap-1.5 text-[12.5px] font-medium text-warning dark:text-warning-ink">
          <TriangleAlert aria-hidden className="size-3.5" /> Caps Lock is on
        </span>
      )}
    </div>
  );
}
