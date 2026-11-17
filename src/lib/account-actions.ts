"use server";

import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { isConsoleRequest } from "@/lib/auth";
import { passwordAcceptable } from "@/lib/password-rules";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Password Server Actions: set (after an invite or reset link) and change
// (from the account menu). Both re-check the rules from password-rules.ts;
// Supabase Auth checks its own policy and leaked passwords on top.
//
// Neither writes the session cookie: changing a password keeps the current
// session, and a cookie write that lands after the action (Supabase fires its
// auth events asynchronously) breaks Next.js's re-render of the page.

export type PasswordState = { error: string | null; success: string | null };

function readPair(formData: FormData) {
  return {
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  };
}

async function signedInPerson() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  return { supabase, email: profile?.email ?? null, name: profile?.full_name ?? null };
}

async function currentPasswordIsRight(email: string, password: string): Promise<boolean> {
  const verifier = createPlainClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) return false;
  await verifier.auth.signOut({ scope: "local" });
  return true;
}

function authError(code: string | undefined, message: string): string {
  if (code === "weak_password") return `Choose a stronger password. ${message}`;
  if (code === "same_password") return "Choose a password you haven't used before.";
  if (code === "reauthentication_needed") return "For your safety, sign out and sign in again, then change your password.";
  return "We could not save the password. Try again in a moment.";
}

/** After an invite or reset link (/auth/confirm has signed the person in). */
export async function setPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const { password, confirm } = readPair(formData);
  const person = await signedInPerson();
  if (!person) return { error: "This link has expired. Ask for a new one.", success: null };

  if (!passwordAcceptable(password, person)) return { error: "The password doesn't meet all the points listed.", success: null };
  if (password !== confirm) return { error: "The two passwords don't match.", success: null };

  const { error } = await person.supabase.auth.updateUser({ password });
  if (error) return { error: authError(error.code, error.message), success: null };

  redirect((await isConsoleRequest()) ? "/console" : "/admin");
}

/** From the account menu: needs the current password (v1 rule, 03 §11). */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const current = String(formData.get("current") ?? "");
  const { password, confirm } = readPair(formData);
  const person = await signedInPerson();
  if (!person?.email) return { error: "Your session has ended. Sign in again.", success: null };

  if (!current) return { error: "Enter your current password.", success: null };
  if (!passwordAcceptable(password, person)) return { error: "The new password doesn't meet all the points listed.", success: null };
  if (password !== confirm) return { error: "The two new passwords don't match.", success: null };
  if (password === current) return { error: "Choose a password different from your current one.", success: null };

  // Prove the current password with a throwaway client that stores nothing,
  // then end that extra session at once (scope "local" revokes only it).
  if (!(await currentPasswordIsRight(person.email, current))) {
    return { error: "Your current password is not right.", success: null };
  }

  const { error } = await person.supabase.auth.updateUser({ password });
  if (error) return { error: authError(error.code, error.message), success: null };
  return { error: null, success: "Password changed. Use it next time you sign in." };
}
