import { describe, expect, it } from "vitest";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import type { RoomRow } from "../data";
import { ROOMS_TABLE, buildingFilter, roomSearchText, roomSortValue } from "./rooms-table";

const base: RoomRow = {
  id: "r1",
  code: "ROM-0002",
  name: "Classroom 204",
  buildingId: "b1",
  place: "Block A · Main campus",
  campusId: "c1",
  roomTypeId: "t1",
  roomType: "Classroom",
  floor: "2",
  areaSqft: 650,
  isReservable: true,
  status: "available",
  createdAt: "2026-11-18T05:00:00Z",
};

const rooms: RoomRow[] = [
  base,
  { ...base, id: "r2", code: "ROM-0010", name: "Chemistry Lab", roomType: "Laboratory", floor: null, status: "under_maintenance" },
  { ...base, id: "r3", code: "ROM-0001", name: "Store", place: "Hostel · North campus", roomType: null },
];

const run = (q: Record<string, string>) =>
  applyTableParams(rooms, parseTableParams(q, ROOMS_TABLE), { searchText: roomSearchText, sortValue: roomSortValue })
    .rows.map((r) => r.id);

describe("rooms list", () => {
  it("sorts by number by default (numbers in order, not as text)", () => {
    expect(run({})).toEqual(["r3", "r1", "r2"]);
  });

  it("searches number, name, place and type", () => {
    expect(run({ q: "rom-0010" })).toEqual(["r2"]);
    expect(run({ q: "north" })).toEqual(["r3"]);
    expect(run({ q: "laboratory" })).toEqual(["r2"]);
  });

  it("puts rooms without a type or floor last", () => {
    expect(run({ sort: "type" }).at(-1)).toBe("r3");
    expect(run({ sort: "floor", dir: "desc" }).at(-1)).toBe("r2");
  });
});

describe("buildingFilter", () => {
  it("accepts only this client's buildings", () => {
    const ids = new Set(["b1"]);
    expect(buildingFilter("b1", ids)).toBe("b1");
    expect(buildingFilter("other", ids)).toBeNull();
    expect(buildingFilter(["b1"], ids)).toBeNull();
    expect(buildingFilter(undefined, ids)).toBeNull();
  });
});
