import {
  Box,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Inbox,
  Package,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { moduleEnabled, type AppModule, type ModuleRequirement } from "@/lib/modules";

// Canvas · Header menus › Create. Short forms will open a dialog on the
// current page; the wizards (Asset, Spare) a full page. Each entry gets its
// `href` when its form is built (phases 2 and 3); until then it shows as
// "Soon" and does nothing.

export type CreateItem = {
  label: string;
  icon: LucideIcon;
  /** Module(s) the client needs; none = core. */
  module?: ModuleRequirement;
  /** Where it opens, once built. */
  href: string | null;
  /** Work comes first, registry second (separator between). */
  section: "work" | "registry";
};

export const CREATE_ITEMS: CreateItem[] = [
  { label: "Work order", icon: Wrench, module: ["maintenance", "housekeeping"], href: null, section: "work" },
  { label: "Service request", icon: Inbox, module: ["maintenance", "housekeeping"], href: null, section: "work" },
  { label: "PM schedule", icon: CalendarClock, module: "maintenance", href: null, section: "work" },
  { label: "Inspection", icon: ClipboardCheck, module: "inspections", href: null, section: "work" },
  { label: "Reservation", icon: CalendarDays, module: "reservations", href: null, section: "work" },
  { label: "Asset", icon: Box, href: null, section: "registry" },
  { label: "Spare", icon: Package, module: "spares", href: null, section: "registry" },
  { label: "Send for outside repair", icon: Truck, module: "outside_repairs", href: null, section: "registry" },
];

/** The Create entries this client has, in menu order. */
export function createItemsFor(
  modules: readonly AppModule[],
  items: readonly CreateItem[] = CREATE_ITEMS,
): CreateItem[] {
  return items.filter((item) => moduleEnabled(item.module, modules));
}
