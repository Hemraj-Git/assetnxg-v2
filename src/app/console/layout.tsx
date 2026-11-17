import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AccountMenu } from "@/components/shell/account-menu";
import { getPlatformAdmin, requirePlatformAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { template: "%s · AssetNXG Console", default: "AssetNXG Console" } };

// The super-admin console (console.assetnxg.app). AssetNXG-branded, separate
// from every client portal. Only platform admins get past the gate; they
// manage clients here and see no client data unless they turn on support
// access for a client.
export default function ConsoleLayout({ children }: LayoutProps<"/console">) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="z-(--z-header) flex h-14 flex-none items-center gap-4 border-b border-border bg-surface px-(--gutter)">
        <Link href="/console" className="flex items-center gap-2 text-text no-underline">
          <svg width="22" height="22" viewBox="0 0 14 14" aria-hidden="true">
            <rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <rect x="5" y="5" width="8" height="8" rx="1.5" fill="currentColor" opacity=".55" />
          </svg>
          <span className="text-[15px] font-semibold">AssetNXG</span>
          <span className="text-[13.5px] text-text-3">Console</span>
        </Link>
        <nav aria-label="Console" className="flex items-center gap-1">
          <Link href="/console" className="rounded-sm px-2 py-1 text-[13.5px] font-medium text-text-2 no-underline hover:bg-sunken hover:text-text">
            Clients
          </Link>
        </nav>
        <span className="flex-1" />
        <Suspense fallback={<span aria-hidden className="block size-7 animate-pulse rounded-full bg-skel" />}>
          <ConsoleAccount />
        </Suspense>
      </header>
      <main id="main" className="flex-1">
        <Suspense fallback={<ConsoleSkeleton />}>
          <ConsoleGate>{children}</ConsoleGate>
        </Suspense>
      </main>
    </div>
  );
}

async function ConsoleGate({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();
  return <>{children}</>;
}

async function ConsoleAccount() {
  const admin = await getPlatformAdmin();
  if (!admin) return null;
  return (
    <AccountMenu
      account={{
        name: admin.fullName ?? admin.email ?? "Platform admin",
        email: admin.email,
        roleLabel: "Platform admin",
        orgName: "AssetNXG Console",
      }}
    />
  );
}

function ConsoleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4 px-(--gutter) pt-6">
      <span aria-hidden className="block h-7 w-48 animate-pulse rounded-sm bg-skel" />
      <span aria-hidden className="block h-40 w-full max-w-5xl animate-pulse rounded-sm bg-skel" />
    </div>
  );
}
