"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Circle } from "lucide-react";
import { cn } from "cn";
import { passwordChecks } from "@/lib/password-rules";
import { PasswordInput } from "./password-input";

// Canvas · Sign-in › set password: new password with a live checklist (green
// tick per rule, announced politely), then "Type it again" with a match check.
// The Server Action enforces the same rules (src/lib/password-rules.ts).
export function NewPasswordFields({
  email,
  name,
  idPrefix = "new",
}: {
  email?: string | null;
  name?: string | null;
  idPrefix?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const checks = passwordChecks(password, { email, name });
  const mismatch = confirm.length > 0 && confirm !== password;
  const listId = `${idPrefix}-rules`;
  const mismatchId = `${idPrefix}-mismatch`;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-password`} className="text-[13px] leading-[18px] font-medium">
          New password
        </label>
        <PasswordInput
          id={`${idPrefix}-password`}
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          describedBy={listId}
        />
        <ul id={listId} aria-label="Password requirements" aria-live="polite" className="mt-1 flex flex-col gap-1.5 text-cell">
          {checks.map((c) => (
            <li key={c.id} className={cn("flex items-center gap-2", c.ok ? "text-success dark:text-success-ink" : "text-text-2")}>
              {c.ok ? <CircleCheck aria-hidden className="size-4" /> : <Circle aria-hidden className="size-4" />}
              {c.label}
              <span className="sr-only">{c.ok ? " — done" : " — not yet"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-confirm`} className="text-[13px] leading-[18px] font-medium">
          Type it again
        </label>
        <PasswordInput
          id={`${idPrefix}-confirm`}
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch || undefined}
          describedBy={mismatch ? mismatchId : undefined}
        />
        {mismatch && (
          <span id={mismatchId} className="flex items-center gap-1 text-xs leading-4 font-medium text-danger dark:text-danger-ink">
            <CircleAlert aria-hidden className="size-3.5" /> The two passwords don&apos;t match yet.
          </span>
        )}
      </div>
    </>
  );
}
