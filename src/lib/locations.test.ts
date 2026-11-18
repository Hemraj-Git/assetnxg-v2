import { describe, expect, it } from "vitest";
import { buildingLabel, buildingOptions, formatArea, placeTree } from "./locations";

const campuses = [
  { id: "n", code: "CAM-0002", name: "North campus", address: null },
  { id: "m", code: "CAM-0001", name: "Main campus", address: "Bhubaneswar" },
];
const buildings = [
  { id: "b10", code: "BLD-0003", name: "Block 10", campusId: "m", totalFloors: 2 },
  { id: "b2", code: "BLD-0002", name: "Block 2", campusId: "m", totalFloors: null },
  { id: "h", code: "BLD-0001", name: "Hostel", campusId: "n", totalFloors: 5 },
];

describe("placeTree", () => {
  it("lists campuses by name, each with its buildings (numbers sort naturally)", () => {
    const rows = placeTree(campuses, buildings, new Map([["b2", 3], ["b10", 1]]));
    expect(rows.map((r) => (r.kind === "campus" ? r.campus.id : r.building.id))).toEqual(["m", "b2", "b10", "n", "h"]);
  });

  it("counts buildings and rooms per campus", () => {
    const rows = placeTree(campuses, buildings, new Map([["b2", 3], ["b10", 1]]));
    expect(rows[0]).toMatchObject({ kind: "campus", buildings: 2, rooms: 4 });
    expect(rows[3]).toMatchObject({ kind: "campus", buildings: 1, rooms: 0 });
  });
});

describe("labels", () => {
  it("names a building with its campus", () => {
    expect(buildingLabel({ name: "Block A" }, { name: "Main campus" })).toBe("Block A · Main campus");
    expect(buildingLabel({ name: "Block A" }, undefined)).toBe("Block A");
  });

  it("orders building choices by campus, then building", () => {
    expect(buildingOptions(campuses, buildings).map((o) => o.label)).toEqual([
      "Block 2 · Main campus",
      "Block 10 · Main campus",
      "Hostel · North campus",
    ]);
  });

  it("formats areas with Indian grouping", () => {
    expect(formatArea(125000)).toBe("1,25,000 sq ft");
    expect(formatArea(650.5)).toBe("650.5 sq ft");
    expect(formatArea(null)).toBe("");
  });
});
