import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it.each([
    ["Anita Rao", "AR"],
    ["School of Maritime Studies", "SM"],
    ["Coastal Institute of Marine Engineering", "CI"],
    ["ravi", "R"],
    ["ravi.kumar@soms.edu", "RK"],
    ["  Élodie   Durand ", "ÉD"],
    ["", "?"],
    [null, "?"],
  ])("%s → %s", (name, want) => {
    expect(initials(name)).toBe(want);
  });
});
