import { describe, expect, it } from "vitest";
import { ALL_MODULES, MODULE_INFO, moduleEnabled, parseModules } from "./modules";

describe("moduleEnabled", () => {
  it("treats core features (no module) as always on", () => {
    expect(moduleEnabled(undefined, [])).toBe(true);
  });

  it("needs the module for a single requirement", () => {
    expect(moduleEnabled("procurement", ["maintenance"])).toBe(false);
    expect(moduleEnabled("procurement", ["procurement"])).toBe(true);
  });

  it("needs any one of several", () => {
    expect(moduleEnabled(["maintenance", "inspections"], ["inspections"])).toBe(true);
    expect(moduleEnabled(["maintenance", "inspections"], ["housekeeping"])).toBe(false);
  });
});

describe("parseModules", () => {
  it("keeps known modules once, in the standard order, and drops the rest", () => {
    expect(parseModules(["procurement", "maintenance", "procurement", "hacking", 3])).toEqual([
      "maintenance",
      "procurement",
    ]);
  });
});

describe("MODULE_INFO", () => {
  it("has a plain label for every database module", () => {
    for (const m of ALL_MODULES) {
      expect(MODULE_INFO[m].label).toMatch(/^[A-Z]/);
    }
  });
});
