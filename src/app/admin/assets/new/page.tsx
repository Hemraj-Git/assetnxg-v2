import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FormMessage } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { AssetForm } from "../asset-form";
import { loadAssetRefs } from "../data";

export const metadata: Metadata = { title: "Add asset" };

export default async function NewAssetPage() {
  const { ctx, supabase } = await requireAdmin();
  const refs = await loadAssetRefs(supabase, ctx.brand.id);
  const ready = refs.rooms.length > 0 && refs.subCategories.length > 0;

  return (
    <PageBody>
      <PageHeader title="Add asset" description="Four short steps. Nothing is saved until you create it." />
      {ready ? (
        <AssetForm refs={refs} asset={null} />
      ) : (
        <FormMessage tone="error">
          Add at least one room (<Link href="/admin/locations">Locations</Link>) and one sub-category (
          <Link href="/admin/categories">Categories</Link>) first.
        </FormMessage>
      )}
    </PageBody>
  );
}
