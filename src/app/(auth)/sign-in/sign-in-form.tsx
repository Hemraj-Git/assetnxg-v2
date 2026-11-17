"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn, type SignInState } from "./actions";

const initial: SignInState = { error: null, email: "" };

// Canvas · Sign-in › login: 44px fields, show password, Caps Lock warning,
// "Forgot password?" beside the label, error as an alert at the top.
export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  const errorId = "sign-in-error";

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.error && <Alert tone="danger" id={errorId} title={state.error} />}

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
          aria-describedby={state.error ? errorId : undefined}
          className={`${inputClass} h-11`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="text-[13px] leading-[18px] font-medium">
            Password
          </label>
          <Link href="/forgot-password" className="text-small">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.error || undefined}
          describedBy={state.error ? errorId : undefined}
        />
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
