import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

// Landing point for links in Supabase Auth emails (invite, password reset).
// The email template sends people to {{ .RedirectTo }}&token_hash=…&type=…;
// we verify the one-time token on the server and set the session cookie.

const ALLOWED: readonly EmailOtpType[] = ["invite", "recovery", "email", "email_change", "signup", "magiclink"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNextPath(params.get("next"), "/admin");

  if (tokenHash && type && ALLOWED.includes(type)) {
    const supabase = await createClient({ writeCookies: true });
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  }

  redirect("/link-expired");
}
