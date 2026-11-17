import Link from "next/link";
import { cn } from "cn";

// People and Departments are two views of one section ("People &
// departments" in the sidebar): links, so each has its own address.
const TABS = [
  { key: "people", label: "People", href: "/admin/people" },
  { key: "departments", label: "Departments", href: "/admin/people/departments" },
] as const;

export function PeopleTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="People and departments" className="flex gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium no-underline",
            t.key === active
              ? "border-primary text-text"
              : "border-transparent text-text-2 hover:border-border-strong hover:text-text",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
