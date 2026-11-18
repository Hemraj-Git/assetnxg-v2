import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { storedItems, type ChecklistItem, type ChecklistKind, type RepeatInterval } from "@/lib/templates";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TemplateRecord = {
  id: string;
  kind: ChecklistKind;
  title: string;
  description: string | null;
  repeats: RepeatInterval;
  items: ChecklistItem[];
  version: number;
  updatedAt: string;
  /** Sub-categories that list it, by "Category › Sub-category". */
  usedBy: string[];
};

/** This client's templates of the kinds its modules allow (RLS hides the
 *  others), with the sub-categories that use each. */
export async function loadTemplates(supabase: Supabase, orgId: string): Promise<TemplateRecord[]> {
  const [t, s, c] = await Promise.all([
    supabase
      .from("checklist_templates")
      .select("id, kind, title, description, repeats, items, version, updated_at")
      .eq("organization_id", orgId),
    supabase.from("sub_categories").select("name, category_id, template_ids").eq("organization_id", orgId),
    supabase.from("categories").select("id, name").eq("organization_id", orgId),
  ]);
  const failed = t.error ?? s.error ?? c.error;
  if (failed) throw new Error(`Could not load templates: ${failed.message}`);

  const categoryName = new Map((c.data ?? []).map((x) => [x.id, x.name]));
  return (t.data ?? []).map((x) => ({
    id: x.id,
    kind: x.kind,
    title: x.title,
    description: x.description,
    repeats: x.repeats,
    items: storedItems(x.items),
    version: x.version,
    updatedAt: x.updated_at,
    usedBy: (s.data ?? [])
      .filter((sc) => sc.template_ids.includes(x.id))
      .map((sc) => [categoryName.get(sc.category_id), sc.name].filter(Boolean).join(" › "))
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
  }));
}

export async function loadTemplate(supabase: Supabase, orgId: string, id: string): Promise<TemplateRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const all = await loadTemplates(supabase, orgId);
  return all.find((t) => t.id === id) ?? null;
}
