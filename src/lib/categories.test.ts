import { describe, expect, it } from "vitest";
import { newFieldKey, parseAssetFields, storedAssetFields, taxonomyTree } from "./categories";

const field = (over: Record<string, unknown> = {}) => ({
  key: "f_1",
  label: "Capacity",
  type: "number",
  unit: "kVA",
  required: true,
  ...over,
});

describe("parseAssetFields", () => {
  it("accepts a clean list, trims labels and empties blank units", () => {
    const result = parseAssetFields(JSON.stringify([field({ label: " Capacity " }), field({ key: "f_2", label: "Made on", type: "date", unit: " " })]));
    expect(result).toEqual({
      ok: true,
      fields: [
        { key: "f_1", label: "Capacity", type: "number", unit: "kVA", required: true },
        { key: "f_2", label: "Made on", type: "date", unit: null, required: true },
      ],
    });
  });

  it("treats an empty form value as no fields", () => {
    expect(parseAssetFields("")).toEqual({ ok: true, fields: [] });
  });

  it("explains a missing name and a repeated name in plain words", () => {
    expect(parseAssetFields(JSON.stringify([field({ label: "" })]))).toEqual({ ok: false, error: "Give every field a name." });
    expect(parseAssetFields(JSON.stringify([field(), field({ key: "f_2", label: "capacity" })]))).toEqual({
      ok: false,
      error: "Two fields are called “Capacity”. Give each field its own name.",
    });
  });

  it("refuses unknown types, repeated keys, broken JSON and too many fields", () => {
    expect(parseAssetFields(JSON.stringify([field({ type: "colour" })])).ok).toBe(false);
    expect(parseAssetFields(JSON.stringify([field(), field({ label: "Other" })])).ok).toBe(false);
    expect(parseAssetFields("{not json").ok).toBe(false);
    const many = Array.from({ length: 31 }, (_, i) => field({ key: `f_${i}`, label: `Field ${i}` }));
    expect(parseAssetFields(JSON.stringify(many))).toEqual({ ok: false, error: "Up to 30 fields." });
  });
});

describe("field keys and stored lists", () => {
  it("makes short keys the database accepts", () => {
    expect(newFieldKey(() => "1234abcd-0000-1111-2222-333344445555")).toBe("f_1234abcd00");
    expect(newFieldKey()).toMatch(/^f_[0-9a-f]{10}$/);
  });

  it("drops bad stored entries instead of failing the page", () => {
    expect(storedAssetFields([field(), { junk: true }])).toHaveLength(1);
    expect(storedAssetFields(null)).toEqual([]);
  });
});

describe("taxonomyTree", () => {
  it("lists categories by name, each followed by its sub-categories", () => {
    const rows = taxonomyTree(
      [
        { id: "m", code: "MECH", name: "Mechanical", description: null },
        { id: "e", code: "ELEC", name: "Electrical", description: null },
      ],
      [
        { id: "u", categoryId: "e", code: "ELEC-UPS0", name: "UPS", description: null, slaPriority: null, assetFields: [] },
        { id: "l", categoryId: "e", code: "ELEC-LIGH", name: "Lighting", description: null, slaPriority: "low", assetFields: [] },
      ],
    );
    expect(rows.map((r) => (r.kind === "category" ? `${r.category.code}(${r.subCount})` : r.sub.code))).toEqual([
      "ELEC(2)",
      "ELEC-LIGH",
      "ELEC-UPS0",
      "MECH(0)",
    ]);
  });
});
