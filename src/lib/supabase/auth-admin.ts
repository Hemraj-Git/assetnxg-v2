import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// The ONLY use of the secret key in the app: sending invite emails, which
// Supabase Auth allows only with it. It deliberately exposes no database
// client, so it can never be used to read or write client data (that always
// goes through the signed-in user's session and RLS).
//
// Callers must check the person is allowed to invite (requirePlatformAdmin, or
// a client Admin in a later phase) BEFORE calling.

function authAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set (server env only).");
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth.admin;
}

export type InviteResult = { ok: true } | { ok: false; reason: "exists" | "failed"; message: string };

/** Sends Supabase's invite email. `redirectTo` must be in Auth › URL
 *  Configuration › Redirect URLs (e.g. http://*.localhost:3000/**).
 *  `profile` fills the new account's name and phone (private.handle_new_user
 *  reads them; roles are never taken from it). Sending again to someone who
 *  hasn't accepted yet re-sends the invite. */
export async function sendInvite(
  email: string,
  redirectTo: string,
  profile?: { full_name?: string; phone?: string },
): Promise<InviteResult> {
  const { error } = await authAdmin().inviteUserByEmail(email, { redirectTo, data: profile });
  if (!error) return { ok: true };
  if (error.code === "email_exists" || /already.*registered/i.test(error.message)) {
    return { ok: false, reason: "exists", message: error.message };
  }
  return { ok: false, reason: "failed", message: error.message };
}
