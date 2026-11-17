"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "cn";
import type { AppModule } from "@/lib/modules";
import { isActive, navForModules, type NavGroup } from "./nav-config";
import { useShellNav } from "./shell-context";

// Canvas · Sidebar. Expanded: grouped, collapsible group headings, 34px items.
// Rail (rail: variant): icons only, labels kept for screen readers, groups
// separated by a line.
//
// usePathname() suspends on routes whose address is only known at request
// time (Cache Components), so the active-state version sits in <Suspense>
// and the fallback is the same nav with nothing highlighted: the shell still
// prerenders and nothing shifts when the highlight arrives.
//
// `modules`: the client's switched-on modules; entries for the others are
// left out (the pages and the database refuse them too).
export function SideNav({ modules }: { modules: readonly AppModule[] }) {
  const { closeNav } = useShellNav();
  const groups = navForModules(modules);
  return (
    <Suspense fallback={<NavLinks groups={groups} pathname="" onNavigate={closeNav} />}>
      <ActiveNav groups={groups} onNavigate={closeNav} />
    </Suspense>
  );
}

function ActiveNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate: () => void }) {
  return <NavLinks groups={groups} pathname={usePathname()} onNavigate={onNavigate} />;
}

/** Placeholder rows while the client's modules load. */
export function SideNavSkeleton() {
  return (
    <div aria-hidden className="flex flex-1 flex-col gap-2 px-3 pt-5 rail:px-2.5">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="block h-[26px] animate-pulse rounded-sm bg-skel" />
      ))}
    </div>
  );
}

function NavLinks({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav
      aria-label="Main"
      className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-2 pb-4 rail:px-2.5"
    >
      {groups.map((group) => (
        <Group key={group.label} group={group} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function Group({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate: () => void;
}) {
  // Setup starts folded unless you are in it (canvas); the rest start open.
  const containsActive = group.items.some(
    (i) => isActive(i.href, pathname) || i.children?.some((c) => isActive(c.href, pathname)),
  );
  const [open, setOpen] = useState(group.label !== "Setup" || containsActive);
  const expanded = open || containsActive;
  const listId = `nav-group-${group.label.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-px pt-3 rail:mt-1 rail:border-t rail:border-border rail:pt-2 rail:first:mt-0 rail:first:border-t-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-full items-center justify-between px-2 text-[11.5px] font-semibold tracking-[.04em] text-text-3 uppercase rail:hidden"
      >
        <span>{group.label}</span>
        {expanded ? <ChevronDown aria-hidden className="size-3.5" /> : <ChevronRight aria-hidden className="size-3.5" />}
      </button>

      {/* In the rail every group shows: icons are the only way in. */}
      <ul id={listId} className={cn("flex flex-col gap-px", !expanded && "hidden rail:flex")}>
        {group.items.map((item) => {
          const Icon = item.icon;
          const onSelf = isActive(item.href, pathname);
          // A parent with views lights only on its own page; the view lights below.
          const childActive = item.children?.some((c) => isActive(c.href, pathname)) ?? false;
          const lit = onSelf && !childActive;

          return (
            <li key={item.href} className="flex flex-col gap-px">
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={lit ? "page" : undefined}
                title={item.label}
                className={cn(
                  "relative flex h-[34px] items-center gap-2.5 rounded-sm px-2 text-[13.5px] font-medium whitespace-nowrap text-text-2 no-underline",
                  "transition-colors duration-(--dur-1) hover:bg-sunken hover:text-text",
                  "rail:h-10 rail:justify-center rail:px-0",
                  lit && "bg-primary-weak text-primary-pressed hover:bg-primary-weak dark:text-info-ink",
                )}
              >
                <Icon aria-hidden className={cn("size-5 text-text-3", lit && "text-primary-ink")} />
                <span className="flex-1 truncate rail:sr-only">{item.label}</span>
              </Link>

              {/* Work order views always show under their parent (canvas). */}
              {item.children && (
                <ul className="flex flex-col gap-px rail:hidden">
                  {item.children.map((child) => {
                    const on = isActive(child.href, pathname);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={onNavigate}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "relative flex h-[30px] items-center rounded-sm pr-2 pl-[38px] text-[13px] text-text-2 no-underline hover:bg-sunken hover:text-text",
                            on &&
                              "font-semibold text-text before:absolute before:top-[7px] before:bottom-[7px] before:left-[17px] before:w-0.5 before:rounded-[1px] before:bg-primary",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
