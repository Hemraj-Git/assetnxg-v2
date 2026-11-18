import type { TableDefaults } from "@/lib/table-params";
import type { RoomRow, RoomStatus } from "../data";

// List rules for the Rooms tab, shared by the server page and the table.

export const ROOMS_TABLE: TableDefaults = {
  sortable: ["code", "name", "place", "type", "floor", "status"],
  sort: "code",
  dir: "asc",
};

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  available: "Available",
  under_maintenance: "Under maintenance",
};

export function roomSearchText(r: RoomRow): string {
  return [r.code, r.name, r.place, r.roomType ?? "", r.floor ?? ""].join(" ");
}

export function roomSortValue(r: RoomRow, column: string): string | number | null {
  switch (column) {
    case "code":
      return r.code;
    case "name":
      return r.name;
    case "place":
      return r.place;
    case "type":
      return r.roomType;
    case "floor":
      return r.floor;
    case "status":
      return ROOM_STATUS_LABEL[r.status];
    default:
      return null;
  }
}

/** The building filter from the address (?building=…), if it's one of ours. */
export function buildingFilter(raw: unknown, buildingIds: ReadonlySet<string>): string | null {
  return typeof raw === "string" && buildingIds.has(raw) ? raw : null;
}
