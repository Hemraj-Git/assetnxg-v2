"use client";

import { useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalPreference } from "@/lib/use-local-preference";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Breadcrumbs } from "./breadcrumbs";
import { ShellNavContext } from "./shell-context";

const COLLAPSE_KEY = "assetnxg-sidebar-collapsed";

type Slots = {
  /** Client logo, wide (expanded sidebar and phone menu). */
  brandWide: ReactNode;
  /** Client logo mark (icon rail). */
  brandMark: ReactNode;
  /** Navigation for this client's modules (sidebar and phone sheet). */
  nav: ReactNode;
  /** Signed-in person, sidebar footer. */
  me: ReactNode;
  /** Account menu, header right. */
  account: ReactNode;
  children: ReactNode;
};

// Canvas · App shell.
//   ≥1280px   sidebar 248px, can be collapsed to the rail
//   1024–1279 icon rail 64px
//   <1024px   sidebar becomes a sheet behind the menu button
export function AppShell({ brandWide, brandMark, nav, me, account, children }: Slots) {
  // Remembered per device; expanded on the server and until storage is read.
  const [collapsedFlag, setCollapsedFlag] = useLocalPreference(
    COLLAPSE_KEY,
    (raw) => (raw === "1" ? "1" : "0"),
    "0",
  );
  const collapsed = collapsedFlag === "1";
  const [navOpen, setNavOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsedFlag(collapsed ? "0" : "1");
  }

  return (
    <ShellNavContext value={{ closeNav: () => setNavOpen(false) }}>
    <div className="relative flex h-dvh min-h-[560px] overflow-hidden bg-bg">
      <a
        href="#main"
        className="absolute top-2 left-2 z-100 -translate-y-[200%] rounded-sm bg-primary px-3 py-2 text-on-primary no-underline focus:translate-y-0"
      >
        Skip to content
      </a>

      <aside
        data-sidebar="desktop"
        data-collapsed={collapsed}
        aria-label="Main navigation"
        className="z-(--z-sidebar) hidden w-(--sidebar-w) flex-none flex-col border-r border-border bg-surface transition-[width] duration-(--dur-3) ease-standard lg:flex rail:w-(--rail-w)"
      >
        <div className="flex h-[72px] flex-none items-center border-b border-border px-4 rail:justify-center rail:px-0">
          <div className="min-w-0 rail:hidden">{brandWide}</div>
          <div className="hidden rail:flex">{brandMark}</div>
        </div>
        {nav}
        <SidebarFoot me={me} />
      </aside>

      {/* Phone and tablet: the same navigation in a sheet. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          className="w-[min(300px,86vw)] max-w-none gap-0 p-0 sm:max-w-none lg:hidden"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-[72px] flex-none items-center border-b border-border pr-12 pl-4">
            {brandWide}
          </div>
          {nav}
          <SidebarFoot me={me} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-(--z-header) flex h-14 flex-none items-center gap-2 border-b border-border bg-surface pr-(--gutter) pl-4 max-md:h-13 max-md:gap-1 max-md:px-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu aria-hidden className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden xl:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-5" />
            ) : (
              <PanelLeftClose aria-hidden className="size-5" />
            )}
          </Button>
          <Breadcrumbs />
          <span className="flex-1" />
          {account}
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-auto outline-none">
          {children}
        </main>
      </div>
    </div>
    </ShellNavContext>
  );
}

function SidebarFoot({ me }: { me: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-1 border-t border-border px-3 pt-2 pb-3">
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-[11.5px] text-text-3 rail:justify-center rail:px-0"
        title="Powered by AssetNXG"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="flex-none">
          <rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="5" y="5" width="8" height="8" rx="1.5" fill="currentColor" opacity=".55" />
        </svg>
        <span className="rail:sr-only">
          Powered by <b className="font-semibold">AssetNXG</b>
        </span>
      </div>
      {me}
    </div>
  );
}
