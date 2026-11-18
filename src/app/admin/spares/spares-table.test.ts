import { describe, expect, it } from "vitest";
import type { SpareRow } from "./data";
import { applySpareFilters, parseSpareFilters, spareSortValue } from "./spares-table";

const row = (over: Partial<SpareRow>): SpareRow => ({
  id: "1",
  code: "INV-0001",
  name: "Compressor",
  make: "",
  categoryId: "c1",
  subCategoryId: "s1",
  category: "HVAC › Split AC",
  storage: "",
  quantity: 5,
  minStock: 2,
  state: "ok",
  unitCost: null,
  value: null,
  vendor: null,
  ...over,
});

describe("spares table", () => {
  it("parses filters, ignoring unknown categories", () => {
    expect(parseSpareFilters({ stock: "low", category: "c1" }, new Set(["c1"]))).toEqual({ stock: "low", category: "c1" });
    expect(parseSpareFilters({ stock: "x", category: "zz" }, new Set(["c1"]))).toEqual({ stock: null, category: null });
  });

  it("low includes out of stock; out is only 0", () => {
    const rows = [row({ id: "a", state: "ok" }), row({ id: "b", state: "low" }), row({ id: "c", state: "out", quantity: 0 })];
    expect(applySpareFilters(rows, { stock: "low", category: null }).map((r) => r.id)).toEqual(["b", "c"]);
    expect(applySpareFilters(rows, { stock: "out", category: null }).map((r) => r.id)).toEqual(["c"]);
  });

  it("sorts stock with out of stock first", () => {
    const out = spareSortValue(row({ state: "out", quantity: 0 }), "stock") as number;
    const low = spareSortValue(row({ state: "low", quantity: 1 }), "stock") as number;
    const ok = spareSortValue(row({ state: "ok", quantity: 3 }), "stock") as number;
    expect(out < low && low < ok).toBe(true);
  });
});
