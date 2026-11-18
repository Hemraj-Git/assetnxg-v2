import type { TableDefaults } from "@/lib/table-params";

// Shapes and list rules for the Vendors page (server) and table (client).
// AMCs are contracts on assets (owner, 18-11-2026), not vendor fields.

export type VendorRow = {
  id: string;
  code: string;
  name: string;
  categoryIds: string[];
  /** Category names, sorted, for display and search. */
  supplies: string[];
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export const VENDORS_TABLE: TableDefaults = {
  sortable: ["code", "name", "supplies", "contact"],
  sort: "name",
  dir: "asc",
};

export function vendorSearchText(v: VendorRow): string {
  return [v.code, v.name, v.supplies.join(" "), v.contactPerson ?? "", v.phone ?? "", v.email ?? ""].join(" ");
}

export function vendorSortValue(v: VendorRow, column: string): string | number | null {
  switch (column) {
    case "code":
      return v.code;
    case "name":
      return v.name;
    case "supplies":
      return v.supplies[0] ?? null;
    case "contact":
      return v.contactPerson;
    default:
      return null;
  }
}
