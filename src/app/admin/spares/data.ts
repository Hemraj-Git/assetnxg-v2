import "server-only";

import { FORMER_MEMBER, loadPeopleNames } from "@/lib/people-names";
import { stockState, stockValue, type StockReason, type StockState } from "@/lib/spares";
import type { createClient } from "@/lib/supabase/server";
import type { RefMaps } from "../assets/rows";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SpareRecord = {
  id: string;
  code: string;
  name: string;
  subCategoryId: string;
  manufacturer: string | null;
  model: string | null;
  partNo: string | null;
  serialNo: string | null;
  quantity: number;
  minStock: number | null;
  unitCost: number | null;
  roomId: string | null;
  storageNote: string | null;
  handlingNote: string | null;
  vendorId: string | null;
  purchaseDate: string | null;
  warrantyTill: string | null;
  specValues: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
};

const COLUMNS =
  "id, code, name, sub_category_id, manufacturer, model, part_no, serial_no, quantity, min_stock, unit_cost, room_id, storage_note, handling_note, vendor_id, purchase_date, warranty_till, spec_values, notes, created_at";

type Row = {
  id: string;
  code: string;
  name: string;
  sub_category_id: string;
  manufacturer: string | null;
  model: string | null;
  part_no: string | null;
  serial_no: string | null;
  quantity: number;
  min_stock: number | null;
  unit_cost: number | null;
  room_id: string | null;
  storage_note: string | null;
  handling_note: string | null;
  vendor_id: string | null;
  purchase_date: string | null;
  warranty_till: string | null;
  spec_values: unknown;
  notes: string | null;
  created_at: string;
};

const toRecord = (x: Row): SpareRecord => ({
  id: x.id,
  code: x.code,
  name: x.name,
  subCategoryId: x.sub_category_id,
  manufacturer: x.manufacturer,
  model: x.model,
  partNo: x.part_no,
  serialNo: x.serial_no,
  quantity: x.quantity,
  minStock: x.min_stock,
  unitCost: x.unit_cost,
  roomId: x.room_id,
  storageNote: x.storage_note,
  handlingNote: x.handling_note,
  vendorId: x.vendor_id,
  purchaseDate: x.purchase_date,
  warrantyTill: x.warranty_till,
  specValues: x.spec_values && typeof x.spec_values === "object" ? (x.spec_values as Record<string, unknown>) : {},
  notes: x.notes,
  createdAt: x.created_at,
});

/** This client's spares (RLS: staff, Spares module on). */
export async function loadSpares(supabase: Supabase, orgId: string): Promise<SpareRecord[]> {
  const { data, error } = await supabase.from("spares").select(COLUMNS).eq("organization_id", orgId);
  if (error || !data) throw new Error(`Could not load spares: ${error?.message ?? "no data"}`);
  return (data as Row[]).map(toRecord);
}

/** One spare by its number (INV-0001) or id. */
export async function loadSpare(supabase: Supabase, orgId: string, ref: string): Promise<SpareRecord | null> {
  const column = /^[0-9a-f-]{36}$/i.test(ref) ? "id" : "code";
  const { data, error } = await supabase
    .from("spares")
    .select(COLUMNS)
    .eq("organization_id", orgId)
    .eq(column, column === "code" ? ref.toUpperCase() : ref)
    .maybeSingle();
  if (error) throw new Error(`Could not load the spare: ${error.message}`);
  return data ? toRecord(data as Row) : null;
}

/** A row of the spares list. */
export type SpareRow = {
  id: string;
  code: string;
  name: string;
  make: string;
  categoryId: string;
  subCategoryId: string;
  category: string;
  /** "Store · Block A · Rack B, shelf 3" */
  storage: string;
  quantity: number;
  minStock: number | null;
  state: StockState;
  unitCost: number | null;
  value: number | null;
  vendor: string | null;
};

export function toSpareRow(s: SpareRecord, maps: RefMaps): SpareRow {
  const sub = maps.sub.get(s.subCategoryId);
  const category = sub ? maps.category.get(sub.categoryId) : undefined;
  const room = s.roomId ? maps.room.get(s.roomId) : undefined;
  const building = room ? maps.building.get(room.buildingId) : undefined;
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    make: [s.manufacturer, s.model, s.partNo && `Part ${s.partNo}`].filter(Boolean).join(" · "),
    categoryId: category?.id ?? "",
    subCategoryId: s.subCategoryId,
    category: [category?.name, sub?.name].filter(Boolean).join(" › "),
    storage: [room?.name, building?.name, s.storageNote].filter(Boolean).join(" · "),
    quantity: s.quantity,
    minStock: s.minStock,
    state: stockState(s.quantity, s.minStock),
    unitCost: s.unitCost,
    value: stockValue(s.quantity, s.unitCost),
    vendor: s.vendorId ? (maps.vendor.get(s.vendorId)?.name ?? null) : null,
  };
}

export type Movement = {
  id: string;
  reason: StockReason;
  change: number;
  balanceAfter: number;
  note: string | null;
  assetId: string | null;
  by: string;
  at: string;
};

/** A spare's stock history, newest first. */
export async function loadMovements(
  supabase: Supabase,
  orgId: string,
  spareId: string,
): Promise<Movement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, reason, change, balance_after, note, asset_id, created_by, created_at")
    .eq("organization_id", orgId)
    .eq("spare_id", spareId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) throw new Error(`Could not load the stock history: ${error?.message ?? "no data"}`);
  const people = await loadPeopleNames(supabase, data.map((m) => m.created_by));
  return data.map((m) => ({
    id: m.id,
    reason: m.reason,
    change: m.change,
    balanceAfter: m.balance_after,
    note: m.note,
    assetId: m.asset_id,
    by: (m.created_by && people.get(m.created_by)) || FORMER_MEMBER,
    at: m.created_at,
  }));
}

/** The sub-category's fields, for the spare form and page. */
export const fieldsOf = (maps: RefMaps, subCategoryId: string) => maps.sub.get(subCategoryId)?.fields ?? [];
