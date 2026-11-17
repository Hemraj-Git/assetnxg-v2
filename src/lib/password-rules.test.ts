import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, passwordAcceptable, passwordChecks } from "./password-rules";

const person = { email: "kavita.p@seaward.example", name: "Kavita Pillai" };
const status = (pw: string) => Object.fromEntries(passwordChecks(pw, person).map((c) => [c.id, c.ok]));

describe("passwordChecks", () => {
  it("accepts a strong password", () => {
    expect(passwordAcceptable("Harbour-tide-2026", person)).toBe(true);
  });

  it("needs the minimum length", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(status("Ab1-defghij").length).toBe(false); // 11
    expect(status("Ab1-defghijk").length).toBe(true); // 12
  });

  it("needs both cases, a number and a symbol", () => {
    expect(status("harbour-tide-2026").case).toBe(false);
    expect(status("Harbour-tide-sea").number).toBe(false);
    expect(status("HarbourTide2026x").symbol).toBe(false);
  });

  it("counts non-English letters and digits correctly", () => {
    expect(status("Überfällig-2026é").case).toBe(true);
  });

  it("refuses the person's name or email words, case-insensitively", () => {
    expect(status("KAVITA-harbour-26").personal).toBe(false);
    expect(status("Pillai-harbour-26").personal).toBe(false);
    expect(status("Harbour-tide-2026").personal).toBe(true);
  });

  it("ignores very short name parts (would block too much)", () => {
    expect(passwordChecks("Harbour-p-tide-2026", { email: "p@x.example" }).find((c) => c.id === "personal")?.ok).toBe(true);
  });

  it("shows nothing as met for an empty password", () => {
    expect(passwordChecks("", person).every((c) => !c.ok)).toBe(true);
  });
});
