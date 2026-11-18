import { SectionTabs } from "@/components/shell/section-tabs";

// People and Departments are two views of one section ("People &
// departments" in the sidebar).
const TABS = [
  { key: "people", label: "People", href: "/admin/people" },
  { key: "departments", label: "Departments", href: "/admin/people/departments" },
] as const;

export function PeopleTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return <SectionTabs label="People and departments" tabs={TABS} active={active} />;
}
