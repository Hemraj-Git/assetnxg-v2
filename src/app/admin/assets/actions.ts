"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ASSET_STATUSES, parseSpecInputs, type AssetStatus } from "@/lib/assets";
import { requireAdmin } from "@/lib/auth";
import { SLA_PRIORITIES, storedAssetFields, type SlaPriority } from "@/lib/categories";
import { daysBetween, parseDisplayDate } from "@/lib/dates";
import { plainDbError } from "@/lib/db-errors";
import { TRY_AGAIN, fail, isId, ok, optionalId, optionalNumber, text, type ActionState } from "@/lib/form-actions";

// Assets (Admins only). The database numbers them (AST-), checks the
// specifications against the sub-category, locks the installation date,
// checks the dates and same-client links, and logs every change.

export type { ActionState };

const GONE = "This asset was changed or removed meanwhile. Refresh the page.";

const schema = z.object({
  name: z.string().min(1, "Enter the asset's name.").max(120, "Keep the name under 120 characters."),
  manufacturer: z.string().max(80, "Keep the manufacturer under 80 characters."),
  model: z.string().max(80, "Keep the model under 80 characters."),
  serial_no: z.string().max(80, "Keep the serial number under 80 characters."),
  notes: z.string().max(1000, "Keep the note under 1,000 characters."),
});

function dateField(formData: FormData, name: string, label: string): { value: string | null } | { error: string } {
  const raw = text(formData, name);
  if (!raw) return { value: null };
  const iso = parseDisplayDate(raw);
  return iso ? { value: iso } : { error: `Enter the ${label} as DD-MM-YYYY.` };
}

/** Add (id = null) or edit an asset. Adding opens the new asset's page. */
export async function saveAsset(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = schema.safeParse({
    name: text(formData, "name"),
    manufacturer: text(formData, "manufacturer"),
    model: text(formData, "model"),
    serial_no: text(formData, "serial_no"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const subCategoryId = optionalId(formData, "sub_category_id");
  if (!subCategoryId) return fail("Choose a sub-category. It decides the specifications.");
  const roomId = optionalId(formData, "room_id");
  if (!roomId) return fail("Choose the room or area where the asset is.");
  const vendorId = optionalId(formData, "purchased_from_id");
  const assignedTo = optionalId(formData, "assigned_to");
  if (vendorId === undefined || assignedTo === undefined) return fail("Choose from the lists.");

  const rawPriority = text(formData, "sla_priority");
  if (rawPriority && !(SLA_PRIORITIES as readonly string[]).includes(rawPriority)) return fail("Choose a priority from the list.");
  const priority = (rawPriority || null) as SlaPriority | null;

  const price = optionalNumber(formData, "price");
  if (price === undefined || (price !== null && price > 999_999_999_999)) return fail("Enter the price as a number, without the ₹ sign.");

  const purchase = dateField(formData, "purchase_date", "purchase date");
  const installation = dateField(formData, "installation_date", "installation date");
  const serviced = dateField(formData, "last_serviced_on", "last serviced date");
  for (const d of [purchase, installation, serviced]) if ("error" in d) return fail(d.error);
  const p = (purchase as { value: string | null }).value;
  const i = (installation as { value: string | null }).value;
  const s = (serviced as { value: string | null }).value;
  if (p && i && daysBetween(p, i) < 0) return fail("The installation date can't be before the purchase date.");
  if (i && s && daysBetween(i, s) < 0) return fail("The last serviced date can't be before the installation date.");

  // Specifications: the chosen sub-category's fields (read here, checked
  // again by the database).
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
    room_id: roomId,
    sla_priority: priority,
    manufacturer: parsed.data.manufacturer || null,
    model: parsed.data.model || null,
    serial_no: parsed.data.serial_no || null,
    price,
    purchase_date: p,
    last_serviced_on: s,
    purchased_from_id: vendorId,
    assigned_to: assignedTo,
    spec_values: specs.values,
    notes: parsed.data.notes || null,
  };

  if (id === null) {
    const { data, error } = await supabase
      .from("assets")
      .insert({ ...values, installation_date: i, organization_id: ctx.brand.id })
      .select("code")
      .single();
    if (error) return fail(plainDbError(error, TRY_AGAIN));
    redirect(`/admin/assets/${data.code}?added=1`);
  }

  // The installation date is locked once set (the database keeps the old
  // one); send it only when it was empty.
  const { data, error } = await supabase
    .from("assets")
    .update(i ? { ...values, installation_date: i } : values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("code");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  redirect(`/admin/assets/${data[0].code}?saved=1`);
}

/** Change the status of one or many assets. Retiring takes a reason. */
export async function setAssetStatus(ids: string[], status: AssetStatus, reason: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every(isId)) return fail(TRY_AGAIN);
  if (!ASSET_STATUSES.includes(status)) return fail("Choose a status from the list.");
  const why = typeof reason === "string" ? reason.trim() : "";
  if (status === "retired" && !why) return fail("Say why the asset is being retired.");
  if (why.length > 200) return fail("Keep the reason under 200 characters.");

  const { data, error } = await supabase
    .from("assets")
    .update({ status, retire_reason: status === "retired" ? why : null })
    .in("id", ids)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data || data.length !== ids.length) {
    refresh();
    return fail(`${data?.length ?? 0} of ${ids.length} assets were changed; the others were changed or removed meanwhile.`);
  }
  refresh();
  return ok(ids.length === 1 ? "Status changed." : `Status changed for ${ids.length} assets.`);
}

/** Delete an asset added by mistake. Assets in use are retired instead. */
export async function deleteAsset(id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!isId(id)) return fail(TRY_AGAIN);
  const { data, error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  redirect("/admin/assets?deleted=1");
}
