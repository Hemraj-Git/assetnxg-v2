import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/supabase/database.types";
import { ROLE_LABELS, roleSummary } from "./roles";

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
