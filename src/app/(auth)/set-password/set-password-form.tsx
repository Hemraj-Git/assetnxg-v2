"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NewPasswordFields } from "@/components/ui/new-password-fields";
import { setPassword, type PasswordState } from "@/lib/account-actions";

const initial: PasswordState = { error: null, success: null };

export function SetPasswordForm({ email, name }: { email: string | null; name: string | null }) {
  const [state, action, pending] = useActionState(setPassword, initial);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && <Alert tone="danger" title={state.error} />}
      <NewPasswordFields email={email} name={name} />
      <Button type="submit" size="lg" className="h-11 w-full" loading={pending}>
        Set password and sign in
      </Button>
    </form>
  );
}
