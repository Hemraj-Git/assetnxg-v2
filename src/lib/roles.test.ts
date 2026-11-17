import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/supabase/database.types";
import { ROLE_GROUPS, ROLE_LABELS, parseAssignableRoles, roleGroupsFor, roleSummary } from "./roles";

describe("ROLE_LABELS", () => {
  it("has a plain-word label for every database role", () => {
    for (const role of Constants.public.Enums.app_role) {
      expect(ROLE_LABELS[role]).toMatch(/^[A-Z]/);
      expect(ROLE_LABELS[role]).not.toContain("_");
    }
  });
});

describe("roleSummary", () => {
  it("puts Admin first and removes duplicates", () => {
    expect(roleSummary(["store_incharge", "admin", "admin"])).toBe("Admin, Store In-charge");
  });

  it("is empty for no roles", () => {
    expect(roleSummary([])).toBe("");
  });
});

describe("roleGroupsFor", () => {
  it("leaves out procurement roles unless the module is on", () => {
    expect(roleGroupsFor([]).map((g) => g.label)).toEqual(["Desk", "Field app"]);
    expect(roleGroupsFor(["procurement"]).map((g) => g.label)).toEqual(["Desk", "Field app", "Procurement"]);
  });

  it("never offers Guest or Head of Department", () => {
    const offered = ROLE_GROUPS.flatMap((g) => g.roles.map((r) => r.role));
    expect(offered).not.toContain("guest");
    expect(offered).not.toContain("hod");
  });
});

describe("parseAssignableRoles", () => {
  it("keeps known roles in the fixed order and drops the rest", () => {
    expect(parseAssignableRoles(["technician", "admin", "admin", "nonsense", 3], [])).toEqual(["admin", "technician"]);
  });

  it("refuses procurement roles when the module is off, and guest or hod always", () => {
    expect(parseAssignableRoles(["accounts", "guest", "hod"], [])).toEqual([]);
    expect(parseAssignableRoles(["accounts", "dean"], ["procurement"])).toEqual(["accounts", "dean"]);
  });
});
