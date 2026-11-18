import { describe, expect, it } from "vitest";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import {
  ASSETS_TABLE,
  applyAssetFilters,
  assetSearchText,
  assetSortValue,
  parseAssetFilters,
  statusCounts,
  type AssetRow,
} from "./assets-table";

const base: AssetRow = {
  id: "a1",
  code: "AST-0013",
  name: "Split AC 2 Ton",
  status: "operational",
  category: "HVAC › Split AC",
  location: "Bridge Simulator Room · Block A",
  campusId: "c1",
  buildingId: "bA",
  roomId: "r1",
  categoryId: "hvac",
  subCategoryId: "ac",
  serialNo: "BS-18Y-2203",
  assignedName: "Ravi Kumar",
  installationDate: "2024-03-12",
};

const rows: AssetRow[] = [
  base,
  { ...base, id: "a2", code: "AST-0002", name: "Fume hood", status: "under_maintenance", category: "HVAC › Ventilation", subCategoryId: "vent", buildingId: "bC", roomId: "r9", serialNo: null, assignedName: null },
  { ...base, id: "a3", code: "AST-0100", name: "Ceiling fan", status: "in_storage", campusId: "c2", categoryId: "elec", subCategoryId: "fan", installationDate: null },
];

const run = (q: Record<string, string>) =>
  applyTableParams(rows, parseTableParams(q, ASSETS_TABLE), { searchText: assetSearchText, sortValue: assetSortValue }).rows.map((r) => r.id);

describe("assets list", () => {
  it("sorts by number by default, numbers in order", () => {
    expect(run({})).toEqual(["a2", "a1", "a3"]);
  });

  it("searches number, name, category, place, serial and assignee", () => {
    expect(run({ q: "bs-18y" })).toEqual(["a1", "a3"]);
    expect(run({ q: "ventilation" })).toEqual(["a2"]);
    expect(run({ q: "ravi" })).toEqual(["a1", "a3"]);
  });

  it("sorts by status in the fixed order, and installation date with empty last", () => {
    expect(run({ sort: "status" })).toEqual(["a1", "a2", "a3"]);
    expect(run({ sort: "installed" }).at(-1)).toBe("a3");
  });
});

describe("filters", () => {
  const known = {
    campus: new Set(["c1", "c2"]),
    building: new Set(["bA", "bC"]),
    room: new Set(["r1", "r9"]),
    category: new Set(["hvac", "elec"]),
    sub: new Set(["ac", "vent", "fan"]),
  };

  it("keeps only known values from the address", () => {
    expect(parseAssetFilters({ campus: "c1", building: "zzz", status: "retired", sub: ["ac"] }, known)).toEqual({
      campus: "c1",
      building: null,
      room: null,
      category: null,
      sub: null,
      status: "retired",
    });
    expect(parseAssetFilters({ status: "broken" }, known).status).toBeNull();
  });

  it("combines filters", () => {
    const f = parseAssetFilters({ campus: "c1", category: "hvac" }, known);
    expect(applyAssetFilters(rows, f).map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(applyAssetFilters(rows, { ...f, building: "bC" }).map((r) => r.id)).toEqual(["a2"]);
  });

  it("counts by status", () => {
    expect(statusCounts(rows)).toEqual({ operational: 1, under_maintenance: 1, in_storage: 1, retired: 0 });
  });
});
