import "server-only";

import type { BuildingNode, CampusNode } from "@/lib/locations";
import type { Database } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type RoomStatus = Database["public"]["Enums"]["room_status"];

export type RoomTypeRow = { id: string; name: string; rooms: number };

export type RoomRow = {
  id: string;
  code: string;
  name: string;
  buildingId: string;
  /** "Block A · Main campus" */
  place: string;
  campusId: string;
  roomTypeId: string | null;
  roomType: string | null;
  floor: string | null;
  areaSqft: number | null;
  isReservable: boolean;
  status: RoomStatus;
  createdAt: string;
};

export type Locations = {
  campuses: CampusNode[];
  buildings: BuildingNode[];
  roomTypes: RoomTypeRow[];
  rooms: RoomRow[];
};

/** All of this client's locations, read as the signed-in Admin (RLS limits
 *  them to this client). Fine at campus scale (hundreds of rooms). */
export async function loadLocations(supabase: Supabase, orgId: string): Promise<Locations> {
  const [c, b, t, r] = await Promise.all([
    supabase.from("campuses").select("id, code, name, address").eq("organization_id", orgId),
    supabase.from("buildings").select("id, code, name, campus_id, total_floors").eq("organization_id", orgId),
    supabase.from("room_types").select("id, name").eq("organization_id", orgId),
    supabase
      .from("rooms")
      .select("id, code, name, building_id, room_type_id, floor, area_sqft, is_reservable, status, created_at")
      .eq("organization_id", orgId),
  ]);
  const failed = c.error ?? b.error ?? t.error ?? r.error;
  if (failed) throw new Error(`Could not load locations: ${failed.message}`);
  if (!c.data || !b.data || !t.data || !r.data) throw new Error("Could not load locations.");

  const campuses: CampusNode[] = c.data.map((x) => ({ id: x.id, code: x.code, name: x.name, address: x.address }));
  const buildings: BuildingNode[] = b.data.map((x) => ({
    id: x.id,
    code: x.code,
    name: x.name,
    campusId: x.campus_id,
    totalFloors: x.total_floors,
  }));

  const campusOf = new Map(campuses.map((x) => [x.id, x]));
  const buildingOf = new Map(buildings.map((x) => [x.id, x]));
  const typeName = new Map(t.data.map((x) => [x.id, x.name]));

  const rooms: RoomRow[] = r.data.map((x) => {
    const building = buildingOf.get(x.building_id);
    const campus = building ? campusOf.get(building.campusId) : undefined;
    return {
      id: x.id,
      code: x.code,
      name: x.name,
      buildingId: x.building_id,
      place: building ? (campus ? `${building.name} · ${campus.name}` : building.name) : "",
      campusId: building?.campusId ?? "",
      roomTypeId: x.room_type_id,
      roomType: x.room_type_id ? (typeName.get(x.room_type_id) ?? null) : null,
      floor: x.floor,
      areaSqft: x.area_sqft,
      isReservable: x.is_reservable,
      status: x.status,
      createdAt: x.created_at,
    };
  });

  const typeCount = new Map<string, number>();
  for (const room of rooms) {
    if (room.roomTypeId) typeCount.set(room.roomTypeId, (typeCount.get(room.roomTypeId) ?? 0) + 1);
  }
  const roomTypes: RoomTypeRow[] = t.data
    .map((x) => ({ id: x.id, name: x.name, rooms: typeCount.get(x.id) ?? 0 }))
    .sort((a, b2) => a.name.localeCompare(b2.name, "en", { sensitivity: "base" }));

  return { campuses, buildings, roomTypes, rooms };
}
