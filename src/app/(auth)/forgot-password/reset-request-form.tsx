"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ChevronLeft, Mail } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { requestPasswordReset, type ResetState } from "./actions";

const initial: ResetState = { error: null, sentTo: null, sentAt: null, email: "" };
const RESEND_SECONDS = 60;

// Canvas · Sign-in › forgot / sent / expired. One form for "Forgot password"
// and "This link has expired"; after sending, the "Check your email" state
// with a resend countdown.
export function ResetRequestForm({
  heading,
  intro,
  icon,
  submitLabel,
}: {
  heading: string;
  intro: string;
  icon?: React.ReactNode;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  // Clock for the resend countdown. 0 until the first tick (never read the
  // clock while rendering: Next.js prerenders this page).
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!state.sentAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state.sentAt]);

  const seconds = state.sentAt
    ? Math.min(RESEND_SECONDS, Math.max(0, RESEND_SECONDS - Math.floor((now - state.sentAt) / 1000)))
    : 0;

  if (state.sentTo) {
    return (
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="email" value={state.email} />
        <span aria-hidden className="flex size-11 items-center justify-center rounded-[10px] bg-info-tint text-info-ink">
          <Mail className="size-5" />
        </span>
        <div role="status" className="flex flex-col gap-1">
          <h1 className="text-page">Check your email</h1>
          <p className="text-small text-text-2">
            If <b className="font-semibold text-text">{state.sentTo}</b> has an account, a reset link is on its way.
            Check spam if you don&apos;t see it.
          </p>
        </div>
        <Button type="submit" variant="secondary" size="lg" className="h-11 w-full" disabled={seconds > 0} loading={pending}>
          {seconds > 0
            ? `Send again in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
            : "Send again"}
        </Button>
        <Link href="/sign-in" className="text-small">
          Back to sign in
        </Link>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Link href="/sign-in" className="flex items-center gap-1 text-small">
        <ChevronLeft aria-hidden className="size-3.5" /> Back to sign in
      </Link>
      {icon}
      <div className="flex flex-col gap-1">
        <h1 className="text-page">{heading}</h1>
        <p className="text-small text-text-2">{intro}</p>
      </div>
      {state.error && <Alert tone="danger" id="reset-error" title={state.error} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] leading-[18px] font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          aria-invalid={!!state.error || undefined}
          aria-describedby={state.error ? "reset-error" : undefined}
          className={`${inputClass} h-11`}
        />
      </div>
      <Button type="submit" size="lg" className="h-11 w-full" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
