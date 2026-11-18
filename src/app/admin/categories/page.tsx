import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { taxonomyTree } from "@/lib/categories";
import { CategoriesView } from "./categories-view";
import { loadCategories } from "./data";

export const metadata: Metadata = { title: "Categories" };

// Categories and sub-categories as a tree (02 "Taxonomy"; tree view approved
// in 05). PM and inspection templates join the sub-category with checklist
// templates.
export default async function CategoriesPage() {
  const { ctx, supabase } = await requireAdmin();
  const { categories, subs, templates } = await loadCategories(supabase, ctx.brand.id);

  return (
    <PageBody>
      <PageHeader
        title="Categories"
        description={`${categories.length} ${categories.length === 1 ? "category" : "categories"}, ${subs.length} ${
          subs.length === 1 ? "sub-category" : "sub-categories"
        }. Every asset belongs to a sub-category.`}
      />
      <CategoriesView rows={taxonomyTree(categories, subs)} categories={categories} templates={templates} />
    </PageBody>
  );
}
