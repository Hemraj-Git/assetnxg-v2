import type { Database } from "@/lib/supabase/database.types";
import type { TableDefaults } from "@/lib/table-params";
import { roleSummary } from "@/lib/roles";

type AppRole = Database["public"]["Enums"]["app_role"];

// Shapes and list rules shared by the People page (server) and its table
// (client). Pure, so they're unit-tested.

export type PersonRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  roles: AppRole[];
  departmentId: string | null;
  /** "Academics › Marine Engineering", or null. */
  departmentPath: string | null;
  /** Departments this person heads, by path. */
  heads: string[];
  /** Never signed in: the invite hasn't been accepted. */
  pending: boolean;
  addedAt: string;
  firstSignedInAt: string | null;
  isMe: boolean;
  /** Where this person's requisitions go today (Head of Department step). */
  approval: Approval | null;
  /** Stand-ins covering this person, today or later. */
  standIns: StandIn[];
  /** People this person stands in for, today or later. */
  standingInFor: StandIn[];
};

export type Approval = {
  /** A person, or null when it goes to the Director / Principal role. */
  approverName: string | null;
  toDirectorRole: boolean;
  /** Plain sentence from the database, e.g. "Asha Rao, head of Academics". */
  note: string;
};

export type StandIn = {
  id: string;
  /** The other person: the stand-in, or the person stood in for. */
  otherName: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
  activeToday: boolean;
};

export type DepartmentRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  headUserId: string | null;
  headName: string | null;
  peopleCount: number;
};

export const PEOPLE_TABLE: TableDefaults = {
  sortable: ["name", "roles", "department", "status", "added"],
  sort: "name",
  dir: "asc",
};

export function personSearchText(p: PersonRow): string {
  return [p.name, p.email, p.phone ?? "", roleSummary(p.roles), p.departmentPath ?? ""].join(" ");
}

export function personSortValue(p: PersonRow, column: string): string | number | null {
  switch (column) {
    case "name":
      return p.name;
    case "roles":
      return roleSummary(p.roles);
    case "department":
      return p.departmentPath;
    case "status":
      return p.pending ? "Invite pending" : "Active";
    case "added":
      return p.addedAt;
    default:
      return null;
  }
}

/**
 * The roles to save when an Admin edits someone: what the form chose, plus
 * roles the form doesn't show (e.g. procurement roles while that module is
 * off), so editing never silently removes them.
 */
export function mergeRoles(chosen: readonly AppRole[], existing: readonly AppRole[], offered: readonly AppRole[]): AppRole[] {
  const kept = existing.filter((r) => !offered.includes(r));
  return [...new Set([...chosen, ...kept])];
}
