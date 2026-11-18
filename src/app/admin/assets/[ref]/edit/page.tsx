import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { AssetForm } from "../../asset-form";
import { loadAsset, loadAssetRefs } from "../../data";

export const metadata: Metadata = { title: "Edit asset" };

// Params are read at request time, inside the admin layout's <Suspense>.
export default async function EditAssetPage({ params }: PageProps<"/admin/assets/[ref]/edit">) {
  const { ref } = await params;
  const { ctx, supabase } = await requireAdmin();
  const [asset, refs] = await Promise.all([loadAsset(supabase, ctx.brand.id, ref), loadAssetRefs(supabase, ctx.brand.id)]);
  if (!asset) notFound();

  return (
    <PageBody>
      <PageHeader title={`Edit ${asset.name}`} description={`${asset.code} · the number and QR code stay the same`} />
      <AssetForm refs={refs} asset={asset} />
    </PageBody>
  );
}
