import type { Database } from "@/lib/supabase/database.types";
import type { AppModule } from "@/lib/modules";

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
  dean: "Dean",
  quality_manager: "Quality Manager",
};

/** "Admin, Store In-charge": the role list for a person, Admin first. */
export function roleSummary(roles: readonly AppRole[]): string {
  const order = Object.keys(ROLE_LABELS) as AppRole[];
  return [...new Set(roles)]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((r) => ROLE_LABELS[r])
    .join(", ");
}

export type RoleOption = { role: AppRole; description: string };
export type RoleGroup = { label: string; module?: AppModule; roles: RoleOption[] };

/**
 * The roles an Admin can give, grouped for the invite and edit forms.
 * Guest comes from guest sign-in, never from an Admin. Head of department is
 * set on the department, not given as a role (owner, 17-11-2026).
 */
export const ROLE_GROUPS: readonly RoleGroup[] = [
  {
    label: "Desk",
    roles: [{ role: "admin", description: "Runs AssetNXG for the organisation: every desk page and setting" }],
  },
  {
    label: "Field app",
    roles: [
      { role: "technician", description: "Does maintenance jobs and inspections" },
      { role: "housekeeping", description: "Does cleaning jobs" },
      { role: "faculty", description: "Raises requests and books rooms" },
    ],
  },
  {
    label: "Procurement",
    module: "procurement",
    roles: [
      { role: "procurement_manager", description: "Reviews requisitions, approves vendors, monthly urgent review" },
      { role: "procurement_executive", description: "Quotes, purchase orders, goods receipt, invoices" },
      { role: "accounts", description: "Approves spending per the approval limits; records payments" },
      { role: "director", description: "Approves high-value and urgent purchases" },
      { role: "dean", description: "Approves urgent purchases" },
      { role: "security_supervisor", description: "Checks deliveries at goods receipt" },
      { role: "store_incharge", description: "Issues stock and runs the monthly count" },
      { role: "quality_manager", description: "Sees non-conformities and procurement KPIs" },
    ],
  },
];

/** The groups this client can use: Procurement only with that module on. */
export function roleGroupsFor(modules: readonly AppModule[]): RoleGroup[] {
  return ROLE_GROUPS.filter((g) => !g.module || modules.includes(g.module));
}

/** Keeps only roles an Admin may give in this client (unknown values dropped),
 *  in the fixed order. */
export function parseAssignableRoles(values: readonly unknown[], modules: readonly AppModule[]): AppRole[] {
  const allowed = roleGroupsFor(modules).flatMap((g) => g.roles.map((r) => r.role));
  const wanted = new Set(values.filter((v): v is string => typeof v === "string"));
  return allowed.filter((r) => wanted.has(r));
}
