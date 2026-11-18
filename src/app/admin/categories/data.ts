import "server-only";

import { storedAssetFields, type CategoryNode, type SubCategoryNode } from "@/lib/categories";
import type { ChecklistKind, RepeatInterval } from "@/lib/templates";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TemplateOption = { id: string; kind: ChecklistKind; title: string; repeats: RepeatInterval };

/** This client's categories and sub-categories (RLS limits them to it). */
export async function loadCategories(
  supabase: Supabase,
  orgId: string,
): Promise<{ categories: CategoryNode[]; subs: SubCategoryNode[]; templates: TemplateOption[] }> {
  const [c, s, t] = await Promise.all([
    supabase.from("categories").select("id, code, name, description").eq("organization_id", orgId),
    supabase
      .from("sub_categories")
      .select("id, category_id, code, name, description, sla_priority, asset_fields, template_ids")
      .eq("organization_id", orgId),
    // Only the kinds whose module is on are visible (RLS).
    supabase.from("checklist_templates").select("id, kind, title, repeats").eq("organization_id", orgId),
  ]);
  if (t.error) throw new Error(`Could not load templates: ${t.error.message}`);
  const templates: TemplateOption[] = (t.data ?? [])
    .map((x) => ({ id: x.id, kind: x.kind, title: x.title, repeats: x.repeats }))
    .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
  const visible = new Set(templates.map((x) => x.id));
  if (c.error || !c.data) throw new Error(`Could not load categories: ${c.error?.message ?? "no data"}`);
  if (s.error || !s.data) throw new Error(`Could not load sub-categories: ${s.error?.message ?? "no data"}`);

  return {
    categories: c.data.map((x) => ({ id: x.id, code: x.code, name: x.name, description: x.description })),
    subs: s.data.map((x) => ({
      id: x.id,
      categoryId: x.category_id,
      code: x.code,
      name: x.name,
      description: x.description,
      slaPriority: x.sla_priority,
      assetFields: storedAssetFields(x.asset_fields),
      templateIds: x.template_ids.filter((id) => visible.has(id)),
    })),
    templates,
  };
}
