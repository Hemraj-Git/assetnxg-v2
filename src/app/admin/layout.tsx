import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import {
  AdminGate,
  BrandMark,
  BrandWide,
  HeaderAccount,
  ModuleNav,
  SidebarMe,
} from "@/components/shell/shell-parts";
import { SideNavSkeleton } from "@/components/shell/side-nav";

// The shell (sidebar, header, navigation) prerenders as the static frame;
// everything that depends on the host or session streams in behind its own
// Suspense boundary.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell
      brandWide={
        <Suspense fallback={<Skel className="h-8 w-40" />}>
          <BrandWide />
        </Suspense>
      }
      brandMark={
        <Suspense fallback={<Skel className="size-8" />}>
          <BrandMark />
        </Suspense>
      }
      nav={
        <Suspense fallback={<SideNavSkeleton />}>
          <ModuleNav />
        </Suspense>
      }
      me={
        <Suspense fallback={<Skel className="mx-2 my-1.5 h-7 w-36 rail:w-7" />}>
          <SidebarMe />
        </Suspense>
      }
      account={
        <Suspense fallback={<Skel className="size-7 rounded-full" />}>
          <HeaderAccount />
        </Suspense>
      }
    >
      <Suspense fallback={<PageSkeleton />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </AppShell>
  );
}

function Skel({ className }: { className: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-sm bg-skel ${className}`} />;
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4 px-(--gutter) pt-6">
      <Skel className="h-7 w-48" />
      <Skel className="h-4 w-80" />
      <Skel className="h-40 w-full max-w-3xl" />
    </div>
  );
}
