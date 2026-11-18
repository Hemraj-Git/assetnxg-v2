import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FormMessage } from "@/components/ui/field";
import { requireAdminModule } from "@/lib/auth";
import { loadAssetRefs } from "../../assets/data";
import { SpareForm } from "../spare-form";

export const metadata: Metadata = { title: "Add spare" };

export default async function NewSparePage() {
  const { ctx, supabase } = await requireAdminModule("spares");
  const refs = await loadAssetRefs(supabase, ctx.brand.id);

  return (
    <PageBody>
      <PageHeader title="Add spare" description="What it is, how many you have and where they're kept." />
      {refs.subCategories.length > 0 ? (
        <SpareForm refs={refs} spare={null} />
      ) : (
        <FormMessage tone="error">
          Add at least one sub-category (<Link href="/admin/categories">Categories</Link>) first.
        </FormMessage>
      )}
    </PageBody>
  );
}
