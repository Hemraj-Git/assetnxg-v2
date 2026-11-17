"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next-path";

export type SignInState = { error: string | null; email: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await createClient({ writeCookies: true });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Same words for a wrong email or a wrong password: don't reveal which
    // accounts exist.
    const message =
      error.code === "invalid_credentials"
        ? "The email or password is not right."
        : error.code === "email_not_confirmed"
          ? "Open the invite email and set your password first."
          : "We could not sign you in. Try again in a moment.";
    return { error: message, email };
  }

  // redirect() throws, so it must stay outside any try/catch.
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient({ writeCookies: true });
  await supabase.auth.signOut();
  redirect("/sign-in");
}
