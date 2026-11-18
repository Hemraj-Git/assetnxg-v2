import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdminModule } from "@/lib/auth";
import { loadAssetRefs } from "../../../assets/data";
import { loadSpare } from "../../data";
import { SpareForm } from "../../spare-form";

export const metadata: Metadata = { title: "Edit spare" };

// Params are read at request time, inside the admin layout's <Suspense>.
export default async function EditSparePage({ params }: PageProps<"/admin/spares/[ref]/edit">) {
  const { ref } = await params;
  const { ctx, supabase } = await requireAdminModule("spares");
  const [spare, refs] = await Promise.all([loadSpare(supabase, ctx.brand.id, ref), loadAssetRefs(supabase, ctx.brand.id)]);
  if (!spare) notFound();

  return (
    <PageBody>
      <PageHeader title={`Edit ${spare.name}`} description={`${spare.code} · the number stays the same; stock changes go through Adjust stock`} />
      <SpareForm refs={refs} spare={spare} />
    </PageBody>
  );
}
