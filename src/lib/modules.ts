import { Constants, type Database } from "@/lib/supabase/database.types";

// Modules a client can have switched on (owner decision 17-11-2026: per-module
// toggles). Core features are always on and have no module: dashboard,
// locations, categories, assets, documents, vendors, people, QR codes, reports.
// The database enforces the same list (private.org_has_module).

export type AppModule = Database["public"]["Enums"]["app_module"];

export const ALL_MODULES: readonly AppModule[] = Constants.public.Enums.app_module;

export const MODULE_INFO: Record<AppModule, { label: string; description: string }> = {
  maintenance: {
    label: "Maintenance",
    description: "Service requests, work orders, preventive and corrective jobs, checklist templates",
  },
  housekeeping: { label: "Housekeeping", description: "Cleaning jobs and the room checklist" },
  inspections: { label: "Inspections", description: "Statutory and quality inspections, Pass / Fail" },
  outside_repairs: { label: "Outside repairs", description: "Parts and assets sent to vendors' workshops" },
  reservations: { label: "Reservations", description: "Room bookings by the hour" },
  spares: { label: "Spares & inventory", description: "Stock, low-stock alerts, deploy as asset" },
  warranty_amc: { label: "Warranty & AMC", description: "Contracts and expiry reminders" },
  procurement: { label: "Procurement", description: "Requisitions, quotes, purchase orders, goods receipt" },
  ai_assistant: { label: "AI assistant", description: "Ask AssetNXG: answers and proposed actions" },
};

/** A feature needs `required` (one module, or any of several); none = core. */
export type ModuleRequirement = AppModule | readonly AppModule[] | undefined;

export function moduleEnabled(required: ModuleRequirement, enabled: readonly AppModule[]): boolean {
  if (required === undefined) return true;
  const list: readonly AppModule[] = typeof required === "string" ? [required] : required;
  return list.some((m) => enabled.includes(m));
}

/** Parses a form's checkbox values into known modules (unknown values dropped). */
export function parseModules(values: readonly unknown[]): AppModule[] {
  const set = new Set<AppModule>();
  for (const v of values) {
    if (typeof v === "string" && (ALL_MODULES as readonly string[]).includes(v)) set.add(v as AppModule);
  }
  return ALL_MODULES.filter((m) => set.has(m));
}
