"use server";

import { z } from "zod";
import { maskEmail } from "@/lib/mask-email";
import { requestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { error: string | null; sentTo: string | null; sentAt: number | null; email: string };

// Sends Supabase's password-reset email. The answer is the same whether or not
// the email has an account, so the page can't be used to find out who has one.
// The link lands on /auth/confirm (this client's address), then /set-password.
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = z.email().safeParse(raw);
  if (!email.success) return { error: "Enter your email address.", sentTo: null, sentAt: null, email: raw };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=/set-password`,
  });

  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return { error: "Too many emails were sent just now. Wait a minute, then try again.", sentTo: null, sentAt: null, email: raw };
  }
  // Any other error is not shown, so as not to reveal whether the account exists.
  return { error: null, sentTo: maskEmail(email.data), sentAt: Date.now(), email: raw };
}
