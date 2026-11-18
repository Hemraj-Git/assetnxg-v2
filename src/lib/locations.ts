// Locations: campus → building → room (02 "Organization"). Pure helpers for
// screens, unit-tested.

export type CampusNode = { id: string; code: string; name: string; address: string | null };
export type BuildingNode = { id: string; code: string; name: string; campusId: string; totalFloors: number | null };

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

export type PlaceRow =
  | { kind: "campus"; campus: CampusNode; buildings: number; rooms: number }
  | { kind: "building"; building: BuildingNode; campus: CampusNode; rooms: number };

/** Campuses by name, each followed by its buildings by name, with room counts. */
export function placeTree(
  campuses: readonly CampusNode[],
  buildings: readonly BuildingNode[],
  roomsPerBuilding: ReadonlyMap<string, number>,
): PlaceRow[] {
  const out: PlaceRow[] = [];
  for (const campus of [...campuses].sort(byName)) {
    const mine = buildings.filter((b) => b.campusId === campus.id).sort(byName);
    const rooms = mine.reduce((sum, b) => sum + (roomsPerBuilding.get(b.id) ?? 0), 0);
    out.push({ kind: "campus", campus, buildings: mine.length, rooms });
    for (const building of mine) {
      out.push({ kind: "building", building, campus, rooms: roomsPerBuilding.get(building.id) ?? 0 });
    }
  }
  return out;
}

/** "Block A · Main campus", for pickers and the rooms list. */
export function buildingLabel(building: { name: string }, campus: { name: string } | undefined): string {
  return campus ? `${building.name} · ${campus.name}` : building.name;
}

/** Buildings for a picker: grouped by campus name, then building name. */
export function buildingOptions(
  campuses: readonly CampusNode[],
  buildings: readonly BuildingNode[],
): { value: string; label: string }[] {
  const campusOf = new Map(campuses.map((c) => [c.id, c]));
  return [...buildings]
    .sort((a, b) => {
      const ca = campusOf.get(a.campusId)?.name ?? "";
      const cb = campusOf.get(b.campusId)?.name ?? "";
      return ca.localeCompare(cb, "en", { sensitivity: "base", numeric: true }) || byName(a, b);
    })
    .map((b) => ({ value: b.id, label: buildingLabel(b, campusOf.get(b.campusId)) }));
}

/** Area in square feet for screens: "650 sq ft", Indian grouping. */
export function formatArea(sqft: number | null): string {
  if (sqft === null) return "";
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(sqft)} sq ft`;
}
