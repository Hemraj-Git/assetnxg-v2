"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { plainDbError } from "@/lib/db-errors";
import { TRY_AGAIN, fail, isId, text, type ActionState } from "@/lib/form-actions";
import { REPEATS, kindsFor, parseChecklistItems, type ChecklistKind, type RepeatInterval } from "@/lib/templates";

// Checklist templates (Admins only, with the Maintenance or Inspections
// module). The database checks the items again, keeps the kind, bumps the
// version when the checklist changes, refuses deleting a template in use,
// and logs every change.

export type { ActionState };

/** Add (id = null) or edit a template; opens the template afterwards. */
export async function saveTemplate(
  id: string | null,
  kind: ChecklistKind,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (id !== null && !isId(id)) return fail(TRY_AGAIN);
  if (!kindsFor(ctx.modules).includes(kind)) return fail("This kind of template isn't switched on for your organisation.");

  const parsed = z
    .object({
      title: z.string().min(1, "Enter the template's title.").max(120, "Keep the title under 120 characters."),
      description: z.string().max(300, "Keep the description under 300 characters."),
    })
    .safeParse({ title: text(formData, "title"), description: text(formData, "description") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");

  const repeats = text(formData, "repeats") as RepeatInterval;
  if (!REPEATS.includes(repeats)) return fail("Choose how often it repeats.");

  const items = parseChecklistItems(formData.get("items"));
  if (!items.ok) return fail(items.error);

  const values = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    repeats,
    items: items.items,
  };
  const duplicate = `There is already a ${kind === "pm" ? "PM" : "inspection"} template called “${parsed.data.title}”.`;

  if (id === null) {
    const { data, error } = await supabase
      .from("checklist_templates")
      .insert({ ...values, kind, organization_id: ctx.brand.id })
      .select("id")
      .single();
    if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
    redirect(`/admin/templates/${data.id}?added=1`);
  }

  const { data, error } = await supabase
    .from("checklist_templates")
    .update(values)
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("id");
  if (error) return fail(plainDbError(error, TRY_AGAIN, duplicate));
  if (!data?.length) return fail("This template was changed or removed meanwhile. Refresh the page.");
  redirect(`/admin/templates/${id}?saved=1`);
}

export async function deleteTemplate(id: string): Promise<ActionState> {
  const { ctx, supabase } = await requireAdmin();
  if (!isId(id)) return fail(TRY_AGAIN);
  const { data, error } = await supabase
    .from("checklist_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.brand.id)
    .select("kind");
  if (error) return fail(plainDbError(error, TRY_AGAIN));
  if (!data?.length) return fail("This template was changed or removed meanwhile. Refresh the page.");
  redirect(`/admin/templates?kind=${data[0].kind}&deleted=1`);
}
