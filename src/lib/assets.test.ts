import { describe, expect, it } from "vitest";
import type { AssetField } from "@/lib/categories";
import { assetAge, parseSpecInputs, specDisplay, specInputValue } from "./assets";

const fields: AssetField[] = [
  { key: "cap", label: "Capacity", type: "number", unit: "ton", required: true },
  { key: "made", label: "Made on", type: "date", unit: null, required: false },
  { key: "gas", label: "Refrigerant", type: "text", unit: null, required: false },
];

const reader = (values: Record<string, string>) => (key: string) => values[key] ?? "";

describe("assetAge", () => {
  it("counts whole months and years", () => {
    expect(assetAge("2024-03-12", "2026-10-03")).toBe("2 y 6 m");
    expect(assetAge("2024-03-12", "2026-10-12")).toBe("2 y 7 m");
    expect(assetAge("2025-11-18", "2026-11-18")).toBe("1 y");
    expect(assetAge("2026-06-01", "2026-11-18")).toBe("5 m");
    expect(assetAge("2026-11-01", "2026-11-18")).toBe("Under a month");
  });

  it("is empty with no date or a date in the future", () => {
    expect(assetAge(null, "2026-11-18")).toBe("");
    expect(assetAge("2027-01-01", "2026-11-18")).toBe("");
  });
});

describe("parseSpecInputs", () => {
  it("reads numbers (with commas), DD-MM-YYYY dates and text", () => {
    expect(parseSpecInputs(fields, reader({ cap: "1,500.5", made: "01-12-2023", gas: " R32 " }))).toEqual({
      ok: true,
      values: { cap: 1500.5, made: "2023-12-01", gas: "R32" },
    });
  });

  it("leaves empty optional fields out", () => {
    expect(parseSpecInputs(fields, reader({ cap: "2" }))).toEqual({ ok: true, values: { cap: 2 } });
  });

  it("explains problems in plain words", () => {
    expect(parseSpecInputs(fields, reader({}))).toEqual({ ok: false, error: "Fill in “Capacity”." });
    expect(parseSpecInputs(fields, reader({ cap: "big" }))).toEqual({ ok: false, error: "“Capacity” must be a number." });
    expect(parseSpecInputs(fields, reader({ cap: "1", made: "31-02-2026" }))).toEqual({
      ok: false,
      error: "Enter “Made on” as DD-MM-YYYY.",
    });
  });
});

describe("spec values on screen", () => {
  it("shows numbers with units and dates as DD-MM-YYYY", () => {
    expect(specDisplay(fields[0], 1.5)).toBe("1.5 ton");
    expect(specDisplay(fields[1], "2023-12-01")).toBe("01-12-2023");
    expect(specDisplay(fields[2], "R32")).toBe("R32");
    expect(specDisplay(fields[2], undefined)).toBe("");
  });

  it("puts stored values back into form text", () => {
    expect(specInputValue(fields[1], "2023-12-01")).toBe("01-12-2023");
    expect(specInputValue(fields[0], 1.5)).toBe("1.5");
    expect(specInputValue(fields[0], null)).toBe("");
  });
});
