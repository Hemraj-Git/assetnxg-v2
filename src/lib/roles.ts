import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Plain words for screens (CLAUDE.md: UI language). */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  faculty: "Faculty",
  technician: "Technician",
  housekeeping: "Housekeeping",
  guest: "Guest",
  procurement_manager: "Procurement Manager",
  procurement_executive: "Procurement Executive",
  hod: "Head of Department",
  accounts: "Accounts",
  director: "Director / Principal",
  security_supervisor: "Building Security Supervisor",
  store_incharge: "Store In-charge",
};

/** "Admin, Store In-charge": the role list for a person, Admin first. */
export function roleSummary(roles: readonly AppRole[]): string {
  const order = Object.keys(ROLE_LABELS) as AppRole[];
  return [...new Set(roles)]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((r) => ROLE_LABELS[r])
    .join(", ");
}
