"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseSpecInputs } from "@/lib/assets";
import { requireAdminModule } from "@/lib/auth";
import { storedAssetFields } from "@/lib/categories";
import { daysBetween, parseDisplayDate } from "@/lib/dates";
import { plainDbError } from "@/lib/db-errors";
import { TRY_AGAIN, fail, isId, ok, optionalId, optionalNumber, text, type ActionState } from "@/lib/form-actions";
import { parseStockInput } from "@/lib/spares";

// Spares (Admins, Spares module). The database numbers them (INV-), checks
// the specifications against the sub-category, keeps the quantity (only
// stock movements change it, never below zero), deploys a spare as an asset
// in one step, and logs every change.

export type { ActionState };

const GONE = "This spare was changed or removed meanwhile. Refresh the page.";

const schema = z.object({
  name: z.string().min(1, "Enter the spare's name.").max(120, "Keep the name under 120 characters."),
  manufacturer: z.string().max(80, "Keep the manufacturer under 80 characters."),
  model: z.string().max(80, "Keep the model under 80 characters."),
  part_no: z.string().max(80, "Keep the part number under 80 characters."),
  serial_no: z.string().max(80, "Keep the serial number under 80 characters."),
  storage_note: z.string().max(120, "Keep the shelf or bin under 120 characters."),
  handling_note: z.string().max(500, "Keep the handling note under 500 characters."),
  notes: z.string().max(1000, "Keep the note under 1,000 characters."),
});

function dateField(formData: FormData, name: string, label: string): { value: string | null } | { error: string } {
  const raw = text(formData, name);
  if (!raw) return { value: null };
  const iso = parseDisplayDate(raw);
  return iso ? { value: iso } : { error: `Enter the ${label} as DD-MM-YYYY.` };
}

function wholeNumber(formData: FormData, name: string): number | null | undefined {
  const n = optionalNumber(formData, name);
  if (n === undefined || (n !== null && (!Number.isInteger(n) || n > 1_000_000))) return undefined;
  return n;
}

/** Add (id = null) or edit a spare. Adding opens the new spare's page. */
export async function saveSpare(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdminModule("spares");
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = schema.safeParse({
    name: text(formData, "name"),
    manufacturer: text(formData, "manufacturer"),
    model: text(formData, "model"),
    part_no: text(formData, "part_no"),
    serial_no: text(formData, "serial_no"),
    storage_note: text(formData, "storage_note"),
    handling_note: text(formData, "handling_note"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const subCategoryId = optionalId(formData, "sub_category_id");
  if (!subCategoryId) return fail("Choose a sub-category. It decides the specifications.");
  const roomId = optionalId(formData, "room_id");
  const vendorId = optionalId(formData, "vendor_id");
  if (roomId === undefined || vendorId === undefined) return fail("Choose from the lists.");

  const minStock = wholeNumber(formData, "min_stock");
  if (minStock === undefined) return fail("Enter the minimum stock as a whole number.");
  const unitCost = optionalNumber(formData, "unit_cost");
  if (unitCost === undefined || (unitCost !== null && unitCost > 999_999_999_999)) {
    return fail("Enter the unit cost as a number, without the ₹ sign.");
  }

  const purchase = dateField(formData, "purchase_date", "purchase date");
  if ("error" in purchase) return fail(purchase.error);
  const warranty = dateField(formData, "warranty_till", "warranty end date");
  if ("error" in warranty) return fail(warranty.error);
  if (purchase.value && warranty.value && daysBetween(purchase.value, warranty.value) < 0) {
    return fail("The warranty can't end before the purchase date.");
  }

  const sub = await supabase
    .from("sub_categories")
    .select("asset_fields")
    .eq("id", subCategoryId)
    .eq("organization_id", ctx.brand.id)
    .maybeSingle();
  if (sub.error || !sub.data) return fail("Choose a sub-category from the list.");
  const specs = parseSpecInputs(storedAssetFields(sub.data.asset_fields), (key) => text(formData, `spec:${key}`));
  if (!specs.ok) return fail(specs.error);

  const values = {
    name: parsed.data.name,
    sub_category_id: subCategoryId,
    manufacturer: parsed.data.manufacturer || null,
    model: parsed.data.model || null,
    part_no: parsed.data.part_no || null,
    serial_no: parsed.data.serial_no || null,
    min_stock: minStock,
    unit_cost: unitCost,
    room_id: roomId,
    storage_note: parsed.data.storage_note || null,
    handling_note: parsed.data.handling_note || null,
    vendor_id: vendorId,
    purchase_date: purchase.value,
    warranty_till: warranty.value,
    spec_values: specs.values,
    notes: parsed.data.notes || null,
  };

  if (id === null) {
    const quantity = wholeNumber(formData, "quantity");
    if (quantity === undefined) return fail("Enter the stock in hand as a whole number.");
    const { data, error } = await supabase
      .from("spares")
      .insert({ ...values, quantity: quantity ?? 0, organization_id: ctx.brand.id })
      .select("code")
      .single();
    if (error) return fail(plainDbError(error, TRY_AGAIN));
    redirect(`/admin/spares/${data.code}?added=1`);
  }

  const { data, error } = await supabase
    .from("spares")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("code");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  redirect(`/admin/spares/${data[0].code}?saved=1`);
}

/** Received, taken out, or count corrected: one stock movement. */
export async function recordStock(spareId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdminModule("spares");
  if (!isId(spareId)) return fail(TRY_AGAIN);
  const input = parseStockInput(text(formData, "action"), text(formData, "quantity"));
  if ("error" in input) return fail(input.error);
  const note = text(formData, "note");
  if (note.length > 200) return fail("Keep the note under 200 characters.");

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      organization_id: ctx.brand.id,
      spare_id: spareId,
      reason: input.reason,
      change: input.change,
      counted: input.counted,
      note: note || null,
    })
    .select("balance_after")
    .single();
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  refresh();
  return ok(`Saved. Stock is now ${data.balance_after.toLocaleString("en-IN")}.`);
}

/** Deploy one unit as an asset; opens the new asset's page. */
export async function deploySpare(spareId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdminModule("spares");
  if (!isId(spareId)) return fail(TRY_AGAIN);
  const roomId = optionalId(formData, "room_id");
  if (!roomId) return fail("Choose the room or area where the asset goes.");
  const name = text(formData, "name");
  if (!name) return fail("Enter the asset's name.");
  if (name.length > 120) return fail("Keep the name under 120 characters.");
  const serial = text(formData, "serial_no");
  if (serial.length > 80) return fail("Keep the serial number under 80 characters.");
  const installed = dateField(formData, "installation_date", "installation date");
  if ("error" in installed) return fail(installed.error);

  const { data, error } = await supabase.rpc("deploy_spare", {
    p_org: ctx.brand.id,
    p_spare: spareId,
    p_room: roomId,
    p_name: name,
    p_serial_no: serial || undefined,
    p_installation_date: installed.value ?? undefined,
  });
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  redirect(`/admin/assets/${data}?added=1`);
}

/** Delete a spare added by mistake (no stock history yet). */
export async function deleteSpare(id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdminModule("spares");
  if (!isId(id)) return fail(TRY_AGAIN);
  const { data, error } = await supabase
    .from("spares")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  redirect("/admin/spares?deleted=1");
}
