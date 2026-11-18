"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { SLA_PRIORITIES, parseAssetFields, type SlaPriority } from "@/lib/categories";
import { plainDbError } from "@/lib/db-errors";
import { TRY_AGAIN, fail, isId, ok, text, type ActionState } from "@/lib/form-actions";

// Categories and sub-categories (Admins only). The database makes the codes
// (ELEC, ELEC-LIGH), checks the asset fields again, refuses deletes while
// used, and logs every change.

export type { ActionState };

const GONE = "This was changed or removed meanwhile. Refresh the page.";

const details = (what: string) =>
  z.object({
    name: z.string().min(1, `Enter the ${what}'s name.`).max(60, "Keep the name under 60 characters."),
    description: z.string().max(300, "Keep the description under 300 characters."),
  });

export async function saveCategory(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);

  const parsed = details("category").safeParse({ name: text(formData, "name"), description: text(formData, "description") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const values = { name: parsed.data.name, description: parsed.data.description || null };
  const duplicate = `There is already a category called “${parsed.data.name}”.`;

  if (id === null) {
    const { data, error } = await supabase
      .from("categories")
      .insert({ ...values, organization_id: ctx.brand.id })
      .select("code")
      .single();
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    refresh();
    return ok(`${parsed.data.name} added as ${data.code}.`);
  }
  const { data, error } = await supabase
    .from("categories")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Saved. The code stays the same.");
}

export async function saveSubCategory(
  id: string | null,
  categoryId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if ((id !== null && !isId(id)) || !isId(categoryId)) return fail(TRY_AGAIN);

  const parsed = details("sub-category").safeParse({ name: text(formData, "name"), description: text(formData, "description") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const rawPriority = text(formData, "sla_priority");
  if (rawPriority && !(SLA_PRIORITIES as readonly string[]).includes(rawPriority)) return fail("Choose a priority from the list.");
  const priority = (rawPriority || null) as SlaPriority | null;

  const fields = parseAssetFields(formData.get("asset_fields"));
  if (!fields.ok) return fail(fields.error);

  const values = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    sla_priority: priority,
    asset_fields: fields.fields,
  };
  const duplicate = `This category already has a sub-category called “${parsed.data.name}”.`;

  if (id === null) {
    const { data, error } = await supabase
      .from("sub_categories")
      .insert({ ...values, category_id: categoryId, organization_id: ctx.brand.id })
      .select("code")
      .single();
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    refresh();
    return ok(`${parsed.data.name} added as ${data.code}.`);
  }
  const { data, error } = await supabase
    .from("sub_categories")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok("Saved. The code stays the same.");
}

export async function deleteTaxonomy(kind: "category" | "sub", id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!isId(id)) return fail(TRY_AGAIN);

  const table = kind === "category" ? "categories" : "sub_categories";
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail(GONE);
  refresh();
  return ok(kind === "category" ? "Category deleted." : "Sub-category deleted.");
}
