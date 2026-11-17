import type { Metadata } from "next";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <ResetRequestForm
      heading="Reset your password"
      intro="Enter your institute email. If it has an account, we'll send a link to set a new password."
      submitLabel="Send reset link"
    />
  );
}
