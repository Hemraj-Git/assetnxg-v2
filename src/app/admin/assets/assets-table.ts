import { ASSET_STATUSES, ASSET_STATUS_LABEL, type AssetStatus } from "@/lib/assets";
import type { TableDefaults } from "@/lib/table-params";

// The Assets list: rows, search, sort and filters (02 "Assets": campus,
// building, room, category, sub-category, status). Shared by the server page
// and the table.

export type AssetRow = {
  id: string;
  code: string;
  name: string;
  status: AssetStatus;
  /** "HVAC › Split AC" */
  category: string;
  /** "Classroom 204 · Block B" */
  location: string;
  campusId: string;
  buildingId: string;
  roomId: string;
  categoryId: string;
  subCategoryId: string;
  serialNo: string | null;
  assignedName: string | null;
  installationDate: string | null;
};

export const ASSETS_TABLE: TableDefaults = {
  sortable: ["code", "name", "category", "location", "status", "installed"],
  sort: "code",
  dir: "asc",
};

export function assetSearchText(a: AssetRow): string {
  return [a.code, a.name, a.category, a.location, a.serialNo ?? "", a.assignedName ?? ""].join(" ");
}

export function assetSortValue(a: AssetRow, column: string): string | number | null {
  switch (column) {
    case "code":
      return a.code;
    case "name":
      return a.name;
    case "category":
      return a.category;
    case "location":
      return a.location;
    case "status":
      return ASSET_STATUSES.indexOf(a.status);
    case "installed":
      return a.installationDate;
    default:
      return null;
  }
}

export type AssetFilters = {
  campus: string | null;
  building: string | null;
  room: string | null;
  category: string | null;
  sub: string | null;
  status: AssetStatus | null;
};

export const NO_FILTERS: AssetFilters = { campus: null, building: null, room: null, category: null, sub: null, status: null };

/** Filters from the address; anything unknown is ignored. */
export function parseAssetFilters(
  query: Record<string, string | string[] | undefined>,
  known: { campus: Set<string>; building: Set<string>; room: Set<string>; category: Set<string>; sub: Set<string> },
): AssetFilters {
  const pick = (key: keyof typeof known) => {
    const v = query[key];
    return typeof v === "string" && known[key].has(v) ? v : null;
  };
  const status = query.status;
  return {
    campus: pick("campus"),
    building: pick("building"),
    room: pick("room"),
    category: pick("category"),
    sub: pick("sub"),
    status: typeof status === "string" && (ASSET_STATUSES as readonly string[]).includes(status) ? (status as AssetStatus) : null,
  };
}

export function applyAssetFilters(rows: readonly AssetRow[], f: AssetFilters): AssetRow[] {
  return rows.filter(
    (a) =>
      (!f.campus || a.campusId === f.campus) &&
      (!f.building || a.buildingId === f.building) &&
      (!f.room || a.roomId === f.room) &&
      (!f.category || a.categoryId === f.category) &&
      (!f.sub || a.subCategoryId === f.sub) &&
      (!f.status || a.status === f.status),
  );
}

/** Counts per status for the list's status tabs. */
export function statusCounts(rows: readonly AssetRow[]): Record<AssetStatus, number> {
  const out = { operational: 0, under_maintenance: 0, in_storage: 0, retired: 0 } as Record<AssetStatus, number>;
  for (const a of rows) out[a.status] += 1;
  return out;
}

export { ASSET_STATUS_LABEL };
