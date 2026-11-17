import type { Metadata } from "next";
import { Hourglass } from "lucide-react";
import { ResetRequestForm } from "../forgot-password/reset-request-form";

export const metadata: Metadata = { title: "Link expired" };

// Where /auth/confirm sends people whose invite or reset link has expired or
// was already used. A password-reset link also works for an invited person
// who never set a password, so one form covers both.
export default function LinkExpiredPage() {
  return (
    <ResetRequestForm
      heading="This link has expired"
      intro="Links in emails only work for a short time, and only once, for your safety. Ask for a new one below; nothing has changed on your account."
      submitLabel="Send a new link"
      icon={
        <span aria-hidden className="flex size-11 items-center justify-center rounded-[10px] bg-warning-tint text-warning-ink">
          <Hourglass className="size-5" />
        </span>
      }
    />
  );
}
