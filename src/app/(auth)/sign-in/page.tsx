import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { getBrand, isConsoleRequest } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Canvas · Sign-in. The brand side comes from (auth)/layout.tsx; the host and
// ?next= are request data, so this part streams in behind Suspense.
export default function SignInPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<span aria-hidden className="block h-72 animate-pulse rounded-md bg-skel" />}>
      <SignIn searchParams={searchParams} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: Props) {
  const consoleRequest = await isConsoleRequest();
  const params = await searchParams;

  if (!consoleRequest) {
    const brand = await getBrand();
    if (!brand) {
      return (
        <Alert tone="warning" title="This address is not linked to an organisation.">
          Check the link you were given.
        </Alert>
      );
    }
    if (brand.status === "suspended") {
      return (
        <>
          <h1 className="text-page">Sign in</h1>
          <Alert tone="info" title="This account is paused at the moment.">
            Contact AssetNXG support at <a href="mailto:support@assetnxg.app">support@assetnxg.app</a>.
          </Alert>
        </>
      );
    }
  }

  const next = safeNextPath(params.next, consoleRequest ? "/console" : "/admin");

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-page">{consoleRequest ? "Platform sign in" : "Sign in"}</h1>
        <p className="text-small text-text-2">
          {consoleRequest ? "For the AssetNXG team." : "Use your institute email."}
        </p>
      </div>
      {params.reset === "done" && (
        <Alert tone="success" title="Password changed.">
          Sign in with your new password.
        </Alert>
      )}
      <SignInForm next={next} />
    </>
  );
}
