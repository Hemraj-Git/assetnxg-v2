import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password" };

// Reached from an invite or reset email via /auth/confirm, which has signed
// the person in. Canvas · Sign-in › set password.
export default function SetPasswordPage() {
  return (
    <Suspense fallback={<span aria-hidden className="block h-96 animate-pulse rounded-md bg-skel" />}>
      <SetPassword />
    </Suspense>
  );
}

async function SetPassword() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/link-expired");

  const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-page">Set your password</h1>
        {profile?.email && <p className="text-small text-text-2">For {profile.email}</p>}
      </div>
      <SetPasswordForm email={profile?.email ?? null} name={profile?.full_name ?? null} />
    </>
  );
}
