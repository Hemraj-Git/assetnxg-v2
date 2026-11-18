"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { plainDbError } from "@/lib/db-errors";
import {
  TRY_AGAIN,
  fail,
  isId,
  ok,
  optionalId,
  optionalNumber,
  text,
  type ActionState,
} from "@/lib/form-actions";
import { moduleEnabled } from "@/lib/modules";

// Locations (Admins only): campuses, buildings, rooms, room types. Each
// action re-checks the Admin (requireAdmin); the database checks again (RLS,
// same-client links, delete guards), numbers the record and logs the change.

export type { ActionState };

const GONE = "This was changed or removed meanwhile. Refresh the page.";

const name = (label: string, max: number) =>
  z.string().min(1, `Enter the ${label}'s name.`).max(max, `Keep the name under ${max} characters.`);

// ───────────── Campuses ─────────────

export async function saveCampus(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = z
    .object({ name: name("campus", 80), address: z.string().max(300, "Keep the address under 300 characters.") })
    .safeParse({ name: text(formData, "name"), address: text(formData, "address") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const values = { name: parsed.data.name, address: parsed.data.address || null };
  const duplicate = `There is already a campus called “${parsed.data.name}”.`;

  if (id === null) {
    const { error } = await supabase.from("campuses").insert({ ...values, organization_id: ctx.brand.id });
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    refresh();
    return ok(`${parsed.data.name} added.`);
  }
  const { data, error } = await supabase
    .from("campuses")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Saved.");
}

// ───────────── Buildings ─────────────

export async function saveBuilding(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = name("building", 80).safeParse(text(formData, "name"));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const campusId = optionalId(formData, "campus_id");
  if (!campusId) return fail("Choose the campus.");
  const floors = optionalNumber(formData, "total_floors");
  if (floors === undefined || (floors !== null && (!Number.isInteger(floors) || floors > 200))) {
    return fail("Enter the number of floors as a whole number (up to 200).");
  }

  const values = { name: parsed.data, campus_id: campusId, total_floors: floors };
  const duplicate = `This campus already has a building called “${parsed.data}”.`;

  if (id === null) {
    const { error } = await supabase.from("buildings").insert({ ...values, organization_id: ctx.brand.id });
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    refresh();
    return ok(`${parsed.data} added.`);
  }
  const { data, error } = await supabase
    .from("buildings")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Saved.");
}

// ───────────── Rooms ─────────────

export async function saveRoom(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = name("room", 80).safeParse(text(formData, "name"));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const buildingId = optionalId(formData, "building_id");
  if (!buildingId) return fail("Choose the building.");
  const roomTypeId = optionalId(formData, "room_type_id");
  if (roomTypeId === undefined) return fail("Choose a room type from the list.");
  const floor = text(formData, "floor");
  if (floor.length > 30) return fail("Keep the floor under 30 characters.");
  const area = optionalNumber(formData, "area_sqft");
  if (area === undefined || (area !== null && area > 99_999_999)) return fail("Enter the area in square feet, as a number.");
  const status = text(formData, "status");
  if (status !== "available" && status !== "under_maintenance") return fail("Choose the room's status.");

  const values = {
    name: parsed.data,
    building_id: buildingId,
    room_type_id: roomTypeId,
    floor: floor || null,
    area_sqft: area,
    status: status as "available" | "under_maintenance",
    // Only shown (and changed) when the client has room bookings.
    ...(moduleEnabled("reservations", ctx.modules) ? { is_reservable: formData.get("is_reservable") === "on" } : {}),
  };

  if (id === null) {
    const { data, error } = await supabase
      .from("rooms")
      .insert({ ...values, organization_id: ctx.brand.id })
      .select("code")
      .single();
    if (error) return fail(plainDbError(error, TRY_AGAIN));
    refresh();
    return ok(`${parsed.data} added as ${data.code}.`);
  }
  const { data, error } = await supabase
    .from("rooms")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Saved.");
}

// ───────────── Room types ─────────────

export async function saveRoomType(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = z
    .string()
    .min(1, "Enter the room type.")
    .max(60, "Keep it under 60 characters.")
    .safeParse(text(formData, "name"));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the name.");
  const duplicate = `“${parsed.data}” is already in the list.`;

  if (id === null) {
    const { error } = await supabase.from("room_types").insert({ name: parsed.data, organization_id: ctx.brand.id });
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    refresh();
    return ok(`${parsed.data} added.`);
  }
  const { data, error } = await supabase
    .from("room_types")
    .update({ name: parsed.data })
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Saved.");
}

// ───────────── Delete (refused while something depends on it) ─────────────

const TABLES = {
  campus: { table: "campuses", done: "Campus deleted." },
  building: { table: "buildings", done: "Building deleted." },
  room: { table: "rooms", done: "Room deleted." },
  roomType: { table: "room_types", done: "Room type removed." },
} as const;

export async function deleteLocation(kind: keyof typeof TABLES, id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  const target = TABLES[kind];
  if (!target || !isId(id)) return fail(TRY_AGAIN);

  const { data, error } = await supabase
    .from(target.table)
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok(target.done);
}
