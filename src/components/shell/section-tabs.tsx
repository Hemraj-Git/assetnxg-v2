import Link from "next/link";
import { cn } from "cn";

// Views of one sidebar section (People / Departments, Places / Rooms / Room
// types): links, so each view has its own address and Back works.
export function SectionTabs({
  label,
  tabs,
  active,
}: {
  /** Names the group for screen readers, e.g. "Locations". */
  label: string;
  tabs: readonly { key: string; label: string; href: string; count?: number }[];
  active: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px flex flex-none items-center gap-1.5 border-b-2 px-3 py-2 text-[13.5px] font-medium no-underline",
            t.key === active
              ? "border-primary text-text"
              : "border-transparent text-text-2 hover:border-border-strong hover:text-text",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="rounded-xs bg-sunken px-1.5 text-xs leading-[18px] text-text-2 tabular-nums">{t.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
