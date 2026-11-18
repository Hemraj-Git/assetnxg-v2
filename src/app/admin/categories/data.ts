import "server-only";

import { storedAssetFields, type CategoryNode, type SubCategoryNode } from "@/lib/categories";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** This client's categories and sub-categories (RLS limits them to it). */
export async function loadCategories(
  supabase: Supabase,
  orgId: string,
): Promise<{ categories: CategoryNode[]; subs: SubCategoryNode[] }> {
  const [c, s] = await Promise.all([
    supabase.from("categories").select("id, code, name, description").eq("organization_id", orgId),
    supabase
      .from("sub_categories")
      .select("id, category_id, code, name, description, sla_priority, asset_fields")
      .eq("organization_id", orgId),
  ]);
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
    })),
  };
}
