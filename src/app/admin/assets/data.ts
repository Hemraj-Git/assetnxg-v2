import "server-only";

import type { AssetStatus } from "@/lib/assets";
import { storedAssetFields, type AssetField, type SlaPriority } from "@/lib/categories";
import type { createClient } from "@/lib/supabase/server";

// Reads for the asset screens, as the signed-in Admin (RLS limits all of it
// to this client). Fine at campus scale (a few thousand assets).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RefOption = { id: string; name: string };
export type BuildingRef = RefOption & { campusId: string };
export type RoomRef = RefOption & { code: string; buildingId: string };
export type SubCategoryRef = RefOption & {
  code: string;
  categoryId: string;
  slaPriority: SlaPriority | null;
  fields: AssetField[];
};
export type PersonRef = RefOption & { email: string };

export type AssetRefs = {
  campuses: RefOption[];
  buildings: BuildingRef[];
  rooms: RoomRef[];
  categories: (RefOption & { code: string })[];
  subCategories: SubCategoryRef[];
  vendors: (RefOption & { code: string })[];
  people: PersonRef[];
};

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

/** Everything the asset form and filters choose from. */
export async function loadAssetRefs(supabase: Supabase, orgId: string): Promise<AssetRefs> {
  const [c, b, r, cat, sub, v, m] = await Promise.all([
    supabase.from("campuses").select("id, name").eq("organization_id", orgId),
    supabase.from("buildings").select("id, name, campus_id").eq("organization_id", orgId),
    supabase.from("rooms").select("id, code, name, building_id").eq("organization_id", orgId),
    supabase.from("categories").select("id, code, name").eq("organization_id", orgId),
    supabase.from("sub_categories").select("id, code, name, category_id, sla_priority, asset_fields").eq("organization_id", orgId),
    supabase.from("vendors").select("id, code, name").eq("organization_id", orgId),
    supabase
      .from("memberships")
      .select("user_id, roles, profile:profiles!memberships_user_id_fkey(full_name, email, is_support)")
      .eq("organization_id", orgId)
      .eq("support_access", false),
  ]);
  const failed = c.error ?? b.error ?? r.error ?? cat.error ?? sub.error ?? v.error ?? m.error;
  if (failed) throw new Error(`Could not load the lists: ${failed.message}`);

  return {
    campuses: (c.data ?? []).map((x) => ({ id: x.id, name: x.name })).sort(byName),
    buildings: (b.data ?? []).map((x) => ({ id: x.id, name: x.name, campusId: x.campus_id })).sort(byName),
    rooms: (r.data ?? []).map((x) => ({ id: x.id, code: x.code, name: x.name, buildingId: x.building_id })).sort(byName),
    categories: (cat.data ?? []).map((x) => ({ id: x.id, code: x.code, name: x.name })).sort(byName),
    subCategories: (sub.data ?? [])
      .map((x) => ({
        id: x.id,
        code: x.code,
        name: x.name,
        categoryId: x.category_id,
        slaPriority: x.sla_priority,
        fields: storedAssetFields(x.asset_fields),
      }))
      .sort(byName),
    vendors: (v.data ?? []).map((x) => ({ id: x.id, code: x.code, name: x.name })).sort(byName),
    people: (m.data ?? [])
      .filter((x) => x.profile && !x.profile.is_support && x.roles.some((role) => role !== "guest"))
      .map((x) => ({ id: x.user_id, name: x.profile?.full_name || x.profile?.email || "Unnamed", email: x.profile?.email ?? "" }))
      .sort(byName),
  };
}

export type AssetRecord = {
  id: string;
  code: string;
  name: string;
  status: AssetStatus;
  subCategoryId: string;
  roomId: string;
  slaPriority: SlaPriority | null;
  manufacturer: string | null;
  model: string | null;
  serialNo: string | null;
  price: number | null;
  purchaseDate: string | null;
  installationDate: string | null;
  lastServicedOn: string | null;
  purchasedFromId: string | null;
  assignedTo: string | null;
  specValues: Record<string, unknown>;
  notes: string | null;
  retiredOn: string | null;
  retireReason: string | null;
  createdAt: string;
};

const RECORD_COLUMNS =
  "id, code, name, status, sub_category_id, room_id, sla_priority, manufacturer, model, serial_no, price, purchase_date, installation_date, last_serviced_on, purchased_from_id, assigned_to, spec_values, notes, retired_on, retire_reason, created_at";

type RecordRow = {
  id: string;
  code: string;
  name: string;
  status: AssetStatus;
  sub_category_id: string;
  room_id: string;
  sla_priority: SlaPriority | null;
  manufacturer: string | null;
  model: string | null;
  serial_no: string | null;
  price: number | null;
  purchase_date: string | null;
  installation_date: string | null;
  last_serviced_on: string | null;
  purchased_from_id: string | null;
  assigned_to: string | null;
  spec_values: unknown;
  notes: string | null;
  retired_on: string | null;
  retire_reason: string | null;
  created_at: string;
};

function toRecord(x: RecordRow): AssetRecord {
  return {
    id: x.id,
    code: x.code,
    name: x.name,
    status: x.status,
    subCategoryId: x.sub_category_id,
    roomId: x.room_id,
    slaPriority: x.sla_priority,
    manufacturer: x.manufacturer,
    model: x.model,
    serialNo: x.serial_no,
    price: x.price,
    purchaseDate: x.purchase_date,
    installationDate: x.installation_date,
    lastServicedOn: x.last_serviced_on,
    purchasedFromId: x.purchased_from_id,
    assignedTo: x.assigned_to,
    specValues: x.spec_values && typeof x.spec_values === "object" ? (x.spec_values as Record<string, unknown>) : {},
    notes: x.notes,
    retiredOn: x.retired_on,
    retireReason: x.retire_reason,
    createdAt: x.created_at,
  };
}

export async function loadAssets(supabase: Supabase, orgId: string): Promise<AssetRecord[]> {
  const { data, error } = await supabase.from("assets").select(RECORD_COLUMNS).eq("organization_id", orgId);
  if (error || !data) throw new Error(`Could not load assets: ${error?.message ?? "no data"}`);
  return (data as RecordRow[]).map(toRecord);
}

/** One asset by its number (AST-0027) or id; null if not in this client. */
export async function loadAsset(supabase: Supabase, orgId: string, ref: string): Promise<AssetRecord | null> {
  const column = /^[0-9a-f-]{36}$/i.test(ref) ? "id" : "code";
  const { data, error } = await supabase
    .from("assets")
    .select(RECORD_COLUMNS)
    .eq("organization_id", orgId)
    .eq(column, column === "code" ? ref.toUpperCase() : ref)
    .maybeSingle();
  if (error) throw new Error(`Could not load the asset: ${error.message}`);
  return data ? toRecord(data as RecordRow) : null;
}

export type ActivityEntry = { at: string; action: "insert" | "update" | "delete"; actorId: string | null; changed: string[]; status: AssetStatus | null };

/** The asset's change history from the audit log (who, when, what). */
export async function loadAssetActivity(supabase: Supabase, orgId: string, assetId: string): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("at, action, actor_id, old_data, new_data")
    .eq("organization_id", orgId)
    .eq("table_name", "assets")
    .eq("record_id", assetId)
    .order("at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const IGNORE = new Set(["updated_at", "created_at", "id", "organization_id", "code", "qr_key", "created_by"]);
  return data.map((row) => {
    const before = (row.old_data ?? {}) as Record<string, unknown>;
    const after = (row.new_data ?? {}) as Record<string, unknown>;
    const changed =
      row.action === "update"
        ? Object.keys(after).filter((k) => !IGNORE.has(k) && JSON.stringify(after[k]) !== JSON.stringify(before[k]))
        : [];
    const status = (after.status as AssetStatus | undefined) ?? null;
    return { at: row.at, action: row.action as ActivityEntry["action"], actorId: row.actor_id, changed, status };
  });
}
