"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { plainDbError } from "@/lib/db-errors";
import { TRY_AGAIN, fail, isId, ok, text, type ActionState } from "@/lib/form-actions";

// Vendors (Admins only). The database numbers them (VND-), tidies the
// details, checks the categories are this client's, and logs every change.
// AMCs are contracts on assets (owner, 18-11-2026), recorded with Assets.

export type { ActionState };

const GONE = "This vendor was changed or removed meanwhile. Refresh the page.";

const schema = z.object({
  name: z.string().min(1, "Enter the vendor's name.").max(120, "Keep the name under 120 characters."),
  contact_person: z.string().max(120, "Keep the contact name under 120 characters."),
  phone: z
    .string()
    .max(20, "Keep the phone number under 20 characters.")
    .regex(/^([+0-9 ()-]{3,20})?$/, "Use digits, spaces and + ( ) - in the phone number."),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  address: z.string().max(300, "Keep the address under 300 characters."),
});

/** Add (id = null) or edit a vendor. */
export async function saveVendor(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = schema.safeParse({
    name: text(formData, "name"),
    contact_person: text(formData, "contact_person"),
    phone: text(formData, "phone"),
    email: text(formData, "email").toLowerCase(),
    address: text(formData, "address"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const categoryIds = formData.getAll("category_ids").filter((v): v is string => typeof v === "string");
  if (!categoryIds.every(isId)) return fail("Choose categories from the list.");

  const values = {
    name: parsed.data.name,
    category_ids: categoryIds,
    contact_person: parsed.data.contact_person || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
  };
  const duplicate = `There is already a vendor called “${parsed.data.name}”.`;

  if (id === null) {
    const { data, error } = await supabase
      .from("vendors")
      .insert({ ...values, organization_id: ctx.brand.id })
      .select("code")
      .single();
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    refresh();
    return ok(`${parsed.data.name} added as ${data.code}.`);
  }
  const { data, error } = await supabase
    .from("vendors")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Saved.");
}

export async function deleteVendor(id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!isId(id)) return fail(TRY_AGAIN);

  const { data, error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Vendor deleted.");
}
