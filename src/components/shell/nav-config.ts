import {
  Box,
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Package,
  ShieldCheck,
  QrCode,
  Tag,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { moduleEnabled, type AppModule, type ModuleRequirement } from "@/lib/modules";

// Task-based navigation from the canvas read-me ("from 23 links to a
// task-based structure"). Preventive, Corrective and Housekeeping are views of
// one Work orders table. Badges come from live data in their phase; none are
// faked here. The canvas's "vendors to review" badge is NOT approved
// (docs/context/05-design.md), so it is left out.

export type NavLeaf = {
  label: string;
  href: string;
  /** Build phase that delivers the page (docs/context/00-README.md). */
  phase: 1 | 2 | 3 | 4 | 5;
  /** Module(s) the client needs switched on; none = core, always shown. */
  module?: ModuleRequirement;
  /** The page has its own route, so the "arrives in phase N" placeholder
   *  doesn't generate it. */
  built?: true;
};

export type NavItem = NavLeaf & {
  icon: LucideIcon;
  children?: NavLeaf[];
};

export type NavGroup = { label: string; items: NavItem[] };

export const ADMIN_HOME = "/admin";

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: ADMIN_HOME, icon: LayoutDashboard, phase: 3 },
      { label: "Reports", href: "/admin/reports", icon: ChartColumn, phase: 3 },
    ],
  },
  {
    label: "Operations",
    items: [
      // Requests feed maintenance and housekeeping jobs.
      { label: "Service requests", href: "/admin/service-requests", icon: Inbox, phase: 3, module: ["maintenance", "housekeeping"] },
      {
        label: "Work orders",
        href: "/admin/work-orders",
        icon: Wrench,
        phase: 3,
        module: ["maintenance", "housekeeping"],
        children: [
          { label: "Preventive", href: "/admin/work-orders/preventive", phase: 3, module: "maintenance" },
          { label: "Corrective", href: "/admin/work-orders/corrective", phase: 3, module: "maintenance" },
          { label: "Housekeeping", href: "/admin/work-orders/housekeeping", phase: 3, module: "housekeeping" },
        ],
      },
      { label: "Inspections", href: "/admin/inspections", icon: ClipboardCheck, phase: 3, module: "inspections" },
      { label: "Outside repairs", href: "/admin/outside-repairs", icon: Truck, phase: 3, module: "outside_repairs" },
      { label: "Reservations", href: "/admin/reservations", icon: CalendarDays, phase: 3, module: "reservations" },
    ],
  },
  {
    label: "Assets",
    items: [
      { label: "Assets", href: "/admin/assets", icon: Box, phase: 2, built: true },
      // Warranty and AMC contracts are core (owner, 18-11-2026); the
      // warranty_amc module adds reminders on top.
      { label: "Warranty & AMC", href: "/admin/contracts", icon: ShieldCheck, phase: 2, built: true },
      { label: "Spares & inventory", href: "/admin/spares", icon: Package, phase: 2, module: "spares", built: true },
      { label: "QR codes", href: "/admin/qr-codes", icon: QrCode, phase: 2 },
      { label: "Documents", href: "/admin/documents", icon: FileText, phase: 2, built: true },
    ],
  },
  {
    label: "Setup",
    items: [
      { label: "Locations", href: "/admin/locations", icon: MapPin, phase: 2, built: true },
      { label: "Categories", href: "/admin/categories", icon: Tag, phase: 2, built: true },
      // Templates serve preventive jobs and inspections.
      { label: "Checklist templates", href: "/admin/templates", icon: ListChecks, phase: 2, module: ["maintenance", "inspections"], built: true },
      { label: "Vendors", href: "/admin/vendors", icon: Building2, phase: 2, built: true },
      { label: "People & departments", href: "/admin/people", icon: Users, phase: 2, built: true },
    ],
  },
];

/** The navigation for a client: entries whose module is off are left out; a
 *  parent keeps only the views the client has. Groups left empty disappear. */
export function navForModules(enabled: readonly AppModule[], nav: NavGroup[] = NAV): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => moduleEnabled(item.module, enabled))
        .map((item) =>
          item.children
            ? { ...item, children: item.children.filter((c) => moduleEnabled(c.module, enabled)) }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);
}

function normalise(pathname: string): string {
  const p = pathname.split(/[?#]/)[0] ?? "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/** True when `href` is the current page or a page under it. The dashboard
 *  (/admin) matches only itself, or every admin page would light it up. */
export function isActive(href: string, pathname: string): boolean {
  const path = normalise(pathname);
  if (href === ADMIN_HOME) return path === ADMIN_HOME;
  return path === href || path.startsWith(`${href}/`);
}

export type Crumb = { label: string; href?: string };

/** Breadcrumbs for the header: Group › Item (› View). The last one is the
 *  current page and has no link. */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const path = normalise(pathname);
  for (const group of NAV) {
    for (const item of group.items) {
      for (const child of item.children ?? []) {
        if (isActive(child.href, path)) {
          return [
            { label: group.label },
            { label: item.label, href: item.href },
            { label: child.label },
          ];
        }
      }
      if (isActive(item.href, path)) {
        return [{ label: group.label }, { label: item.label }];
      }
    }
  }
  return [];
}

/** The nav entry for an exact admin path (for "comes in a later phase" pages). */
export function findNavLeaf(pathname: string): NavLeaf | null {
  const path = normalise(pathname);
  for (const group of NAV) {
    for (const item of group.items) {
      if (item.href === path) return item;
      for (const child of item.children ?? []) {
        if (child.href === path) return child;
      }
    }
  }
  return null;
}

/** Every admin path in the nav for the placeholder page: not the dashboard,
 *  not pages that have their own route. As path segments. */
export function navSectionParams(): { section: string[] }[] {
  const out: { section: string[] }[] = [];
  for (const group of NAV) {
    for (const item of group.items) {
      for (const leaf of [item, ...(item.children ?? [])]) {
        if (leaf.href === ADMIN_HOME || leaf.built) continue;
        out.push({ section: leaf.href.replace(`${ADMIN_HOME}/`, "").split("/") });
      }
    }
  }
  return out;
}

export type Destination = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Where it sits, for the search list: "Operations" or "Operations › Work orders". */
  trail: string;
};

/** Every page this client has, flat, for the search (Ctrl K) list. Views
 *  (Preventive…) carry their parent's icon. */
export function destinationsFor(enabled: readonly AppModule[]): Destination[] {
  const out: Destination[] = [];
  for (const group of navForModules(enabled)) {
    for (const item of group.items) {
      out.push({ label: item.label, href: item.href, icon: item.icon, trail: group.label });
      for (const child of item.children ?? []) {
        out.push({
          label: child.label,
          href: child.href,
          icon: item.icon,
          trail: `${group.label} › ${item.label}`,
        });
      }
    }
  }
  return out;
}
