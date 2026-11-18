import type { AssetRow } from "./assets-table";
import type { AssetRecord, AssetRefs } from "./data";

/** Lookups for names and places, built once per request. */
export function refMaps(refs: AssetRefs) {
  const campus = new Map(refs.campuses.map((c) => [c.id, c]));
  const building = new Map(refs.buildings.map((b) => [b.id, b]));
  const room = new Map(refs.rooms.map((r) => [r.id, r]));
  const category = new Map(refs.categories.map((c) => [c.id, c]));
  const sub = new Map(refs.subCategories.map((s) => [s.id, s]));
  const vendor = new Map(refs.vendors.map((v) => [v.id, v]));
  const person = new Map(refs.people.map((p) => [p.id, p]));
  return { campus, building, room, category, sub, vendor, person };
}

export type RefMaps = ReturnType<typeof refMaps>;

/** Where an asset is, from its room: campus, building and room. */
export function placeOf(maps: RefMaps, roomId: string) {
  const room = maps.room.get(roomId);
  const building = room ? maps.building.get(room.buildingId) : undefined;
  const campus = building ? maps.campus.get(building.campusId) : undefined;
  return { room, building, campus };
}

export function toAssetRow(a: AssetRecord, maps: RefMaps): AssetRow {
  const { room, building, campus } = placeOf(maps, a.roomId);
  const sub = maps.sub.get(a.subCategoryId);
  const category = sub ? maps.category.get(sub.categoryId) : undefined;
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    status: a.status,
    category: [category?.name, sub?.name].filter(Boolean).join(" › "),
    location: [room?.name, building?.name].filter(Boolean).join(" · "),
    campusId: campus?.id ?? "",
    buildingId: building?.id ?? "",
    roomId: a.roomId,
    categoryId: category?.id ?? "",
    subCategoryId: a.subCategoryId,
    serialNo: a.serialNo,
    assignedName: a.assignedTo ? (maps.person.get(a.assignedTo)?.name ?? null) : null,
    installationDate: a.installationDate,
  };
}
